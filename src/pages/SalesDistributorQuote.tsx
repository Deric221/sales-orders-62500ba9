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
import { Upload, ArrowLeft, FileText, Eye } from "lucide-react";

const SalesDistributorQuote = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCustomerPOForDist, setSelectedCustomerPOForDist] = useState("");
  const [distQuoteNumber, setDistQuoteNumber] = useState("");
  const [distQuoteFile, setDistQuoteFile] = useState<File | null>(null);

  const { data: customerPOs } = useQuery({
    queryKey: ["customer-pos-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_pos").select("*, quotes(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedCPO = customerPOs?.find((po: any) => po.id === selectedCustomerPOForDist);

  const viewFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
    if (error) { toast({ variant: "destructive", title: "View failed", description: error.message }); return; }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadDistributorQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCustomerPOForDist || !distQuoteFile || !distQuoteNumber) throw new Error("Missing required data");
      const filePath = `${user.id}/${Date.now()}_${distQuoteFile.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, distQuoteFile);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("distributor_quotes").insert({
        customer_po_id: selectedCustomerPOForDist, quote_number: distQuoteNumber, file_name: distQuoteFile.name, file_path: filePath, uploaded_by: user.id,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({ title: "Distributor quote uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["customer-pos-sales"] });
      setSelectedCustomerPOForDist(""); setDistQuoteNumber(""); setDistQuoteFile(null);
    },
    onError: (error: any) => { toast({ variant: "destructive", title: "Upload failed", description: error.message }); },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Distributor Quote">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Upload Distributor Quote</CardTitle>
              <CardDescription>Upload quote received from distributor (linked to Customer PO)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="select-customer-po-dist">Select Customer PO</Label>
                <select id="select-customer-po-dist" className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md" value={selectedCustomerPOForDist} onChange={(e) => setSelectedCustomerPOForDist(e.target.value)}>
                  <option value="">Select customer PO...</option>
                  {customerPOs?.map((po: any) => (<option key={po.id} value={po.id}>{po.po_number} - {po.quotes?.customer_name || 'Unknown'}</option>))}
                </select>
              </div>
              {selectedCPO && (
                <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedCPO.file_path)}>
                  <Eye className="h-4 w-4 mr-1" /> View Selected Customer PO
                </Button>
              )}
              <div className="space-y-2">
                <Label htmlFor="dist-quote-number">Distributor Quote Number</Label>
                <Input id="dist-quote-number" value={distQuoteNumber} onChange={(e) => setDistQuoteNumber(e.target.value)} placeholder="DQ-2025-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist-quote-file">Quote File</Label>
                <Input id="dist-quote-file" type="file" onChange={(e) => setDistQuoteFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" />
              </div>
              <Button onClick={() => uploadDistributorQuoteMutation.mutate()} disabled={!selectedCustomerPOForDist || !distQuoteNumber || !distQuoteFile || uploadDistributorQuoteMutation.isPending} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {uploadDistributorQuoteMutation.isPending ? "Uploading..." : "Upload Distributor Quote"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesDistributorQuote;
