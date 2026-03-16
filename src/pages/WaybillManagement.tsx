import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { WaybillTemplate } from "@/components/waybill/WaybillTemplate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Trash2, Eye } from "lucide-react";
import { createNotifications } from "@/lib/notifications";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const WaybillManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCustomerPO, setSelectedCustomerPO] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [waybillItems, setWaybillItems] = useState<Array<{ qty: string; reference: string; description: string }>>([
    { qty: "", reference: "", description: "" }
  ]);
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [showWaybillPreview, setShowWaybillPreview] = useState(false);
  const [isParsingPO, setIsParsingPO] = useState(false);
  const [needsProject, setNeedsProject] = useState(false);

  const { data: customerPOs } = useQuery({
    queryKey: ["customer-pos-for-waybill"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pos")
        .select(`
          *, 
          quotes(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get company POs linked to customer POs for waybill creation
  const { data: companyPOs } = useQuery({
    queryKey: ["company-pos-linked", selectedCustomerPO],
    queryFn: async () => {
      if (!selectedCustomerPO) return [];
      const { data, error } = await supabase
        .from("company_pos")
        .select("*")
        .eq("customer_po_id", selectedCustomerPO);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerPO,
  });

  // Filter customer POs that don't have waybills yet (via their company POs)
  const { data: existingWaybills } = useQuery({
    queryKey: ["existing-waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("company_po_id");
      if (error) throw error;
      return data;
    },
  });

  // Get company_po_ids that already have waybills
  const usedCompanyPOIds = new Set(existingWaybills?.map(wb => wb.company_po_id) || []);
  
  // A customer PO is available if it has at least one company PO without a waybill
  const availableCustomerPOs = customerPOs?.filter(cpo => {
    // We show all customer POs - filtering happens at company PO level
    return true;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || !userRole) {
    navigate("/auth");
    return null;
  }

  const addWaybillItem = () => {
    setWaybillItems([...waybillItems, { qty: "", reference: "", description: "" }]);
  };

  const updateWaybillItem = (index: number, field: string, value: string) => {
    const updated = [...waybillItems];
    updated[index] = { ...updated[index], [field]: value };
    setWaybillItems(updated);
  };

  const removeWaybillItem = (index: number) => {
    if (waybillItems.length > 1) {
      setWaybillItems(waybillItems.filter((_, i) => i !== index));
    }
  };

  const parsePODocument = async () => {
    if (!selectedCustomerPO) return;
    
    setIsParsingPO(true);
    try {
      // Use first linked company PO for parsing
      const linkedCompanyPO = companyPOs?.[0];
      if (!linkedCompanyPO?.file_path) {
        toast({ variant: "destructive", title: "No company PO file to parse" });
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('parse-company-po', {
        body: { filePath: linkedCompanyPO.file_path },
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });

      if (error) throw error;

      if (data?.items && data.items.length > 0) {
        setWaybillItems(data.items.map((item: any) => ({
          qty: item.qty?.toString() || "1",
          reference: item.reference || "",
          description: item.description || "",
        })));
        toast({ title: "PO parsed successfully", description: `Found ${data.items.length} items` });
      }
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({ variant: "destructive", title: "Parse failed", description: error.message });
    } finally {
      setIsParsingPO(false);
    }
  };

  const createWaybill = async () => {
    if (!user || !selectedCustomerPO) {
      toast({ variant: "destructive", title: "Missing required data" });
      return;
    }

    // Get the linked company PO
    const linkedCompanyPO = companyPOs?.[0];
    if (!linkedCompanyPO) {
      toast({ variant: "destructive", title: "No company PO linked to this customer PO" });
      return;
    }

    try {
      // Generate PDF from waybill template
      const waybillElement = document.getElementById('waybill-preview-content');
      if (!waybillElement) throw new Error("Waybill template not found");

      const canvas = await html2canvas(waybillElement, { 
        scale: 2,
        useCORS: true,
        logging: false,
        width: waybillElement.scrollWidth,
        height: waybillElement.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const pdfBlob = pdf.output('blob');
      const fileName = `waybill_${waybillNumber}_${Date.now()}.pdf`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob);

      if (uploadError) throw uploadError;

      const productDetails = waybillItems
        .filter(item => item.description)
        .map(item => `${item.qty} ${item.reference} - ${item.description}`)
        .join("; ");

      const serialNumbers = waybillItems
        .filter(item => item.reference)
        .map(item => item.reference);

      const { data: waybill, error } = await supabase.from("waybills").insert({
        company_po_id: selectedCompanyPO,
        waybill_number: waybillNumber,
        product_details: productDetails,
        serial_numbers: serialNumbers,
        created_by: user.id,
        file_path: filePath,
        file_name: fileName,
        total_items_ordered: waybillItems.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0),
      }).select().single();

      if (error) throw error;

      // Create waybill items for delivery tracking
      const waybillItemsToInsert = waybillItems
        .filter(item => item.description)
        .map(item => ({
          waybill_id: waybill.id,
          company_po_id: selectedCompanyPO,
          quantity: parseInt(item.qty) || 1,
          reference: item.reference || null,
          serial_number: item.reference || null,
          description: item.description,
        }));

      if (waybillItemsToInsert.length > 0) {
        await supabase.from("waybill_items").insert(waybillItemsToInsert);
      }

      // Update workflow
      const relatedCompanyPO = companyPOs?.find(po => po.id === selectedCompanyPO);
      const quoteId = relatedCompanyPO?.customer_pos?.quote_id;
      if (quoteId) {
        const { data: workflow } = await supabase
          .from("workflow_tracker")
          .select("project_id, quotes(quote_number, customer_name)")
          .eq("quote_id", quoteId)
          .single();
        
        const newStage = workflow?.project_id ? "awaiting_project_completion" : "waybill_created";
        
        await supabase
          .from("workflow_tracker")
          .update({ current_stage: newStage })
          .eq("quote_id", quoteId);

        // Notify appropriate team
        const targetRole = workflow?.project_id ? 'projects' : 'finance';
        const { data: targetUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("department_role", targetRole);
        
        if (targetUsers && targetUsers.length > 0) {
          const message = workflow?.project_id
            ? `Waybill created for quote ${workflow?.quotes?.quote_number}. Project implementation required.`
            : `Waybill created for quote ${workflow?.quotes?.quote_number}. Ready for invoice generation.`;
          
          const notifications = targetUsers.map(u => ({
            user_id: u.user_id,
            title: workflow?.project_id ? "New Project Assignment" : "Waybill Created - Ready for Invoice",
            message,
            related_type: "workflow",
            related_id: quoteId,
          }));
          
          await createNotifications(notifications);
        }
      }

      toast({ title: "Waybill created successfully" });
      queryClient.invalidateQueries({ queryKey: ["waybills"] });
      queryClient.invalidateQueries({ queryKey: ["existing-waybills"] });
      
      // Reset form
      setSelectedCompanyPO("");
      setWaybillNumber("");
      setWaybillItems([{ qty: "", reference: "", description: "" }]);
      setToName("");
      setToAddress("");
      setIssuedBy("");
      setShowWaybillPreview(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <DashboardLayout title="Waybill Management">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Create New Waybill
            </CardTitle>
            <CardDescription>
              Generate waybill for a company PO
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Company PO</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={selectedCompanyPO}
                  onChange={(e) => setSelectedCompanyPO(e.target.value)}
                >
                  <option value="">Select a company PO...</option>
                  {availableCompanyPOs?.map((po: any) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.customer_pos?.quotes?.customer_name} ({po.distributor_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Waybill Number</Label>
                <Input
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                  placeholder="WB-2025-001"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>To (Name)</Label>
                <Input
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  placeholder="Recipient name"
                />
              </div>
              <div className="space-y-2">
                <Label>To (Address)</Label>
                <Input
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="Delivery address"
                />
              </div>
              <div className="space-y-2">
                <Label>Issued By</Label>
                <Input
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>

            {selectedCompanyPO && (
              <Button
                variant="outline"
                onClick={parsePODocument}
                disabled={isParsingPO}
              >
                {isParsingPO ? "Parsing..." : "Auto-fill from PO"}
              </Button>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Waybill Items</Label>
                <Button variant="outline" size="sm" onClick={addWaybillItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {waybillItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    className="w-20"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => updateWaybillItem(index, "qty", e.target.value)}
                  />
                  <Input
                    className="w-40"
                    placeholder="Reference/Serial"
                    value={item.reference}
                    onChange={(e) => updateWaybillItem(index, "reference", e.target.value)}
                  />
                  <Input
                    className="flex-1"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateWaybillItem(index, "description", e.target.value)}
                  />
                  {waybillItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWaybillItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWaybillPreview(true)}
                disabled={!selectedCompanyPO || !waybillNumber}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Waybill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waybill Preview Dialog */}
      <Dialog open={showWaybillPreview} onOpenChange={setShowWaybillPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Waybill Preview</DialogTitle>
          </DialogHeader>
          <div id="waybill-preview-content">
          <WaybillTemplate
            waybillNumber={waybillNumber}
            date={new Date().toLocaleDateString()}
            to={toName}
            address={toAddress}
            items={waybillItems}
            issuedBy={issuedBy}
          />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowWaybillPreview(false)}>
              Cancel
            </Button>
            <Button onClick={createWaybill}>
              Create & Save Waybill
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default WaybillManagement;
