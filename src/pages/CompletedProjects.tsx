import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Search, FileText } from "lucide-react";

const CompletedProjects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: completedProjects } = useQuery({
    queryKey: ["completed-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "completed")
        .order("completion_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredProjects = completedProjects?.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.project_name?.toLowerCase().includes(query) ||
      project.project_number?.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query)
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

      toast({ title: "File downloaded successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error downloading file", description: error.message });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Completed Projects</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Completed Projects</CardTitle>
          <CardDescription>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Search by project name, number, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Completed Projects</CardTitle>
          <CardDescription>View and download documentation for completed projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredProjects?.map((project) => (
              <div key={project.id} className="p-4 border rounded space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-lg">{project.project_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Project Number: {project.project_number}
                    </div>
                    {project.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {project.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      Completed: {project.completion_date ? new Date(project.completion_date).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                  {project.documentation_path && (
                    <Button
                      variant="outline"
                      onClick={() => downloadFile(project.documentation_path!, `${project.project_number}_documentation.pdf`)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Documentation
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!filteredProjects?.length && (
              <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-2">
                <FileText className="h-12 w-12 opacity-50" />
                <div>
                  {searchQuery ? "No matching projects found" : "No completed projects yet"}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletedProjects;
