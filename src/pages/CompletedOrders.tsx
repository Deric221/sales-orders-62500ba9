import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileText, Search } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

const CompletedOrders = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: completedOrders } = useQuery({
    queryKey: ["completed-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(quote_number, customer_name, file_path, file_name),
          customer_pos(po_number, file_path, file_name),
          company_pos(po_number, file_path, file_name),
          invoices(invoice_number, file_path, file_name),
          projects(project_name, project_number, status, documentation_path)
        `)
        .not("invoice_id", "is", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: waybills } = useQuery({
    queryKey: ["all-waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: distributorQuotes } = useQuery({
    queryKey: ["all-distributor-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distributor_quotes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: distributorInvoices } = useQuery({
    queryKey: ["all-distributor-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distributor_invoices")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = completedOrders?.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.quotes?.quote_number?.toLowerCase().includes(query) ||
      order.quotes?.customer_name?.toLowerCase().includes(query) ||
      order.customer_pos?.po_number?.toLowerCase().includes(query) ||
      order.company_pos?.po_number?.toLowerCase().includes(query) ||
      order.invoices?.invoice_number?.toLowerCase().includes(query) ||
      order.projects?.project_name?.toLowerCase().includes(query) ||
      order.projects?.project_number?.toLowerCase().includes(query)
    );
  });

  // Pagination logic
  const totalItems = filteredOrders?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders?.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const getVisiblePages = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Completed Orders</h1>
          <p className="text-muted-foreground">View all completed orders with full documentation</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Orders</CardTitle>
          <CardDescription>Search by quote number, customer name, PO numbers, or project details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search completed orders..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <Button variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {totalItems > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems} orders
        </span>
      </div>

      <div className="space-y-4">
        {paginatedOrders?.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{order.quotes?.customer_name}</CardTitle>
                  <CardDescription>Quote: {order.quotes?.quote_number}</CardDescription>
                </div>
                <Badge variant="default">Completed</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Quote</div>
                        <div className="text-xs text-muted-foreground">{order.quotes?.quote_number}</div>
                      </div>
                    </div>
                    {order.quotes?.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(order.quotes.file_path, order.quotes.file_name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Customer PO</div>
                        <div className="text-xs text-muted-foreground">{order.customer_pos?.po_number}</div>
                      </div>
                    </div>
                    {order.customer_pos?.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(order.customer_pos.file_path, order.customer_pos.file_name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Company PO</div>
                        <div className="text-xs text-muted-foreground">{order.company_pos?.po_number}</div>
                      </div>
                    </div>
                    {order.company_pos?.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(order.company_pos.file_path, order.company_pos.file_name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Waybill</div>
                        <div className="text-xs text-muted-foreground">
                          {waybills?.find(w => w.company_po_id === order.company_po_id)?.waybill_number || "N/A"}
                        </div>
                      </div>
                    </div>
                    {waybills?.find(w => w.company_po_id === order.company_po_id)?.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const wb = waybills.find(w => w.company_po_id === order.company_po_id);
                          if (wb) downloadFile(wb.file_path!, wb.file_name!);
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Invoice</div>
                        <div className="text-xs text-muted-foreground">{order.invoices?.invoice_number}</div>
                      </div>
                    </div>
                    {order.invoices?.file_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(order.invoices.file_path, order.invoices.file_name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {order.projects && (
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
                      {order.projects.documentation_path && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(order.projects.documentation_path!, `${order.projects.project_number}_docs.pdf`)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}

                  {(() => {
                    const distQuote = distributorQuotes?.find(dq => dq.company_po_id === order.company_po_id);
                    return distQuote?.file_path && distQuote?.file_name ? (
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
                    ) : null;
                  })()}

                  {(() => {
                    const distInvoice = distributorInvoices?.find(di => di.company_po_id === order.company_po_id);
                    return distInvoice?.file_path && distInvoice?.file_name ? (
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
                    ) : null;
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!paginatedOrders?.length && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No completed orders found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {getVisiblePages().map((page, index) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default CompletedOrders;
