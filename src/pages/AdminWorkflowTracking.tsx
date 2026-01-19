import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Eye, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import { WorkflowVisual } from "@/components/workflow/WorkflowVisual";
import { useState } from "react";

const AdminWorkflowTracking = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: incompleteWorkflows } = useQuery({
    queryKey: ["incomplete-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(*),
          customer_pos(*),
          company_pos(*),
          projects(project_name, project_number, status)
        `)
        .not("current_stage", "in", "(invoice_generated,completed)")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredWorkflows = incompleteWorkflows?.filter((wf) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      wf.quotes?.quote_number?.toLowerCase().includes(query) ||
      wf.quotes?.customer_name?.toLowerCase().includes(query) ||
      wf.customer_pos?.po_number?.toLowerCase().includes(query) ||
      wf.company_pos?.po_number?.toLowerCase().includes(query) ||
      wf.current_stage?.toLowerCase().includes(query)
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

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      quote_uploaded: "Quote Uploaded",
      customer_po_uploaded: "Customer PO Uploaded",
      company_po_uploaded: "Company PO Uploaded",
      waybill_created: "Waybill Created",
      awaiting_project_completion: "Awaiting Project",
      project_completed: "Project Completed",
      invoice_generated: "Invoice Generated",
      completed: "Completed",
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    if (stage === "completed" || stage === "invoice_generated") return "bg-green-100 text-green-800";
    if (stage === "awaiting_project_completion") return "bg-yellow-100 text-yellow-800";
    return "bg-blue-100 text-blue-800";
  };

  return (
    <DashboardLayout title="Workflow Tracking">
      <div className="space-y-6">
        <WelcomeHeader
          pageDescription="Monitor all active workflows and track order progress through each stage."
          features={["Track Orders", "View Documents", "Monitor Progress", "Identify Bottlenecks"]}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80"
            />
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => navigate("/completed-orders")}>
            <FileText className="h-4 w-4 mr-2" />
            View Completed Orders
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Incomplete Workflows ({filteredWorkflows?.length || 0})</CardTitle>
            <CardDescription>Orders that are still in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredWorkflows?.map((wf) => (
                <div key={wf.id} className="p-4 border rounded space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{wf.quotes?.quote_number}</div>
                      <div className="text-sm text-muted-foreground">{wf.quotes?.customer_name}</div>
                    </div>
                    <Badge className={getStageColor(wf.current_stage)}>
                      {getStageLabel(wf.current_stage)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customer PO:</span>
                      <div>{wf.customer_pos?.po_number || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Company PO:</span>
                      <div>{wf.company_pos?.po_number || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Project:</span>
                      <div>{wf.projects?.project_number || "—"}</div>
                    </div>
                  </div>

                  <WorkflowVisual currentStage={wf.current_stage} hasProject={!!wf.project_id} />

                  <div className="flex gap-2 flex-wrap">
                    {wf.quotes?.file_path && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => viewFile(wf.quotes.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />Quote
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadFile(wf.quotes.file_path, wf.quotes.file_name)}>
                          <Download className="h-4 w-4 mr-1" />Quote
                        </Button>
                      </>
                    )}
                    {wf.customer_pos?.file_path && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => viewFile(wf.customer_pos.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />CPO
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadFile(wf.customer_pos.file_path, wf.customer_pos.file_name)}>
                          <Download className="h-4 w-4 mr-1" />CPO
                        </Button>
                      </>
                    )}
                    {wf.company_pos?.file_path && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => viewFile(wf.company_pos.file_path)}>
                          <Eye className="h-4 w-4 mr-1" />CoPO
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadFile(wf.company_pos.file_path, wf.company_pos.file_name)}>
                          <Download className="h-4 w-4 mr-1" />CoPO
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!filteredWorkflows?.length && (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No matching workflows found" : "No incomplete workflows"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminWorkflowTracking;
