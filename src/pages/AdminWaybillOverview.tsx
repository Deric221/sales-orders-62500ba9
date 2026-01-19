import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, Truck, Package, CheckCircle2, Clock } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import { useState } from "react";

const AdminWaybillOverview = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: waybills } = useQuery({
    queryKey: ["all-waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select(`
          *,
          company_pos(
            po_number,
            customer_pos(
              po_number,
              quotes(quote_number, customer_name)
            )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredWaybills = waybills?.filter((wb) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      wb.waybill_number?.toLowerCase().includes(query) ||
      wb.company_pos?.po_number?.toLowerCase().includes(query) ||
      wb.company_pos?.customer_pos?.quotes?.customer_name?.toLowerCase().includes(query) ||
      wb.delivery_status?.toLowerCase().includes(query)
    );
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
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error downloading file", description: error.message });
    }
  };

  const viewFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "View failed", description: error.message });
        return;
      }
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error viewing file", description: error.message });
    }
  };

  const getDeliveryBadge = (status: string | null) => {
    if (status === "delivered") return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
    if (status === "partial") return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
  };

  // Stats
  const stats = {
    total: waybills?.length || 0,
    delivered: waybills?.filter(w => w.delivery_status === "delivered").length || 0,
    partial: waybills?.filter(w => w.delivery_status === "partial").length || 0,
    pending: waybills?.filter(w => !w.delivery_status || w.delivery_status === "pending").length || 0,
  };

  return (
    <DashboardLayout title="Waybill Overview">
      <div className="space-y-6">
        <WelcomeHeader
          pageDescription="View all waybills and track delivery status across the organization."
          features={["View Waybills", "Track Deliveries", "Download Documents", "Monitor Status"]}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Waybills</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.delivered}</div>
                  <div className="text-sm text-muted-foreground">Delivered</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.partial}</div>
                  <div className="text-sm text-muted-foreground">Partial</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waybills List */}
        <Card>
          <CardHeader>
            <CardTitle>All Waybills</CardTitle>
            <CardDescription>
              <Input
                placeholder="Search by waybill number, PO, customer, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredWaybills?.map((wb) => (
                <div key={wb.id} className="p-4 border rounded space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{wb.waybill_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {wb.company_pos?.customer_pos?.quotes?.customer_name || "Unknown Customer"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Company PO: {wb.company_pos?.po_number || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      {getDeliveryBadge(wb.delivery_status)}
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(wb.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Items Ordered:</span>
                      <div>{wb.total_items_ordered || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items Delivered:</span>
                      <div>{wb.total_items_delivered || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quote:</span>
                      <div>{wb.company_pos?.customer_pos?.quotes?.quote_number || "—"}</div>
                    </div>
                  </div>

                  {wb.file_path && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => viewFile(wb.file_path!)}>
                        <Eye className="h-4 w-4 mr-1" />View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadFile(wb.file_path!, wb.file_name!)}>
                        <Download className="h-4 w-4 mr-1" />Download
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {!filteredWaybills?.length && (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No matching waybills found" : "No waybills"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminWaybillOverview;
