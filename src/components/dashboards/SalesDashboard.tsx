import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Download, Eye, Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createNotifications } from "@/lib/notifications";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import { WorkflowVisual } from "@/components/workflow/WorkflowVisual";
import { Badge } from "@/components/ui/badge";

const downloadFile = async (filePath: string, fileName: string, toast: any) => {
  const { data, error } = await supabase.storage.from("documents").download(filePath);
  if (error) {
    toast({ variant: "destructive", title: "Download failed", description: error.message });
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const viewFile = async (filePath: string, toast: any) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
  if (error) {
    toast({ variant: "destructive", title: "View failed", description: error.message });
    return;
  }
  if (data?.signedUrl) {
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
};

const SalesDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [quoteNumber, setQuoteNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Distributor quote states
  const [selectedCustomerPOForDist, setSelectedCustomerPOForDist] = useState("");
  const [distQuoteNumber, setDistQuoteNumber] = useState("");
  const [distQuoteFile, setDistQuoteFile] = useState<File | null>(null);

  // Customer management
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customerPOs } = useQuery({
    queryKey: ["customer-pos-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pos")
        .select("*, quotes(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: waybills } = useQuery({
    queryKey: ["waybills-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*, company_pos!inner(customer_po_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companyPOs } = useQuery({
    queryKey: ["company-pos-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_pos")
        .select("*, customer_pos(*, quotes(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Workflow tracking data
  const { data: workflows } = useQuery({
    queryKey: ["workflows-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select("*, quotes(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredQuotes = quotes?.filter((quote) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      quote.quote_number?.toLowerCase().includes(query) ||
      quote.customer_name?.toLowerCase().includes(query)
    );
  });

  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerName.trim() || !user) throw new Error("Customer name is required");
      const { error } = await supabase.from("customers").insert({
        name: newCustomerName.trim(),
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Customer added successfully" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setNewCustomerName("");
      setShowAddCustomer(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

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

      const quoteId = insertedQuotes.id;
      const { error: wfError } = await supabase
        .from("workflow_tracker")
        .insert({ quote_id: quoteId, current_stage: "quote_uploaded" });
      if (wfError) throw wfError;
    },
    onSuccess: () => {
      toast({ title: "Quote uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["workflows-sales"] });
      setQuoteNumber("");
      setCustomerName("");
      setQuoteFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadCustomerPOMutation = useMutation({
    mutationFn: async () => {
      if (!poFile || !user || !selectedQuoteId) throw new Error("Missing required data");

      const filePath = `${user.id}/${Date.now()}_${poFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, poFile);

      if (uploadError) throw uploadError;

      const { data: insertedCPO, error: insertError } = await supabase
        .from("customer_pos")
        .insert({
          quote_id: selectedQuoteId,
          po_number: poNumber,
          uploaded_by: user.id,
          file_path: filePath,
          file_name: poFile.name,
        })
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
          const { data: ordersUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("department_role", "orders");
          
          if (ordersUsers && ordersUsers.length > 0) {
            const notifications = ordersUsers.map(u => ({
              user_id: u.user_id,
              title: "New Customer PO Ready",
              message: `Customer PO for quote ${quote.quote_number} (${quote.customer_name}) is ready for company PO creation.`,
              related_type: "workflow",
              related_id: insertedCPO.quote_id,
            }));
            
            await createNotifications(notifications);
          }

          const { data: session } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-workflow-notification', {
            body: {
              workflowId: insertedCPO.quote_id,
              stage: 'customer_po_uploaded',
              quoteNumber: quote.quote_number,
              customerName: quote.customer_name,
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
          }).catch(err => console.log('Email notification failed:', err));
        } catch (notifyError) {
          console.error('Notification error:', notifyError);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Customer PO uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["workflows-sales"] });
      setSelectedQuoteId("");
      setPoNumber("");
      setPoFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadDistributorQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCustomerPOForDist || !distQuoteFile || !distQuoteNumber) {
        throw new Error("Missing required data");
      }

      const filePath = `${user.id}/${Date.now()}_${distQuoteFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, distQuoteFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("distributor_quotes").insert({
        customer_po_id: selectedCustomerPOForDist,
        quote_number: distQuoteNumber,
        file_name: distQuoteFile.name,
        file_path: filePath,
        uploaded_by: user.id,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({ title: "Distributor quote uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["customer-pos-sales"] });
      setSelectedCustomerPOForDist("");
      setDistQuoteNumber("");
      setDistQuoteFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    },
  });

  // Get selected quote for view button
  const selectedQuote = quotes?.find(q => q.id === selectedQuoteId);
  // Get selected customer PO for dist quote view button
  const selectedCPOForDist = customerPOs?.find(po => po.id === selectedCustomerPOForDist);

  return (
    <div className="space-y-6">
      <WelcomeHeader
        pageDescription="Manage quotes, customer POs, and distributor quotes. Track your sales pipeline."
        features={["Upload Quotes", "Link Customer POs", "Track Orders"]}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Quote</CardTitle>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="customer-name">Customer Name</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCustomer(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Customer
                </Button>
              </div>
              {customers && customers.length > 0 ? (
                <select
                  id="customer-name"
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ABC Corporation"
                />
              )}
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

        <Card>
          <CardHeader>
            <CardTitle>Upload Customer PO</CardTitle>
            <CardDescription>Link customer purchase order to a quote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="select-quote">Select Quote</Label>
              <select
                id="select-quote"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
              >
                <option value="">Select a quote...</option>
                {quotes?.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number} - {quote.customer_name}
                  </option>
                ))}
              </select>
            </div>
            {selectedQuote && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => viewFile(selectedQuote.file_path, toast)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Selected Quote
              </Button>
            )}
            <div className="space-y-2">
              <Label htmlFor="po-number">PO Number</Label>
              <Input
                id="po-number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-2025-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-file">Customer PO PDF</Label>
              <Input
                id="po-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setPoFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              onClick={() => uploadCustomerPOMutation.mutate()}
              disabled={!selectedQuoteId || !poNumber || !poFile || uploadCustomerPOMutation.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadCustomerPOMutation.isPending ? "Uploading..." : "Upload Customer PO"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Distributor Quote</CardTitle>
          <CardDescription>Upload quote received from distributor (linked to Customer PO)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="select-customer-po-dist">Select Customer PO</Label>
            <select
              id="select-customer-po-dist"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedCustomerPOForDist}
              onChange={(e) => setSelectedCustomerPOForDist(e.target.value)}
            >
              <option value="">Select customer PO...</option>
              {customerPOs?.map((po: any) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.quotes?.customer_name || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
          {selectedCPOForDist && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => viewFile(selectedCPOForDist.file_path, toast)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Selected Customer PO
            </Button>
          )}
          <div className="space-y-2">
            <Label htmlFor="dist-quote-number">Distributor Quote Number</Label>
            <Input
              id="dist-quote-number"
              value={distQuoteNumber}
              onChange={(e) => setDistQuoteNumber(e.target.value)}
              placeholder="DQ-2025-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dist-quote-file">Quote File</Label>
            <Input
              id="dist-quote-file"
              type="file"
              onChange={(e) => setDistQuoteFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>
          <Button
            onClick={() => uploadDistributorQuoteMutation.mutate()}
            disabled={!selectedCustomerPOForDist || !distQuoteNumber || !distQuoteFile || uploadDistributorQuoteMutation.isPending}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadDistributorQuoteMutation.isPending ? "Uploading..." : "Upload Distributor Quote"}
          </Button>
        </CardContent>
      </Card>

      {/* Workflow Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Order Tracking</CardTitle>
          <CardDescription>Track the progress of your orders through the workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflows?.map((wf) => (
              <div key={wf.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{wf.quotes?.quote_number}</span>
                    <span className="text-muted-foreground ml-2">— {wf.quotes?.customer_name}</span>
                  </div>
                  <Badge variant={wf.current_stage === "completed" || wf.current_stage === "invoice_generated" ? "default" : "outline"} className="text-xs">
                    {wf.current_stage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Badge>
                </div>
                <WorkflowVisual currentStage={wf.current_stage} hasProject={!!wf.project_id} />
              </div>
            ))}
            {(!workflows || workflows.length === 0) && (
              <div className="text-center text-muted-foreground py-8">No orders to track yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotes with Linked Documents</CardTitle>
          <CardDescription>
            <Input
              placeholder="Search quotes by number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-2"
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredQuotes?.map((quote) => {
              const linkedCustomerPO = customerPOs?.find(po => po.quote_id === quote.id);
              const linkedWaybill = linkedCustomerPO 
                ? waybills?.find(wb => wb.company_pos?.customer_po_id === linkedCustomerPO.id)
                : null;
              
              return (
                <div key={quote.id} className="p-4 border rounded space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{quote.quote_number}</div>
                        <div className="text-sm text-muted-foreground">{quote.customer_name}</div>
                        {linkedCustomerPO && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Customer PO: {linkedCustomerPO.po_number}
                          </div>
                        )}
                        {linkedWaybill && (
                          <div className="text-sm text-muted-foreground">
                            Waybill: {linkedWaybill.waybill_number}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewFile(quote.file_path, toast)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadFile(quote.file_path, quote.file_name, toast)}>
                      <Download className="h-4 w-4 mr-1" /> Quote
                    </Button>
                    {linkedCustomerPO && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => viewFile(linkedCustomerPO.file_path, toast)}>
                          <Eye className="h-4 w-4 mr-1" /> View PO
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(linkedCustomerPO.file_path, linkedCustomerPO.file_name, toast)}>
                          <Download className="h-4 w-4 mr-1" /> Customer PO
                        </Button>
                      </>
                    )}
                    {linkedWaybill?.file_path && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => viewFile(linkedWaybill.file_path, toast)}>
                          <Eye className="h-4 w-4 mr-1" /> View WB
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(linkedWaybill.file_path, linkedWaybill.file_name, toast)}>
                          <Download className="h-4 w-4 mr-1" /> Waybill
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {!filteredQuotes?.length && (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? "No matching quotes found" : "No quotes uploaded yet"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Add New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <Button
              onClick={() => addCustomerMutation.mutate()}
              disabled={!newCustomerName.trim() || addCustomerMutation.isPending}
              className="w-full"
            >
              {addCustomerMutation.isPending ? "Adding..." : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDashboard;
