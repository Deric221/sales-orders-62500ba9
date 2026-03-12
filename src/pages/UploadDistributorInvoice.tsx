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
import { Upload, FileCheck, Eye } from "lucide-react";

const UploadDistributorInvoice = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCompanyPO, setSelectedCompanyPO] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const { data: companyPOs } = useQuery({
    queryKey: ["company-pos-for-dist-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_pos").select("*, customer_pos(*, quotes(*))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedPO = companyPOs?.find((po: any) => po.id === selectedCompanyPO);

  const viewFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
    if (error) { toast({ variant: "destructive", title: "View failed", description: error.message }); return; }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadDistributorInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCompanyPO || !invoiceFile || !invoiceNumber) throw new Error("Missing required data");
      const filePath = `${user.id}/${Date.now()}_${invoiceFile.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, invoiceFile);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("distributor_invoices").insert({
        company_po_id: selectedCompanyPO, invoice_number: invoiceNumber, file_name: invoiceFile.name, file_path: filePath, uploaded_by: user.id,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({ title: "Distributor invoice uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["distributor-invoices"] });
      setSelectedCompanyPO(""); setInvoiceNumber(""); setInvoiceFile(null);
    },
    onError: (error: any) => { toast({ variant: "destructive", title: "Upload failed", description: error.message }); },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Upload Distributor Invoice">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5" /> Upload Distributor Invoice</CardTitle>
            <CardDescription>Upload an invoice received from the distributor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Company PO</Label>
              <select className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md" value={selectedCompanyPO} onChange={(e) => setSelectedCompanyPO(e.target.value)}>
                <option value="">Select a company PO...</option>
                {companyPOs?.map((po: any) => (<option key={po.id} value={po.id}>{po.po_number} - {po.customer_pos?.quotes?.customer_name} ({po.distributor_name})</option>))}
              </select>
            </div>
            {selectedPO && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedPO.file_path)}>
                  <Eye className="h-4 w-4 mr-1" /> View Company PO
                </Button>
                {selectedPO.customer_pos?.file_path && (
                  <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedPO.customer_pos.file_path)}>
                    <Eye className="h-4 w-4 mr-1" /> View Customer PO
                  </Button>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Distributor Invoice Number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="DI-2025-001" />
            </div>
            <div className="space-y-2">
              <Label>Invoice File</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={() => uploadDistributorInvoiceMutation.mutate()} disabled={!selectedCompanyPO || !invoiceNumber || !invoiceFile || uploadDistributorInvoiceMutation.isPending} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {uploadDistributorInvoiceMutation.isPending ? "Uploading..." : "Upload Invoice"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadDistributorInvoice;
