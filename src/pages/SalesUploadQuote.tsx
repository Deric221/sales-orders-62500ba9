import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft } from "lucide-react";

const SalesUploadQuote = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quoteNumber, setQuoteNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  const uploadQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteFile || !user) throw new Error("Missing required data");

      const filePath = `${user.id}/${Date.now()}_${quoteFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, quoteFile);

      if (uploadError) throw uploadError;

      const { data: insertedQuotes, error: insertError } = await supabase
        .from("quotes")
        .insert({
          quote_number: quoteNumber,
          customer_name: customerName,
          uploaded_by: user.id,
          file_path: filePath,
          file_name: quoteFile.name,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Initialize workflow for this quote
      const quoteId = insertedQuotes.id;
      const { error: wfError } = await supabase
        .from("workflow_tracker")
        .insert({ quote_id: quoteId, current_stage: "quote_uploaded" });
      if (wfError) throw wfError;
    },
    onSuccess: () => {
      toast({ title: "Quote uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setQuoteNumber("");
      setCustomerName("");
      setQuoteFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || !userRole) {
    navigate("/auth");
    return null;
  }

  return (
    <DashboardLayout title="Upload Quote">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Quote
              </CardTitle>
              <CardDescription>Upload a new quote PDF for a customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quote-number">Quote Number</Label>
                <Input
                  id="quote-number"
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  placeholder="Q-2025-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer Name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ABC Corporation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-file">Quote PDF</Label>
                <Input
                  id="quote-file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setQuoteFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button
                onClick={() => uploadQuoteMutation.mutate()}
                disabled={!quoteNumber || !customerName || !quoteFile || uploadQuoteMutation.isPending}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadQuoteMutation.isPending ? "Uploading..." : "Upload Quote"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesUploadQuote;
