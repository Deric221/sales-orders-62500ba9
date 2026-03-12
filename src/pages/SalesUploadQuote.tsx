import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft, Plus, Users } from "lucide-react";

const SalesUploadQuote = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quoteNumber, setQuoteNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
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
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, quoteFile);
      if (uploadError) throw uploadError;

      const { data: insertedQuotes, error: insertError } = await supabase
        .from("quotes")
        .insert({ quote_number: quoteNumber, customer_name: customerName, uploaded_by: user.id, file_path: filePath, file_name: quoteFile.name })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const { error: wfError } = await supabase.from("workflow_tracker").insert({ quote_id: insertedQuotes.id, current_stage: "quote_uploaded" });
      if (wfError) throw wfError;
    },
    onSuccess: () => {
      toast({ title: "Quote uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setQuoteNumber("");
      setCustomerName("");
      setQuoteFile(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Upload Quote">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Quote</CardTitle>
              <CardDescription>Upload a new quote PDF for a customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quote-number">Quote Number</Label>
                <Input id="quote-number" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="Q-2025-001" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCustomer(true)} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> New Customer
                  </Button>
                </div>
                {customers && customers.length > 0 ? (
                  <select id="customer-name" className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md" value={customerName} onChange={(e) => setCustomerName(e.target.value)}>
                    <option value="">Select a customer...</option>
                    {customers.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                  </select>
                ) : (
                  <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ABC Corporation" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-file">Quote PDF</Label>
                <Input id="quote-file" type="file" accept=".pdf" onChange={(e) => setQuoteFile(e.target.files?.[0] || null)} />
              </div>
              <Button onClick={() => uploadQuoteMutation.mutate()} disabled={!quoteNumber || !customerName || !quoteFile || uploadQuoteMutation.isPending} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {uploadQuoteMutation.isPending ? "Uploading..." : "Upload Quote"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Enter customer name" />
            </div>
            <Button onClick={() => addCustomerMutation.mutate()} disabled={!newCustomerName.trim() || addCustomerMutation.isPending} className="w-full">
              {addCustomerMutation.isPending ? "Adding..." : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SalesUploadQuote;
