// createClient is imported dynamically inside the handler

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WaybillItem {
  qty: string;
  serialNumber: string;
}

interface ParsedPOData {
  customerName: string;
  customerAddress: string;
  items: WaybillItem[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check role: only orders or admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("department_role")
      .eq("user_id", userId)
      .single();

    const role = roleData?.department_role;
    if (role !== "orders" && role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: insufficient role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { companyPoId, filePath } = await req.json();

    if (!companyPoId || !filePath) {
      return new Response(
        JSON.stringify({ success: false, error: "Company PO ID and file path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Downloading file from:", filePath);

    // Download the PDF file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to download file: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert PDF to base64 for AI processing using chunked approach to avoid stack overflow
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Process in chunks to avoid "Maximum call stack size exceeded" error
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Data = btoa(binaryString);

    console.log("File downloaded, sending to AI for parsing...");

    // Use Lovable AI Gateway to parse the PDF
    const lovableAiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI service not configured. Please add LOVABLE_API_KEY to secrets.",
          items: [{ qty: "1", reference: "", description: "Default item - manual entry required" }]
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch(lovableAiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this Company Purchase Order PDF and extract the following information:

1. Customer Name - the name of the customer/company the order is for
2. Customer Address - the delivery or billing address
3. Line Items - for each item extract:
   - Quantity (qty) - the number/amount of items
   - Serial Number - the serial number, part number, or item code

Return the data as a JSON object with this exact structure:
{
  "customerName": "Customer Company Name",
  "customerAddress": "123 Street, City, Country",
  "items": [
    {"qty": "5", "serialNumber": "SN-12345"},
    {"qty": "10", "serialNumber": "SN-67890"}
  ]
}

If you cannot determine a value, leave it as an empty string.
Only return the JSON object, no other text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      
      // Return default data if AI fails
      return new Response(
        JSON.stringify({ 
          success: true, 
          customerName: "",
          customerAddress: "",
          items: [{ qty: "1", serialNumber: "Unable to parse PDF - please enter manually" }],
          message: "Could not parse PDF automatically. Please enter details manually."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    console.log("AI Response received");

    let parsedData: ParsedPOData = {
      customerName: "",
      customerAddress: "",
      items: []
    };
    
    try {
      const content = aiResult.choices?.[0]?.message?.content || "";
      
      // Try to parse JSON object from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedData.customerName = String(parsed.customerName || "");
        parsedData.customerAddress = String(parsed.customerAddress || "");
        
        if (Array.isArray(parsed.items)) {
          parsedData.items = parsed.items.map((item: any) => ({
            qty: String(item.qty || "1"),
            serialNumber: String(item.serialNumber || "")
          })).filter((item: WaybillItem) => item.serialNumber);
        }
      }
      
      if (parsedData.items.length === 0) {
        parsedData.items = [{ qty: "1", serialNumber: "No items found - please enter manually" }];
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      parsedData.items = [{ qty: "1", serialNumber: "Error parsing PDF - please enter manually" }];
    }

    console.log("Parsed data:", parsedData);

    return new Response(
      JSON.stringify({ success: true, ...parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing Company PO:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        customerName: "",
        customerAddress: "",
        items: [{ qty: "1", serialNumber: "Error - please enter manually" }]
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
