import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Package, Truck, Plus, Check, Upload, FileText, Eye, Download } from "lucide-react";
import { format } from "date-fns";

interface DeliveryManagementProps {
  waybillId: string;
  waybillNumber: string;
}

interface WaybillItem {
  id: string;
  quantity: number;
  reference: string;
  serial_number: string;
  description: string;
  items_received: number;
  items_outstanding: number;
}

const DeliveryManagement = ({ waybillId, waybillNumber }: DeliveryManagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [itemDeliveries, setItemDeliveries] = useState<Record<string, number>>({});
  const [signedWaybillFile, setSignedWaybillFile] = useState<File | null>(null);
  const [isUploadingSignedWaybill, setIsUploadingSignedWaybill] = useState(false);

  // Fetch waybill items
  const { data: waybillItems = [] } = useQuery({
    queryKey: ["waybill-items", waybillId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybill_items")
        .select("*")
        .eq("waybill_id", waybillId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as WaybillItem[];
    },
  });

  // Fetch delivery records
  const { data: deliveryRecords = [] } = useQuery({
    queryKey: ["delivery-records", waybillId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_records")
        .select("*, delivery_items(*, waybill_items(description, reference))")
        .eq("waybill_id", waybillId)
        .order("delivery_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch waybill details for status
  const { data: waybill } = useQuery({
    queryKey: ["waybill-detail", waybillId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*")
        .eq("id", waybillId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const recordDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Create delivery record
      const { data: deliveryRecord, error: recordError } = await supabase
        .from("delivery_records")
        .insert({
          waybill_id: waybillId,
          delivery_date: deliveryDate,
          delivery_notes: deliveryNotes,
          delivered_by: user.id,
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Create delivery items
      const deliveryItems = Object.entries(itemDeliveries)
        .filter(([_, qty]) => qty > 0)
        .map(([waybillItemId, quantityDelivered]) => ({
          delivery_record_id: deliveryRecord.id,
          waybill_item_id: waybillItemId,
          quantity_delivered: quantityDelivered,
        }));

      if (deliveryItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("delivery_items")
          .insert(deliveryItems);

        if (itemsError) throw itemsError;
      }

      return deliveryRecord;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Delivery recorded successfully",
      });
      setShowDeliveryDialog(false);
      setDeliveryNotes("");
      setItemDeliveries({});
      queryClient.invalidateQueries({ queryKey: ["waybill-items", waybillId] });
      queryClient.invalidateQueries({ queryKey: ["delivery-records", waybillId] });
      queryClient.invalidateQueries({ queryKey: ["waybill-detail", waybillId] });
      queryClient.invalidateQueries({ queryKey: ["waybills"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadSignedWaybillMutation = useMutation({
    mutationFn: async () => {
      if (!signedWaybillFile || !user) throw new Error("Missing required data");

      const filePath = `signed-waybills/${user.id}/${Date.now()}_${signedWaybillFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, signedWaybillFile);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("waybills")
        .update({
          signed_waybill_path: filePath,
          signed_waybill_name: signedWaybillFile.name,
          signed_at: new Date().toISOString(),
          signed_by: user.id,
        })
        .eq("id", waybillId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Signed waybill uploaded successfully",
      });
      setSignedWaybillFile(null);
      queryClient.invalidateQueries({ queryKey: ["waybill-detail", waybillId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const getDeliveryStatusBadge = (status: string | null) => {
    switch (status) {
      case "fully_delivered":
        return <Badge className="bg-green-600">Fully Delivered</Badge>;
      case "partially_delivered":
        return <Badge variant="secondary">Partially Delivered</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const totalOrdered = waybillItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalReceived = waybillItems.reduce((sum, item) => sum + (item.items_received || 0), 0);
  const totalOutstanding = totalOrdered - totalReceived;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <span className="font-medium">{waybillNumber}</span>
          {getDeliveryStatusBadge(waybill?.delivery_status)}
        </div>
        <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={totalOutstanding <= 0}>
              <Truck className="h-4 w-4 mr-2" />
              Record Delivery
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Delivery for {waybillNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Delivery notes..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Items Delivered</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-center">Ordered</th>
                        <th className="p-2 text-center">Received</th>
                        <th className="p-2 text-center">Outstanding</th>
                        <th className="p-2 text-center">Qty Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waybillItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">
                            <div>{item.description}</div>
                            {item.reference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {item.reference}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-center">{item.items_received || 0}</td>
                          <td className="p-2 text-center">
                            <span className={item.items_outstanding > 0 ? "text-amber-600 font-medium" : "text-green-600"}>
                              {item.items_outstanding || 0}
                            </span>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              max={item.items_outstanding || 0}
                              className="w-20 mx-auto"
                              value={itemDeliveries[item.id] || ""}
                              onChange={(e) => setItemDeliveries(prev => ({
                                ...prev,
                                [item.id]: parseInt(e.target.value) || 0
                              }))}
                              disabled={item.items_outstanding <= 0}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => recordDeliveryMutation.mutate()}
                  disabled={recordDeliveryMutation.isPending || Object.values(itemDeliveries).every(v => !v)}
                >
                  {recordDeliveryMutation.isPending ? "Recording..." : "Record Delivery"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="p-3 bg-muted/50 rounded">
          <div className="text-xs text-muted-foreground">Total Ordered</div>
          <div className="text-lg font-semibold">{totalOrdered}</div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
          <div className="text-xs text-muted-foreground">Total Delivered</div>
          <div className="text-lg font-semibold text-green-600">{totalReceived}</div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded">
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="text-lg font-semibold text-amber-600">{totalOutstanding}</div>
        </div>
      </div>

      {/* Items Table */}
      {waybillItems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-center">Ordered</th>
                <th className="p-2 text-center">Delivered</th>
                <th className="p-2 text-center">Outstanding</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {waybillItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{item.description}</div>
                    {item.reference && (
                      <div className="text-xs text-muted-foreground">Ref: {item.reference}</div>
                    )}
                    {item.serial_number && (
                      <div className="text-xs text-muted-foreground">S/N: {item.serial_number}</div>
                    )}
                  </td>
                  <td className="p-2 text-center">{item.quantity}</td>
                  <td className="p-2 text-center text-green-600">{item.items_received || 0}</td>
                  <td className="p-2 text-center">
                    <span className={item.items_outstanding > 0 ? "text-amber-600" : ""}>
                      {item.items_outstanding || 0}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    {item.items_outstanding <= 0 ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signed Waybill Section */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <Label className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Signed Waybill (Customer Acknowledgment)
        </Label>
        
        {waybill?.signed_waybill_path ? (
          <div className="flex items-center justify-between p-3 bg-background rounded border">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">{waybill.signed_waybill_name}</span>
              {waybill.signed_at && (
                <span className="text-xs text-muted-foreground">
                  (Uploaded: {format(new Date(waybill.signed_at), "PPP")})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => viewFile(waybill.signed_waybill_path!)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadFile(waybill.signed_waybill_path!, waybill.signed_waybill_name || "signed-waybill.pdf")}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Upload the signed waybill from the customer to acknowledge delivery.
            </div>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSignedWaybillFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Button
                onClick={() => uploadSignedWaybillMutation.mutate()}
                disabled={!signedWaybillFile || uploadSignedWaybillMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadSignedWaybillMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delivery History */}
      {deliveryRecords.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Delivery History</Label>
          <div className="space-y-2">
            {deliveryRecords.map((record: any) => (
              <div key={record.id} className="p-3 border rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {format(new Date(record.delivery_date), "PPP")}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {record.delivery_items?.length || 0} items
                  </Badge>
                </div>
                {record.delivery_notes && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {record.delivery_notes}
                  </div>
                )}
                {record.delivery_items && record.delivery_items.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {record.delivery_items.map((item: any) => (
                      <div key={item.id}>
                        • {item.quantity_delivered}x {item.waybill_items?.description || "Item"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryManagement;
