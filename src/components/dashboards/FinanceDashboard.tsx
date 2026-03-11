import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertCircle, Download, FileText, Receipt, Search, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExpensePaymentManagement from "@/components/expenses/ExpensePaymentManagement";
import { WorkflowVisual } from "@/components/workflow/WorkflowVisual";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import { Badge } from "@/components/ui/badge";

const FinanceDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceType, setInvoiceType] = useState("full");
  const [invoiceComments, setInvoiceComments] = useState("");

  // Fetch ALL workflows (not just completed ones) for flexible invoicing
  const { data: allOrders } = useQuery({
    queryKey: ["all-orders-finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(*),
          customer_pos(*),
          company_pos(*),
          projects(project_name, project_number, status, documentation_path)
        `)
        .not("company_po_id", "is", null);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: waybills } = useQuery({
    queryKey: ["waybills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("waybills").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: distributorQuotes } = useQuery({
    queryKey: ["distributor-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("distributor_quotes").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: distributorInvoices } = useQuery({
    queryKey: ["distributor-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("distributor_invoices").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, quotes(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const downloadFile = async (filePath: string | null | undefined, fileName: string | null | undefined) => {
    try {
      if (!filePath || !fileName) {
        toast({ variant: "destructive", title: "Download failed", description: "File path or name is missing" });
        return;
      }
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "Download failed", description: error.message });
        return;
      }
      if (!data) {
        toast({ variant: "destructive", title: "Download failed", description: "No file data received" });
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

  const viewFile = async (filePath: string | null | undefined) => {
    try {
      if (!filePath) {
        toast({ variant: "destructive", title: "View failed", description: "File path is missing" });
        return;
      }
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

  const uploadInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedOrder || !invoiceFile) throw new Error("Missing required data");

      const filePath = `${user.id}/${Date.now()}_${invoiceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, invoiceFile);

      if (uploadError) throw uploadError;

      const { data: insertedInvoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          quote_id: selectedOrder.quote_id,
          customer_po_id: selectedOrder.customer_po_id,
          company_po_id: selectedOrder.company_po_id,
          invoice_number: invoiceNumber,
          amount: parseFloat(amount),
          generated_by: user.id,
          file_path: filePath,
          file_name: invoiceFile.name,
          invoice_type: invoiceType,
          comments: invoiceComments || null,
        })
        .select("id, quote_id")
        .single();

      if (insertError) throw insertError;

      // Only advance workflow to invoice_generated for full invoices on completed orders
      if (invoiceType === "full") {
        const { error: wfUpdateError } = await supabase
          .from("workflow_tracker")
          .update({ invoice_id: insertedInvoice.id, current_stage: "invoice_generated" })
          .eq("quote_id", insertedInvoice.quote_id);
        if (wfUpdateError) throw wfUpdateError;
      }
    },
    onSuccess: () => {
      toast({ title: "Invoice uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders-finance"] });
      setSelectedOrder(null);
      setInvoiceNumber("");
      setAmount("");
      setInvoiceFile(null);
      setInvoiceType("full");
      setInvoiceComments("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Get existing invoices for the selected order
  const selectedOrderInvoices = selectedOrder ? invoices?.filter(inv => inv.quote_id === selectedOrder.quote_id) : [];

  return (
    <div className="space-y-6">
      <WelcomeHeader
        pageDescription="Generate invoices, manage expense payments, and track financial workflows."
        features={["Invoice Management", "Expense Payments", "Order Lookup"]}
      />
      <div className="flex items-center justify-end">
        <Button onClick={() => navigate("/order-lookup")} variant="outline">
          <Search className="h-4 w-4 mr-2" />
          Order Lookup
        </Button>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices">Invoice Management</TabsTrigger>
          <TabsTrigger value="expenses">
            <Receipt className="h-4 w-4 mr-2" />
            Expense Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Invoice</CardTitle>
              <CardDescription>
                Generate invoices for orders — supports full, partial, and pre-completion invoicing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="select-order">Select Order</Label>
                <select
                  id="select-order"
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={selectedOrder?.id || ""}
                  onChange={(e) => {
                    const order = allOrders?.find(o => o.id === e.target.value);
                    setSelectedOrder(order || null);
                  }}
                >
                  <option value="">Select an order...</option>
                  {allOrders?.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.quotes?.quote_number} - {order.quotes?.customer_name} [{order.current_stage.replace(/_/g, ' ')}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedOrder && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Order Details:</div>
                    <Badge variant={
                      selectedOrder.current_stage === "invoice_generated" ? "default" :
                      selectedOrder.current_stage === "project_completed" || selectedOrder.current_stage === "waybill_created" ? "secondary" :
                      "outline"
                    } className="text-xs">
                      {selectedOrder.current_stage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>Quote: {selectedOrder.quotes?.quote_number}</div>
                    <div>Customer: {selectedOrder.quotes?.customer_name}</div>
                    <div>Customer PO: {selectedOrder.customer_pos?.po_number}</div>
                    <div>Company PO: {selectedOrder.company_pos?.po_number}</div>
                    {selectedOrder.projects && (
                      <div className="font-medium text-primary">
                        Project: {selectedOrder.projects.project_number} - {selectedOrder.projects.project_name}
                        <Badge variant={selectedOrder.projects.status === "completed" ? "default" : "outline"} className="ml-2 text-xs">
                          {selectedOrder.projects.status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Show existing invoices for this order */}
                  {selectedOrderInvoices && selectedOrderInvoices.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <div className="text-sm font-medium text-muted-foreground mb-1">Previous Invoices:</div>
                      {selectedOrderInvoices.map((inv) => (
                        <div key={inv.id} className="text-sm flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{(inv as any).invoice_type || 'full'}</Badge>
                          <span>{inv.invoice_number} — {currency} {inv.amount}</span>
                          {(inv as any).comments && <span className="text-muted-foreground italic">"{(inv as any).comments}"</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 flex-wrap">
                    {selectedOrder.quotes?.file_path && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => viewFile(selectedOrder.quotes.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />View Quote
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(selectedOrder.quotes.file_path, selectedOrder.quotes.file_name)}>
                          <Download className="h-4 w-4 mr-1" />Quote
                        </Button>
                      </>
                    )}
                    {selectedOrder.customer_pos?.file_path && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => viewFile(selectedOrder.customer_pos.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />View CPO
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(selectedOrder.customer_pos.file_path, selectedOrder.customer_pos.file_name)}>
                          <Download className="h-4 w-4 mr-1" />Customer PO
                        </Button>
                      </>
                    )}
                    {selectedOrder.company_pos?.file_path && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => viewFile(selectedOrder.company_pos.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />View CoPO
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(selectedOrder.company_pos.file_path, selectedOrder.company_pos.file_name)}>
                          <Download className="h-4 w-4 mr-1" />Company PO
                        </Button>
                      </>
                    )}
                    {selectedOrder.company_pos && waybills?.find(w => w.company_po_id === selectedOrder.company_po_id)?.file_path && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => {
                          const wb = waybills.find(w => w.company_po_id === selectedOrder.company_po_id);
                          if (wb?.file_path) viewFile(wb.file_path);
                        }}>
                          <Eye className="h-4 w-4 mr-1" />View WB
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const wb = waybills.find(w => w.company_po_id === selectedOrder.company_po_id);
                          if (wb?.file_path && wb?.file_name) downloadFile(wb.file_path, wb.file_name);
                        }}>
                          <Download className="h-4 w-4 mr-1" />Waybill
                        </Button>
                      </>
                    )}
                    {(() => {
                      const dq = distributorQuotes?.find(dq => dq.company_po_id === selectedOrder.company_po_id);
                      return dq?.file_path && dq?.file_name ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => viewFile(dq.file_path)}>
                            <Eye className="h-4 w-4 mr-1" />View DQ
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadFile(dq.file_path, dq.file_name)}>
                            <Download className="h-4 w-4 mr-1" />Dist. Quote
                          </Button>
                        </>
                      ) : null;
                    })()}
                    {(() => {
                      const di = distributorInvoices?.find(di => di.company_po_id === selectedOrder.company_po_id);
                      return di?.file_path && di?.file_name ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => viewFile(di.file_path)}>
                            <Eye className="h-4 w-4 mr-1" />View DI
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadFile(di.file_path, di.file_name)}>
                            <Download className="h-4 w-4 mr-1" />Dist. Invoice
                          </Button>
                        </>
                      ) : null;
                    })()}
                  </div>
                  
                  <WorkflowVisual 
                    currentStage={selectedOrder.current_stage}
                    hasProject={!!selectedOrder.project_id}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invoice-type">Invoice Type</Label>
                <select
                  id="invoice-type"
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                >
                  <option value="full">Full Invoice</option>
                  <option value="partial">Partial Invoice</option>
                  <option value="advance">Advance Payment Invoice</option>
                  <option value="proforma">Proforma Invoice</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-number">Invoice Number</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2025-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="GHS">GHS (₵)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-comments">Comments / Notes</Label>
                <Textarea
                  id="invoice-comments"
                  value={invoiceComments}
                  onChange={(e) => setInvoiceComments(e.target.value)}
                  placeholder="e.g., Partial payment for delivered items, advance payment before project starts..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-file">Invoice PDF</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button
                onClick={() => uploadInvoiceMutation.mutate()}
                disabled={!selectedOrder || !invoiceNumber || !amount || !invoiceFile || uploadInvoiceMutation.isPending}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadInvoiceMutation.isPending ? "Uploading..." : "Upload Invoice"}
              </Button>

              {allOrders?.length === 0 && (
                <div className="flex items-center gap-2 p-4 bg-accent text-accent-foreground rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <div className="text-sm">No orders with company POs available for invoicing.</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices?.map((invoice) => (
                  <div key={invoice.id} className="p-4 border rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{invoice.invoice_number}</span>
                            <Badge variant="outline" className="text-xs">{(invoice as any).invoice_type || 'full'}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.quotes?.customer_name} - {currency} {invoice.amount}
                          </div>
                          {(invoice as any).comments && (
                            <div className="text-sm text-muted-foreground italic mt-1">
                              "{(invoice as any).comments}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {!invoices?.length && (
                  <div className="text-center text-muted-foreground py-8">No invoices uploaded yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensePaymentManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceDashboard;
