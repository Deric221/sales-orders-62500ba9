import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Eye, Search, ArrowLeft } from "lucide-react";

const SalesQuotes = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredQuotes = quotes?.filter((quote) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      quote.quote_number?.toLowerCase().includes(query) ||
      quote.customer_name?.toLowerCase().includes(query)
    );
  });

  const downloadFile = async (filePath: string, fileName: string) => {
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

  const viewFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
    if (error) {
      toast({ variant: "destructive", title: "View failed", description: error.message });
      return;
    }
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !userRole) {
    navigate("/auth");
    return null;
  }

  return (
    <DashboardLayout title="Quotes & Documents">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quotes with Linked Documents</CardTitle>
            <CardDescription>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search quotes by number or customer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredQuotes?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No quotes match your search" : "No quotes found"}
                </div>
              )}
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
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewFile(quote.file_path)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(quote.file_path, quote.file_name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Linked Documents */}
                    <div className="pl-8 space-y-2 text-sm">
                      {linkedCustomerPO && (
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span>Customer PO: {linkedCustomerPO.po_number}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewFile(linkedCustomerPO.file_path)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadFile(linkedCustomerPO.file_path, linkedCustomerPO.file_name)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {linkedWaybill && (
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-500" />
                            <span>Waybill: {linkedWaybill.waybill_number}</span>
                          </div>
                          {linkedWaybill.file_path && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewFile(linkedWaybill.file_path!)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadFile(linkedWaybill.file_path!, linkedWaybill.file_name || "waybill.pdf")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {!linkedCustomerPO && (
                        <div className="text-muted-foreground italic">
                          No linked documents yet
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SalesQuotes;
