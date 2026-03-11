import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Package, FileText, Download, Search, Eye, Plus, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WaybillTemplate } from "@/components/waybill/WaybillTemplate";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeliveryManagement from "@/components/orders/DeliveryManagement";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createNotifications } from "@/lib/notifications";
import WelcomeHeader from "@/components/layout/WelcomeHeader";

const OrdersDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerPO, setSelectedCustomerPO] = useState("");
  const [companyPONumber, setCompanyPONumber] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [companyPOFile, setCompanyPOFile] = useState<File | null>(null);
  const [needsProject, setNeedsProject] = useState(false);
  
  // Waybill now tied to Customer PO
  const [selectedCustomerPOForWaybill, setSelectedCustomerPOForWaybill] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [waybillItems, setWaybillItems] = useState<Array<{ qty: string; reference: string; description: string }>>([
    { qty: "", reference: "", description: "" }
  ]);
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [showWaybillPreview, setShowWaybillPreview] = useState(false);
  const [isParsingPO, setIsParsingPO] = useState(false);

  // Distributor invoice states
  const [selectedCompanyPOForDist, setSelectedCompanyPOForDist] = useState("");
  const [distInvoiceNumber, setDistInvoiceNumber] = useState("");
  const [distInvoiceFile, setDistInvoiceFile] = useState<File | null>(null);

  // Distributor management
  const [showAddDistributor, setShowAddDistributor] = useState(false);
  const [newDistributorName, setNewDistributorName] = useState("");

  const { data: distributors } = useQuery({
    queryKey: ["distributors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("distributors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: customerPOs } = useQuery({
    queryKey: ["customer-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pos")
        .select("*, quotes(*), workflow_tracker(project_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companyPOs } = useQuery({
    queryKey: ["company-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_pos")
        .select(`
          *, 
          customer_pos(*, quotes(*)),
          distributor_quotes(id, quote_number, file_path, file_name),
          distributor_invoices(id, invoice_number, file_path, file_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: waybills } = useQuery({
    queryKey: ["waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select(`
          *, 
          company_pos(
            *, 
            customer_pos(*, quotes(*)),
            distributor_quotes(id, quote_number, file_path, file_name),
            distributor_invoices(id, invoice_number, file_path, file_name)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "Download failed", description: error.message });
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download failed", description: err.message || 'Unknown error' });
    }
  };

  const viewFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
      if (error) {
        toast({ variant: "destructive", title: "View failed", description: error.message });
        return;
      }
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "View failed", description: err.message || 'Unknown error' });
    }
  };

  const addDistributorMutation = useMutation({
    mutationFn: async () => {
      if (!newDistributorName.trim() || !user) throw new Error("Distributor name is required");
      const { error } = await supabase.from("distributors").insert({
        name: newDistributorName.trim(),
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Distributor added successfully" });
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setNewDistributorName("");
      setShowAddDistributor(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

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

      const relatedCPO: any = customerPOs?.find((po: any) => po.id === selectedCustomerPO);
      const quoteId = relatedCPO?.quote_id;
      if (quoteId) {
        let projectId = null;
        if (needsProject) {
          const customerName = relatedCPO?.quotes?.customer_name || "Unknown";
          const quoteNumber = relatedCPO?.quotes?.quote_number || companyPONumber;
          
          const { data: projectData, error: projectError } = await supabase.functions.invoke(
            'create-project-from-order',
            { body: { customerName, quoteNumber } }
          );
          
          if (projectError) {
            toast({ title: "Warning", description: "Company PO uploaded but project creation failed.", variant: "destructive" });
          } else if (projectData?.project) {
            projectId = projectData.project.id;
          }
        }
        
        const { error: wfUpdateError } = await supabase
          .from("workflow_tracker")
          .update({ company_po_id: insertedCompanyPO.id, current_stage: "company_po_uploaded", project_id: projectId })
          .eq("quote_id", quoteId);
        if (wfUpdateError) throw wfUpdateError;

        try {
          const { data: ordersUsers } = await supabase.from("user_roles").select("user_id").eq("department_role", "orders");
          if (ordersUsers && ordersUsers.length > 0) {
            const notifications = ordersUsers.map(u => ({
              user_id: u.user_id,
              title: "Company PO Created - Awaiting Waybill",
              message: `Company PO created for quote ${relatedCPO?.quotes?.quote_number || companyPONumber}. Please create waybill.`,
              related_type: "workflow",
              related_id: quoteId,
            }));
            await createNotifications(notifications);
          }
        } catch (notifyError) {
          console.error('Notification error:', notifyError);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Company PO uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["company-pos"] });
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

  const uploadDistributorInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCompanyPOForDist || !distInvoiceFile || !distInvoiceNumber) {
        throw new Error("Missing required data");
      }

      const filePath = `${user.id}/${Date.now()}_${distInvoiceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, distInvoiceFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("distributor_invoices").insert({
        company_po_id: selectedCompanyPOForDist,
        invoice_number: distInvoiceNumber,
        file_name: distInvoiceFile.name,
        file_path: filePath,
        uploaded_by: user.id,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({ title: "Distributor invoice uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["distributor-invoices"] });
      setSelectedCompanyPOForDist("");
      setDistInvoiceNumber("");
      setDistInvoiceFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    },
  });

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

  const createWaybillMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCustomerPOForWaybill) throw new Error("Missing required data");

      // Find the company PO linked to this customer PO
      const relatedCompanyPO = companyPOs?.find((cpo: any) => cpo.customer_po_id === selectedCustomerPOForWaybill);
      if (!relatedCompanyPO) throw new Error("No company PO found for this customer PO");

      const waybillElement = document.getElementById('waybill-preview-content');
      if (!waybillElement) throw new Error("Waybill template not found");

      const canvas = await html2canvas(waybillElement, { 
        scale: 2, useCORS: true, logging: false,
        width: waybillElement.scrollWidth, height: waybillElement.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, pdfBlob);
      if (uploadError) throw uploadError;

      const productDetails = waybillItems.filter(item => item.description)
        .map(item => `${item.qty} ${item.reference} - ${item.description}`).join("; ");
      const serialNumbers = waybillItems.filter(item => item.reference).map(item => item.reference);

      const { data: waybill, error } = await supabase.from("waybills").insert({
        company_po_id: relatedCompanyPO.id,
        waybill_number: waybillNumber,
        product_details: productDetails,
        serial_numbers: serialNumbers,
        created_by: user.id,
        file_path: filePath,
        file_name: fileName,
        total_items_ordered: waybillItems.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0),
      }).select().single();

      if (error) throw error;

      const waybillItemsToInsert = waybillItems.filter(item => item.description).map(item => ({
        waybill_id: waybill.id,
        company_po_id: relatedCompanyPO.id,
        quantity: parseInt(item.qty) || 1,
        reference: item.reference || null,
        serial_number: item.reference || null,
        description: item.description,
      }));

      if (waybillItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from("waybill_items").insert(waybillItemsToInsert);
        if (itemsError) console.error("Error creating waybill items:", itemsError);
      }

      // Advance workflow
      const relatedCPO: any = customerPOs?.find((po: any) => po.id === selectedCustomerPOForWaybill);
      const quoteIdWB = relatedCPO?.quote_id;
      if (quoteIdWB) {
        const { data: workflow } = await supabase
          .from("workflow_tracker")
          .select("project_id, quotes(quote_number, customer_name)")
          .eq("quote_id", quoteIdWB)
          .single();
        
        const newStage = workflow?.project_id ? "awaiting_project_completion" : "waybill_created";
        await supabase.from("workflow_tracker").update({ current_stage: newStage }).eq("quote_id", quoteIdWB);

        const targetRole = workflow?.project_id ? 'projects' : 'finance';
        try {
          const { data: targetUsers } = await supabase.from("user_roles").select("user_id").eq("department_role", targetRole);
          if (targetUsers && targetUsers.length > 0) {
            const message = workflow?.project_id
              ? `Waybill created for quote ${workflow?.quotes?.quote_number}. Project implementation required.`
              : `Waybill created for quote ${workflow?.quotes?.quote_number}. Ready for invoice generation.`;
            const notifications = targetUsers.map(u => ({
              user_id: u.user_id,
              title: workflow?.project_id ? "New Project Assignment" : "Waybill Created - Ready for Invoice",
              message, related_type: "workflow", related_id: quoteIdWB,
            }));
            await createNotifications(notifications);
          }
        } catch (notifyError) {
          console.error('Notification error:', notifyError);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Waybill created successfully" });
      queryClient.invalidateQueries({ queryKey: ["waybills"] });
      setShowWaybillPreview(false);
      setSelectedCustomerPOForWaybill("");
      setWaybillNumber("");
      setWaybillItems([{ qty: "", reference: "", description: "" }]);
      setToName("");
      setToAddress("");
      setIssuedBy("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Get selected items for view buttons
  const selectedCPO = customerPOs?.find((po: any) => po.id === selectedCustomerPO);
  const selectedCPOForWB = customerPOs?.find((po: any) => po.id === selectedCustomerPOForWaybill);
  const selectedCompanyPOObj = companyPOs?.find((po: any) => po.id === selectedCompanyPOForDist);

  // Customer POs available for waybill (must have a company PO and no waybill yet)
  const customerPOsForWaybill = customerPOs?.filter((cpo: any) => {
    const hasCompanyPO = companyPOs?.some((companyPO: any) => companyPO.customer_po_id === cpo.id);
    const relatedCompanyPO = companyPOs?.find((companyPO: any) => companyPO.customer_po_id === cpo.id);
    const hasWaybill = relatedCompanyPO ? waybills?.some((wb: any) => wb.company_po_id === relatedCompanyPO.id) : false;
    return hasCompanyPO && !hasWaybill;
  });

  return (
    <div className="space-y-6">
      <WelcomeHeader
        pageDescription="Process company POs, create waybills, track deliveries, and manage order fulfillment."
        features={["Company POs", "Waybills", "Deliveries", "Order Lookup"]}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Orders Dashboard</h2>
        <Button onClick={() => navigate("/all-waybills")}>
          <Package className="h-4 w-4 mr-2" />
          View All Waybills
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Company PO</CardTitle>
            <CardDescription>Upload purchase order to distributor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="select-customer-po">Select Customer PO</Label>
              <select
                id="select-customer-po"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={selectedCustomerPO}
                onChange={(e) => setSelectedCustomerPO(e.target.value)}
              >
                <option value="">Select customer PO...</option>
                {customerPOs
                  ?.filter((po) => {
                    const hasCompanyPO = companyPOs?.some((companyPO) => companyPO.customer_po_id === po.id);
                    return !hasCompanyPO;
                  })
                  .map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.quotes?.customer_name}
                    </option>
                  ))}
              </select>
            </div>
            {selectedCPO && (
              <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedCPO.file_path)}>
                <Eye className="h-4 w-4 mr-1" /> View Selected Customer PO
              </Button>
            )}
            <div className="space-y-2">
              <Label htmlFor="company-po-number">Company PO Number</Label>
              <Input
                id="company-po-number"
                value={companyPONumber}
                onChange={(e) => setCompanyPONumber(e.target.value)}
                placeholder="CPO-2025-001"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="distributor-name">Distributor Name</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddDistributor(true)} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> New Distributor
                </Button>
              </div>
              {distributors && distributors.length > 0 ? (
                <select
                  id="distributor-name"
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                >
                  <option value="">Select a distributor...</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id="distributor-name"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  placeholder="XYZ Distributors"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-po-file">Company PO PDF</Label>
              <Input
                id="company-po-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setCompanyPOFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="needs-project"
                checked={needsProject}
                onChange={(e) => setNeedsProject(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="needs-project" className="text-sm font-normal cursor-pointer">
                This order needs project implementation
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

        <Card>
          <CardHeader>
            <CardTitle>Create Waybill</CardTitle>
            <CardDescription>Generate waybill from a customer PO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="select-customer-po-wb">Select Customer PO</Label>
              <select
                id="select-customer-po-wb"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={selectedCustomerPOForWaybill}
                onChange={async (e) => {
                  const cpoId = e.target.value;
                  setSelectedCustomerPOForWaybill(cpoId);
                  
                  if (cpoId) {
                    const selectedCPO = customerPOs?.find((po: any) => po.id === cpoId);
                    const relatedCompanyPO = companyPOs?.find((cpo: any) => cpo.customer_po_id === cpoId);
                    
                    if (selectedCPO && relatedCompanyPO) {
                      // Auto-fill customer name
                      setToName(selectedCPO.quotes?.customer_name || '');
                      
                      // Auto-generate waybill number
                      const currentYear = new Date().getFullYear();
                      const { data: yearWaybills } = await supabase
                        .from("waybills")
                        .select("waybill_number")
                        .like("waybill_number", `WB-${currentYear}-%`);
                      
                      let maxNumber = 0;
                      yearWaybills?.forEach((wb) => {
                        const match = wb.waybill_number.match(/WB-\d{4}-(\d+)/);
                        if (match) {
                          const num = parseInt(match[1], 10);
                          if (num > maxNumber) maxNumber = num;
                        }
                      });
                      const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
                      setWaybillNumber(`WB-${currentYear}-${nextNumber}`);

                      // Parse customer PO document for items
                      if (selectedCPO.file_path) {
                        setIsParsingPO(true);
                        setWaybillItems([{ qty: "", reference: "", description: "Parsing document..." }]);
                        try {
                          const { data, error } = await supabase.functions.invoke('parse-company-po', {
                            body: { companyPoId: relatedCompanyPO.id, filePath: selectedCPO.file_path }
                          });
                          if (error) {
                            toast({ title: "PDF Parsing Failed", description: "Please enter items manually.", variant: "destructive" });
                            setWaybillItems([{ qty: "1", reference: "", description: "" }]);
                          } else if (data?.items && data.items.length > 0) {
                            const mappedItems = data.items.map((item: any) => ({
                              qty: item.qty?.toString() || "1",
                              reference: "",
                              description: item.serialNumber || item.description || "",
                            }));
                            setWaybillItems(mappedItems);
                            if (data.customerAddress) setToAddress(data.customerAddress);
                            toast({ title: "Document parsed successfully", description: `Found ${data.items.length} item(s)` });
                          } else {
                            setWaybillItems([{ qty: "1", reference: "", description: "" }]);
                          }
                        } catch (parseError) {
                          setWaybillItems([{ qty: "1", reference: "", description: "" }]);
                        } finally {
                          setIsParsingPO(false);
                        }
                      }
                    }
                  } else {
                    setToName('');
                    setToAddress('');
                    setWaybillNumber('');
                    setWaybillItems([{ qty: "", reference: "", description: "" }]);
                  }
                }}
              >
                <option value="">Select customer PO...</option>
                {customerPOsForWaybill?.map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.quotes?.customer_name}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedCPOForWB && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedCPOForWB.file_path)}>
                  <Eye className="h-4 w-4 mr-1" /> View Customer PO
                </Button>
                {(() => {
                  const relatedCoPO = companyPOs?.find((cpo: any) => cpo.customer_po_id === selectedCPOForWB.id);
                  return relatedCoPO ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => viewFile(relatedCoPO.file_path)}>
                      <Eye className="h-4 w-4 mr-1" /> View Company PO
                    </Button>
                  ) : null;
                })()}
              </div>
            )}

            {selectedCustomerPOForWaybill && (() => {
              const relatedCoPO = companyPOs?.find((cpo: any) => cpo.customer_po_id === selectedCustomerPOForWaybill);
              if (!relatedCoPO) return null;
              return (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="font-medium text-sm">Order Details (Auto-populated)</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{selectedCPOForWB?.quotes?.customer_name || 'N/A'}</span></div>
                    <div><span className="text-muted-foreground">Quote #:</span> <span className="font-medium">{selectedCPOForWB?.quotes?.quote_number || 'N/A'}</span></div>
                    <div><span className="text-muted-foreground">Customer PO:</span> <span className="font-medium">{selectedCPOForWB?.po_number || 'N/A'}</span></div>
                    <div><span className="text-muted-foreground">Company PO:</span> <span className="font-medium">{relatedCoPO.po_number}</span></div>
                    <div><span className="text-muted-foreground">Distributor:</span> <span className="font-medium">{relatedCoPO.distributor_name}</span></div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label htmlFor="waybill-number">Waybill Number</Label>
              <Input
                id="waybill-number"
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                placeholder="WB-2025-0001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="to-name">To (Name)</Label>
                <Input id="to-name" value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Company/Person name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-address">Address</Label>
                <Input id="to-address" value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder="Delivery address" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issued-by">Issued By</Label>
              <Input id="issued-by" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Your name" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Waybill Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWaybillItem}>Add Item</Button>
              </div>
              {waybillItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input placeholder="QTY" value={item.qty} onChange={(e) => updateWaybillItem(index, "qty", e.target.value)} className="w-20" />
                  <Input placeholder="Reference/Serial" value={item.reference} onChange={(e) => updateWaybillItem(index, "reference", e.target.value)} className="w-40" />
                  <Input placeholder="Description" value={item.description} onChange={(e) => updateWaybillItem(index, "description", e.target.value)} className="flex-1" />
                  {waybillItems.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeWaybillItem(index)}>Remove</Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={() => setShowWaybillPreview(true)}
              disabled={!selectedCustomerPOForWaybill || !waybillNumber || !toName}
              className="w-full"
            >
              <Package className="mr-2 h-4 w-4" />
              Preview & Create Waybill
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Distributor Invoice</CardTitle>
          <CardDescription>Upload invoice received from distributor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="select-company-po-inv">Select Company PO</Label>
            <select
              id="select-company-po-inv"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedCompanyPOForDist}
              onChange={(e) => setSelectedCompanyPOForDist(e.target.value)}
            >
              <option value="">Select company PO...</option>
              {companyPOs?.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.distributor_name}
                </option>
              ))}
            </select>
          </div>
          {selectedCompanyPOObj && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedCompanyPOObj.file_path)}>
                <Eye className="h-4 w-4 mr-1" /> View Company PO
              </Button>
              {selectedCompanyPOObj.customer_pos?.file_path && (
                <Button type="button" variant="outline" size="sm" onClick={() => viewFile(selectedCompanyPOObj.customer_pos.file_path)}>
                  <Eye className="h-4 w-4 mr-1" /> View Customer PO
                </Button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="dist-invoice-number">Distributor Invoice Number</Label>
            <Input
              id="dist-invoice-number"
              value={distInvoiceNumber}
              onChange={(e) => setDistInvoiceNumber(e.target.value)}
              placeholder="DI-2025-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dist-invoice-file">Invoice File</Label>
            <Input
              id="dist-invoice-file"
              type="file"
              onChange={(e) => setDistInvoiceFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>
          <Button
            onClick={() => uploadDistributorInvoiceMutation.mutate()}
            disabled={!selectedCompanyPOForDist || !distInvoiceNumber || !distInvoiceFile || uploadDistributorInvoiceMutation.isPending}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadDistributorInvoiceMutation.isPending ? "Uploading..." : "Upload Distributor Invoice"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Order Updates</CardTitle>
              <CardDescription>Latest order activities and status changes</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate("/order-lookup")}>
              <Search className="h-4 w-4 mr-2" />
              Search & Download Documents
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {customerPOs?.slice(0, 10).map((po) => {
              const relatedCompanyPO = companyPOs?.find((cpo) => cpo.customer_po_id === po.id);
              const relatedWaybill = waybills?.find((wb) => wb.company_pos?.customer_pos?.id === po.id);
              const relatedWorkflow = po.workflow_tracker?.[0];
              const hasProject = relatedWorkflow?.project_id != null;
              
              let status = "Customer PO Received";
              let statusVariant: "default" | "secondary" | "outline" | "destructive" = "outline";
              
              if (relatedWaybill) {
                if (relatedWaybill.delivery_status === 'fully_delivered') { status = "Fully Delivered"; statusVariant = "default"; }
                else if (relatedWaybill.delivery_status === 'partially_delivered') { status = "Partially Delivered"; statusVariant = "secondary"; }
                else { status = "Waybill Created"; statusVariant = "secondary"; }
              } else if (relatedCompanyPO) {
                status = "Company PO Issued"; statusVariant = "outline";
              }
              
              return (
                <div key={po.id} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-background">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{po.quotes?.customer_name || 'Unknown Customer'}</span>
                          <Badge variant={statusVariant} className="text-xs">{status}</Badge>
                          {hasProject && <Badge variant="secondary" className="text-xs">Has Project</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          <div>Quote: {po.quotes?.quote_number} • Customer PO: {po.po_number}</div>
                          {relatedCompanyPO && <div>Company PO: {relatedCompanyPO.po_number} • Distributor: {relatedCompanyPO.distributor_name}</div>}
                          {relatedWaybill && <div>Waybill: {relatedWaybill.waybill_number} • Items: {relatedWaybill.total_items_delivered || 0}/{relatedWaybill.total_items_ordered || 0} delivered</div>}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(po.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
            {(!customerPOs || customerPOs.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">No orders yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Waybill Preview Dialog */}
      <Dialog open={showWaybillPreview} onOpenChange={setShowWaybillPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex justify-end gap-2 mt-4 print:hidden">
            <Button variant="outline" onClick={() => setShowWaybillPreview(false)}>Cancel</Button>
            <Button onClick={() => createWaybillMutation.mutate()} disabled={createWaybillMutation.isPending}>
              {createWaybillMutation.isPending ? "Creating..." : "Confirm & Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Distributor Dialog */}
      <Dialog open={showAddDistributor} onOpenChange={setShowAddDistributor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Add New Distributor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Distributor Name</Label>
              <Input
                value={newDistributorName}
                onChange={(e) => setNewDistributorName(e.target.value)}
                placeholder="Enter distributor name"
              />
            </div>
            <Button
              onClick={() => addDistributorMutation.mutate()}
              disabled={!newDistributorName.trim() || addDistributorMutation.isPending}
              className="w-full"
            >
              {addDistributorMutation.isPending ? "Adding..." : "Add Distributor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersDashboard;
