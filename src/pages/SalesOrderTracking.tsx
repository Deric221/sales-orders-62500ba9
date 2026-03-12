import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkflowVisual } from "@/components/workflow/WorkflowVisual";
import { ArrowLeft, RefreshCw } from "lucide-react";

const SalesOrderTracking = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const { data: workflows } = useQuery({
    queryKey: ["workflows-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select("*, quotes(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !userRole) { navigate("/auth"); return null; }

  return (
    <DashboardLayout title="Order Tracking">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Order Tracking</CardTitle>
            <CardDescription>Track the progress of your orders through the workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflows?.map((wf) => (
                <div key={wf.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{wf.quotes?.quote_number}</span>
                      <span className="text-muted-foreground ml-2">— {wf.quotes?.customer_name}</span>
                    </div>
                    <Badge variant={wf.current_stage === "completed" || wf.current_stage === "invoice_generated" ? "default" : "outline"} className="text-xs">
                      {wf.current_stage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  </div>
                  <WorkflowVisual currentStage={wf.current_stage} hasProject={!!wf.project_id} />
                </div>
              ))}
              {(!workflows || workflows.length === 0) && (
                <div className="text-center text-muted-foreground py-8">No orders to track yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SalesOrderTracking;
