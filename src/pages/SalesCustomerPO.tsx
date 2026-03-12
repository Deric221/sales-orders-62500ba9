import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft, FileCheck, Eye } from "lucide-react";
import { createNotifications } from "@/lib/notifications";

const SalesCustomerPO = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);

  const { data: quotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedQuote = quotes?.find(q => q.id === selectedQuoteId);

  const viewFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
    if (error) {
      toast({ variant: "destructive", title: "View failed", description: error.message });
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadCustomerPOMutation = useMutation({
    mutationFn: async () => {
      if (!poFile || !user || !selectedQuoteId) throw new Error("Missing required data");

      const filePath = `${user.id}/${Date.now()}_${poFile.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, poFile);
      if (uploadError) throw uploadError;

      const { data: insertedCPO, error: insertError } = await supabase
        .from("customer_pos")
        .insert({ quote_id: selectedQuoteId, po_number: poNumber, uploaded_by: user.id, file_path: filePath, file_name: poFile.name })
        .select("id, quote_id")
        .single();
      if (insertError) throw insertError;

      const { error: wfUpdateError } = await supabase
        .from("workflow_tracker")
        .update({ customer_po_id: insertedCPO.id, current_stage: "customer_po_uploaded" })
        .eq("quote_id", insertedCPO.quote_id);
      if (wfUpdateError) throw wfUpdateError;

      const quote = quotes?.find(q => q.id === selectedQuoteId);
      if (quote) {
        try {
          const { data: ordersUsers } = await supabase.from("user_roles").select("user_id").eq("department_role", "orders");
          if (ordersUsers && ordersUsers.length > 0) {
            const notifications = ordersUsers.map(u => ({
              user_id: u.user_id, title: "New Customer PO Ready",
              message: `Customer PO for quote ${quote.quote_number} (${quote.customer_name}) is ready for company PO creation.`,
              related_type: "workflow", related_id: insertedCPO.quote_id,
            }));
            await createNotifications(notifications);
          }
          const { data: session } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-workflow-notification', {
            body: { workflowId: insertedCPO.quote_id, stage: 'customer_po_uploaded', quoteNumber: quote.quote_number, customerName: quote.customer_name },
            headers: { Authorization: `Bearer ${session?.session?.access_token}` },
          }).catch(err => console.log('Email notification failed:', err));
        } catch (notifyError) { console.error('Notification error:', notifyError); }
      }
    },
    onSuccess: () => {
      toast({ title: "Customer PO uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["customer-pos"] });
      setSelectedQuoteId(""); setPoNumber(""); setPoFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Customer PO Upload">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5" /> Upload Customer PO</CardTitle>
              <CardDescription>Link customer purchase order to a quote</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="select-quote">Select Quote</Label>
                <select id="select-quote" className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md" value={selectedQuoteId} onChange={(e) => setSelectedQuoteId(e.target.value)}>
                  <option value="">Select a quote...</option>
                  {quotes?.map((quote) => (<option key={quote.id} value={quote.id}>{quote.quote_number} - {quote.customer_name}</option>))}
                </select>
              </div>
              {selectedQuote && (
                <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedQuote.file_path)}>
                  <Eye className="h-4 w-4 mr-1" /> View Selected Quote
                </Button>
              )}
              <div className="space-y-2">
                <Label htmlFor="po-number">PO Number</Label>
                <Input id="po-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2025-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-file">Customer PO PDF</Label>
                <Input id="po-file" type="file" accept=".pdf" onChange={(e) => setPoFile(e.target.files?.[0] || null)} />
              </div>
              <Button onClick={() => uploadCustomerPOMutation.mutate()} disabled={!selectedQuoteId || !poNumber || !poFile || uploadCustomerPOMutation.isPending} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {uploadCustomerPOMutation.isPending ? "Uploading..." : "Upload Customer PO"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesCustomerPO;
