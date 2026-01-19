import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const OrderLookup = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all orders from workflow_tracker
  const { data: allOrders } = useQuery({
    queryKey: ["all-orders-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(quote_number, customer_name, file_path, file_name),
          customer_pos(po_number, file_path, file_name),
          company_pos(id, po_number, file_path, file_name, distributor_name),
          invoices(invoice_number, file_path, file_name),
          projects(project_name, project_number, status, documentation_path)
        `)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch waybills
  const { data: waybills } = useQuery({
    queryKey: ["all-waybills-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch distributor quotes
  const { data: distributorQuotes } = useQuery({
    queryKey: ["all-distributor-quotes-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distributor_quotes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch distributor invoices
  const { data: distributorInvoices } = useQuery({
    queryKey: ["all-distributor-invoices-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distributor_invoices")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Filter orders based on search term - search by PO number, customer name, waybill number
  const filteredOrders = allOrders?.filter((order) => {
    if (!searchTerm) return false;
    const query = searchTerm.toLowerCase();
    
    // Find related waybill for this order
    const relatedWaybill = waybills?.find(w => w.company_po_id === order.company_po_id);
    
    return (
      order.quotes?.quote_number?.toLowerCase().includes(query) ||
      order.quotes?.customer_name?.toLowerCase().includes(query) ||
      order.customer_pos?.po_number?.toLowerCase().includes(query) ||
      order.company_pos?.po_number?.toLowerCase().includes(query) ||
      order.invoices?.invoice_number?.toLowerCase().includes(query) ||
      order.projects?.project_name?.toLowerCase().includes(query) ||
      order.projects?.project_number?.toLowerCase().includes(query) ||
      relatedWaybill?.waybill_number?.toLowerCase().includes(query)
    );
  });

  const handleSearch = () => {
    setSearchTerm(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Download function
  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "File downloaded successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error downloading file", description: error.message });
    }
  };

  // Get workflow stage display
  const getStageDisplay = (stage: string) => {
    const stageMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      quote_uploaded: { label: "Quote Uploaded", variant: "outline" },
      customer_po_uploaded: { label: "Customer PO Uploaded", variant: "outline" },
      company_po_uploaded: { label: "Company PO Uploaded", variant: "secondary" },
      waybill_created: { label: "Waybill Created", variant: "secondary" },
      awaiting_project_completion: { label: "Awaiting Project", variant: "secondary" },
      project_completed: { label: "Project Completed", variant: "secondary" },
      invoice_generated: { label: "Invoice Generated", variant: "default" },
      completed: { label: "Completed", variant: "default" },
    };
    return stageMap[stage] || { label: stage, variant: "outline" };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Order Document Lookup</h1>
          <p className="text-muted-foreground">
            Search and download all documents related to an order
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Orders</CardTitle>
          <CardDescription>
            Search by PO Number, Customer Name, Quote Number, or Waybill Number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter PO number, customer name, quote number, or waybill number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchTerm && filteredOrders?.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No orders found matching "{searchTerm}"</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filteredOrders?.map((order) => {
          const stageInfo = getStageDisplay(order.current_stage);
          const relatedWaybill = waybills?.find(w => w.company_po_id === order.company_po_id);
          const distQuote = distributorQuotes?.find(dq => dq.company_po_id === order.company_po_id);
          const distInvoice = distributorInvoices?.find(di => di.company_po_id === order.company_po_id);
          
          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{order.quotes?.customer_name || 'Unknown Customer'}</CardTitle>
                    <CardDescription>
                      Quote: {order.quotes?.quote_number || 'N/A'}
                      {order.customer_pos?.po_number && ` | Customer PO: ${order.customer_pos.po_number}`}
                      {order.company_pos?.po_number && ` | Company PO: ${order.company_pos.po_number}`}
                      {relatedWaybill?.waybill_number && ` | Waybill: ${relatedWaybill.waybill_number}`}
                    </CardDescription>
                  </div>
                  <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {/* Quote */}
                    {order.quotes?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Quote</div>
                            <div className="text-xs text-muted-foreground">{order.quotes?.quote_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.quotes.file_path, order.quotes.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Customer PO */}
                    {order.customer_pos?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Customer PO</div>
                            <div className="text-xs text-muted-foreground">{order.customer_pos?.po_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.customer_pos.file_path, order.customer_pos.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Company PO */}
                    {order.company_pos?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Company PO</div>
                            <div className="text-xs text-muted-foreground">
                              {order.company_pos?.po_number} - {order.company_pos?.distributor_name}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.company_pos.file_path, order.company_pos.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Waybill */}
                    {relatedWaybill?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Waybill</div>
                            <div className="text-xs text-muted-foreground">{relatedWaybill.waybill_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(relatedWaybill.file_path!, relatedWaybill.file_name!)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Invoice */}
                    {order.invoices?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Invoice</div>
                            <div className="text-xs text-muted-foreground">{order.invoices?.invoice_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.invoices.file_path, order.invoices.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Distributor Quote */}
                    {distQuote?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Distributor Quote</div>
                            <div className="text-xs text-muted-foreground">{distQuote.quote_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(distQuote.file_path, distQuote.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Distributor Invoice */}
                    {distInvoice?.file_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Distributor Invoice</div>
                            <div className="text-xs text-muted-foreground">{distInvoice.invoice_number}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(distInvoice.file_path, distInvoice.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Project Documentation */}
                    {order.projects?.documentation_path && (
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Project Documentation</div>
                            <div className="text-xs text-muted-foreground">
                              {order.projects.project_number} - {order.projects.project_name}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.projects.documentation_path!, `${order.projects.project_number}_docs.pdf`)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default OrderLookup;