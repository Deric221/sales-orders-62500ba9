import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Calendar, CheckCircle2, Upload, FileText, Search, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { createNotifications } from "@/lib/notifications";
import WelcomeHeader from "@/components/layout/WelcomeHeader";

const ProjectsDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [description, setDescription] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [uploadingDocFor, setUploadingDocFor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows-for-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(quote_number, customer_name),
          customer_pos(po_number),
          company_pos(po_number)
        `)
        .is("invoice_id", null)
        .in("current_stage", ["waybill_created", "project_completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const incompleteProjects = projects?.filter(p => p.status !== "completed");
  
  const filteredProjects = incompleteProjects?.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.project_name?.toLowerCase().includes(query) ||
      project.project_number?.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query)
    );
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!projectName || !projectNumber) throw new Error("Project name and number are required");

      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          project_name: projectName,
          project_number: projectNumber,
          description: description || null,
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Link to workflow if selected
      if (selectedWorkflowId) {
        const { error: linkError } = await supabase
          .from("workflow_tracker")
          .update({ project_id: newProject.id })
          .eq("id", selectedWorkflowId);

        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      toast({ title: "Project created successfully" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["workflows-for-projects"] });
      setProjectName("");
      setProjectNumber("");
      setDescription("");
      setSelectedWorkflowId("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const { error } = await supabase
        .from("projects")
        .update({ 
          status,
          ...(status === "completed" && { completion_date: new Date().toISOString() })
        })
        .eq("id", projectId);

      if (error) throw error;

      // If project is completed, advance workflow to project_completed
      if (status === "completed") {
        const { data: workflow, error: wfError } = await supabase
          .from("workflow_tracker")
          .update({ current_stage: "project_completed" })
          .eq("project_id", projectId)
          .select("id, quotes(quote_number, customer_name)")
          .maybeSingle();

        if (wfError) {
          console.error('Error updating workflow:', wfError);
        } else if (workflow) {
          // Create in-app notifications for Finance team
          try {
            const { data: financeUsers } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("department_role", "finance");
            
            if (financeUsers && financeUsers.length > 0) {
              const notifications = financeUsers.map(u => ({
                user_id: u.user_id,
                title: "Project Completed - Ready for Invoice",
                message: `Project for quote ${workflow.quotes?.quote_number || "Unknown"} (${workflow.quotes?.customer_name || "Unknown"}) is completed. Ready for invoice generation.`,
                related_type: "workflow",
                related_id: workflow.id,
              }));
              
              await createNotifications(notifications);
            }

            const { data: session } = await supabase.auth.getSession();
            await supabase.functions.invoke('send-workflow-notification', {
              body: {
                workflowId: workflow.id,
                stage: 'project_completed',
                quoteNumber: workflow.quotes?.quote_number || "Unknown",
                customerName: workflow.quotes?.customer_name || "Unknown",
              },
              headers: {
                Authorization: `Bearer ${session?.session?.access_token}`,
              },
            }).catch(err => console.log('Email notification failed (expected if domain not verified):', err));
          } catch (notifyError) {
            console.error('Notification error:', notifyError);
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Project status updated" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["workflows-for-projects"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "on_hold": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const uploadDocumentationMutation = useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${projectId}_doc_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("projects")
        .update({ documentation_path: filePath })
        .eq("id", projectId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ title: "Documentation uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setUploadingDocFor(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      setUploadingDocFor(null);
    },
  });

  const handleFileUpload = async (projectId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocFor(projectId);
    uploadDocumentationMutation.mutate({ projectId, file });
  };

  const viewFile = async (filePath: string | null | undefined) => {
    try {
      if (!filePath) {
        toast({ variant: "destructive", title: "View failed", description: "File path is missing" });
        return;
      }
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "View failed", description: error.message });
        return;
      }
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ variant: "destructive", title: "View failed", description: err.message || 'Unknown error' });
    }
  };

  return (
    <div className="space-y-6">
      <WelcomeHeader
        pageDescription="Track project progress, upload documentation, and mark completions."
        features={["Manage Projects", "Upload Docs", "Track Status"]}
      />
      <div className="flex items-center justify-end">
        <Button onClick={() => navigate("/completed-projects")}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          View Completed Projects
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Management</CardTitle>
          <CardDescription>
            Update project status, upload documentation, and track ongoing projects
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Search projects by name, number, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredProjects?.map((project) => (
              <div key={project.id} className="p-4 border rounded space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <FolderKanban className="h-5 w-5 text-primary mt-1" />
                    <div>
                      <div className="font-medium">{project.project_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {project.project_number}
                      </div>
                      {project.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {project.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                  {project.completion_date && (
                    <>
                      <span>•</span>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completed: {new Date(project.completion_date).toLocaleDateString()}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: "in_progress" })}
                    disabled={project.status === "in_progress"}
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: "on_hold" })}
                    disabled={project.status === "on_hold"}
                  >
                    On Hold
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: "completed" })}
                    disabled={project.status === "completed" || !project.documentation_path}
                    title={!project.documentation_path ? "Upload documentation before completing" : ""}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {project.status === "completed" ? "Completed" : "Complete Project"}
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      id={`upload-${project.id}`}
                      className="hidden"
                      onChange={(e) => handleFileUpload(project.id, e)}
                      accept=".pdf,.doc,.docx,.zip"
                      disabled={uploadingDocFor === project.id}
                    />
                    <Button
                      size="sm"
                      variant={project.documentation_path ? "secondary" : "default"}
                      onClick={() => document.getElementById(`upload-${project.id}`)?.click()}
                      disabled={uploadingDocFor === project.id}
                    >
                      {uploadingDocFor === project.id ? (
                        "Uploading..."
                      ) : project.documentation_path ? (
                        <>
                          <FileText className="h-4 w-4 mr-1" />
                          Documentation Uploaded
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload Documentation
                        </>
                      )}
                    </Button>
                    {project.documentation_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewFile(project.documentation_path)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!filteredProjects?.length && (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? "No matching projects found" : "No incomplete projects"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsDashboard;
