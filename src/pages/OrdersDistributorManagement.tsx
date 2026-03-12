import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, ArrowLeft } from "lucide-react";

const OrdersDistributorManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newDistributorName, setNewDistributorName] = useState("");

  const { data: distributors } = useQuery({
    queryKey: ["distributors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("distributors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addDistributorMutation = useMutation({
    mutationFn: async () => {
      if (!newDistributorName.trim() || !user) throw new Error("Distributor name is required");
      const { error } = await supabase.from("distributors").insert({ name: newDistributorName.trim(), created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Distributor added successfully" });
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setNewDistributorName("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Distributor Management">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add New Distributor</CardTitle>
              <CardDescription>Add a new distributor to the system for use in purchase orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Distributor Name</Label>
                <Input value={newDistributorName} onChange={(e) => setNewDistributorName(e.target.value)} placeholder="Enter distributor name" />
              </div>
              <Button onClick={() => addDistributorMutation.mutate()} disabled={!newDistributorName.trim() || addDistributorMutation.isPending} className="w-full">
                {addDistributorMutation.isPending ? "Adding..." : "Add Distributor"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> All Distributors</CardTitle>
              <CardDescription>{distributors?.length || 0} distributors in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {distributors?.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at!).toLocaleDateString()}</span>
                  </div>
                ))}
                {(!distributors || distributors.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">No distributors yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OrdersDistributorManagement;
