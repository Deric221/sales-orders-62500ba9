import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeliveryManagement from "@/components/orders/DeliveryManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Search, Truck, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const DeliveryManagementPage = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWaybill, setSelectedWaybill] = useState<{id: string; number: string} | null>(null);

  // Fetch waybills with company PO item counts
  const { data: waybillsWithItems, isLoading } = useQuery({
    queryKey: ["waybills-with-delivery-status"],
    queryFn: async () => {
      // First get all waybills with their company PO info
      const { data: waybills, error: waybillsError } = await supabase
        .from("waybills")
        .select(`
          *,
          company_pos(
            id,
            po_number,
            distributor_name,
            customer_pos(
              po_number,
              quotes(quote_number, customer_name)
            )
          ),
          waybill_items(
            id,
            quantity,
            description,
            reference,
            items_received,
            items_outstanding
          )
        `)
        .order("created_at", { ascending: false });

      if (waybillsError) throw waybillsError;

      // Calculate delivery stats for each waybill
      return waybills?.map(waybill => {
        const items = waybill.waybill_items || [];
        const totalOrdered = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const totalDelivered = items.reduce((sum: number, item: any) => sum + (item.items_received || 0), 0);
        const totalOutstanding = totalOrdered - totalDelivered;

        return {
          ...waybill,
          totalOrdered,
          totalDelivered,
          totalOutstanding,
          itemCount: items.length,
        };
      });
    },
    refetchInterval: 10000,
  });

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

  const filteredWaybills = waybillsWithItems?.filter(waybill => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      waybill.waybill_number?.toLowerCase().includes(query) ||
      waybill.company_pos?.po_number?.toLowerCase().includes(query) ||
      waybill.company_pos?.customer_pos?.quotes?.customer_name?.toLowerCase().includes(query) ||
      waybill.company_pos?.customer_pos?.po_number?.toLowerCase().includes(query)
    );
  });

  const getDeliveryStatusBadge = (status: string | null, outstanding: number) => {
    if (outstanding === 0 || status === "fully_delivered") {
      return <Badge className="bg-green-100 text-green-800">Fully Delivered</Badge>;
    }
    if (status === "partially_delivered") {
      return <Badge className="bg-yellow-100 text-yellow-800">Partially Delivered</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
  };

  if (selectedWaybill) {
    return (
      <DashboardLayout title="Delivery Management">
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setSelectedWaybill(null)}>
            ← Back to Waybill List
          </Button>
          <DeliveryManagement
            waybillId={selectedWaybill.id}
            waybillNumber={selectedWaybill.number}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Delivery Management">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Item Delivery Tracking
            </CardTitle>
            <CardDescription>
              Track and manage item deliveries. Compare Company PO quantities against waybill items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by waybill number, PO number, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading waybills...</div>
            ) : !filteredWaybills?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No waybills match your search" : "No waybills found"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredWaybills.map((waybill) => (
                  <div
                    key={waybill.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedWaybill({ id: waybill.id, number: waybill.waybill_number })}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <span className="font-medium">{waybill.waybill_number}</span>
                          {getDeliveryStatusBadge(waybill.delivery_status, waybill.totalOutstanding)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Company PO: {waybill.company_pos?.po_number} | 
                          Customer: {waybill.company_pos?.customer_pos?.quotes?.customer_name || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Distributor: {waybill.company_pos?.distributor_name}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">{waybill.itemCount}</span> items
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span>Ordered: {waybill.totalOrdered}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Delivered: {waybill.totalDelivered}</span>
                          </div>
                          {waybill.totalOutstanding > 0 && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <Clock className="h-3 w-3" />
                              <span>Outstanding: {waybill.totalOutstanding}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {waybillsWithItems?.length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Waybills</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {waybillsWithItems?.filter(w => w.totalOutstanding > 0).length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending Deliveries</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {waybillsWithItems?.filter(w => w.totalOutstanding === 0).length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Fully Delivered</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DeliveryManagementPage;
