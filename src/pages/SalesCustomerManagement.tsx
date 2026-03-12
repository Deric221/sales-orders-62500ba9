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
import { Users, Plus, ArrowLeft } from "lucide-react";

const SalesCustomerManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCustomerName, setNewCustomerName] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerName.trim() || !user) throw new Error("Customer name is required");
      const { error } = await supabase.from("customers").insert({ name: newCustomerName.trim(), created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Customer added successfully" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setNewCustomerName("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Customer Management">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add New Customer</CardTitle>
              <CardDescription>Add a new customer to the system for use in quotes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Enter customer name" />
              </div>
              <Button onClick={() => addCustomerMutation.mutate()} disabled={!newCustomerName.trim() || addCustomerMutation.isPending} className="w-full">
                {addCustomerMutation.isPending ? "Adding..." : "Add Customer"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All Customers</CardTitle>
              <CardDescription>{customers?.length || 0} customers in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customers?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at!).toLocaleDateString()}</span>
                  </div>
                ))}
                {(!customers || customers.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">No customers yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesCustomerManagement;
