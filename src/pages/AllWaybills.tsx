import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Package, Search } from "lucide-react";

const AllWaybills = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: waybills } = useQuery({
    queryKey: ["all-waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*, company_pos(po_number, distributor_name, customer_pos(po_number, quotes(quote_number, customer_name)))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredWaybills = waybills?.filter((waybill) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      waybill.waybill_number?.toLowerCase().includes(query) ||
      waybill.company_pos?.po_number?.toLowerCase().includes(query) ||
      waybill.company_pos?.distributor_name?.toLowerCase().includes(query) ||
      waybill.company_pos?.customer_pos?.po_number?.toLowerCase().includes(query) ||
      waybill.company_pos?.customer_pos?.quotes?.customer_name?.toLowerCase().includes(query) ||
      waybill.company_pos?.customer_pos?.quotes?.quote_number?.toLowerCase().includes(query) ||
      waybill.product_details?.toLowerCase().includes(query)
    );
  });

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

      toast({ title: "Waybill downloaded successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error downloading file", description: error.message });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Waybills</h1>
          <p className="text-muted-foreground">View and download all waybill documents</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Waybills</CardTitle>
          <CardDescription>Search by waybill number, PO number, customer name, distributor, or product details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search waybills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredWaybills?.map((waybill) => (
          <Card key={waybill.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="text-xl">{waybill.waybill_number}</CardTitle>
                    <CardDescription>
                      {waybill.company_pos?.customer_pos?.quotes?.customer_name}
                    </CardDescription>
                  </div>
                </div>
                {waybill.file_path && (
                  <Button
                    onClick={() => downloadFile(waybill.file_path!, waybill.file_name!)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Quote Number:</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {waybill.company_pos?.customer_pos?.quotes?.quote_number || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Customer PO:</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {waybill.company_pos?.customer_pos?.po_number || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Company PO:</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {waybill.company_pos?.po_number || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Distributor:</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {waybill.company_pos?.distributor_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Created:</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {new Date(waybill.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {waybill.serial_numbers && waybill.serial_numbers.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Serial Numbers:</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {waybill.serial_numbers.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {waybill.product_details && (
                <div className="pt-2 border-t">
                  <span className="text-sm font-medium">Product Details:</span>
                  <p className="text-sm text-muted-foreground mt-1">{waybill.product_details}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!filteredWaybills?.length && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No waybills found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AllWaybills;
