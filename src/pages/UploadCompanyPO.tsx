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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { createNotifications } from "@/lib/notifications";

const UploadCompanyPO = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCustomerPO, setSelectedCustomerPO] = useState("");
  const [companyPONumber, setCompanyPONumber] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [companyPOFile, setCompanyPOFile] = useState<File | null>(null);
  const [needsProject, setNeedsProject] = useState(false);

  const { data: customerPOs } = useQuery({
    queryKey: ["customer-pos-for-company-po"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pos")
        .select("*, quotes(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter customer POs that don't have company POs yet
  const { data: existingCompanyPOs } = useQuery({
    queryKey: ["existing-company-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_pos")
        .select("customer_po_id");
      if (error) throw error;
      return data;
    },
  });

  const availableCustomerPOs = customerPOs?.filter(cpo => 
    !existingCompanyPOs?.some(companyPO => companyPO.customer_po_id === cpo.id)
  );

  const uploadCompanyPOMutation = useMutation({
    mutationFn: async () => {
      if (!companyPOFile || !user || !selectedCustomerPO) throw new Error("Missing required data");

      const filePath = `${user.id}/${Date.now()}_${companyPOFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, companyPOFile);

      if (uploadError) throw uploadError;

      const { data: insertedCompanyPO, error: insertError } = await supabase
        .from("company_pos")
        .insert({
          customer_po_id: selectedCustomerPO,
          po_number: companyPONumber,
          distributor_name: distributorName,
          uploaded_by: user.id,
          file_path: filePath,
          file_name: companyPOFile.name,
        })
        .select("id, customer_po_id")
        .single();

      if (insertError) throw insertError;

      // Advance workflow
      const relatedCPO = customerPOs?.find((po: any) => po.id === selectedCustomerPO);
      const quoteId = relatedCPO?.quote_id;
      if (quoteId) {
        let projectId = null;
        if (needsProject) {
          const customerName = relatedCPO?.quotes?.customer_name || "Unknown";
          const quoteNumber = relatedCPO?.quotes?.quote_number || companyPONumber;
          
          const { data: projectData, error: projectError } = await supabase.functions.invoke(
            'create-project-from-order',
            {
              body: { customerName, quoteNumber },
            }
          );
          
          if (!projectError && projectData?.project) {
            projectId = projectData.project.id;
          }
        }
        
        await supabase
          .from("workflow_tracker")
          .update({ 
            company_po_id: insertedCompanyPO.id, 
            current_stage: "company_po_uploaded",
            project_id: projectId
          })
          .eq("quote_id", quoteId);

        // Notify Orders team
        const { data: ordersUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("department_role", "orders");
        
        if (ordersUsers && ordersUsers.length > 0) {
          const notifications = ordersUsers.map(u => ({
            user_id: u.user_id,
            title: "Company PO Created - Awaiting Waybill",
            message: `Company PO created for quote ${relatedCPO?.quotes?.quote_number}. Please create waybill.`,
            related_type: "workflow",
            related_id: quoteId,
          }));
          
          await createNotifications(notifications);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Company PO uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["company-pos"] });
      queryClient.invalidateQueries({ queryKey: ["existing-company-pos"] });
      setSelectedCustomerPO("");
      setCompanyPONumber("");
      setDistributorName("");
      setCompanyPOFile(null);
      setNeedsProject(false);
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
    <DashboardLayout title="Upload Company PO">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Company Purchase Order
            </CardTitle>
            <CardDescription>
              Link a company PO to a customer purchase order
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Customer PO</Label>
              <select
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={selectedCustomerPO}
                onChange={(e) => setSelectedCustomerPO(e.target.value)}
              >
                <option value="">Select a customer PO...</option>
                {availableCustomerPOs?.map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.quotes?.customer_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Company PO Number</Label>
              <Input
                value={companyPONumber}
                onChange={(e) => setCompanyPONumber(e.target.value)}
                placeholder="CPO-2025-001"
              />
            </div>

            <div className="space-y-2">
              <Label>Distributor Name</Label>
              <Input
                value={distributorName}
                onChange={(e) => setDistributorName(e.target.value)}
                placeholder="Distributor Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label>Company PO File</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setCompanyPOFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="needs-project"
                checked={needsProject}
                onCheckedChange={(checked) => setNeedsProject(checked as boolean)}
              />
              <Label htmlFor="needs-project" className="text-sm">
                This order requires project implementation
              </Label>
            </div>

            <Button
              onClick={() => uploadCompanyPOMutation.mutate()}
              disabled={!selectedCustomerPO || !companyPONumber || !distributorName || !companyPOFile || uploadCompanyPOMutation.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadCompanyPOMutation.isPending ? "Uploading..." : "Upload Company PO"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadCompanyPO;
