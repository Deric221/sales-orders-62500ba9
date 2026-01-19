import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Package, Building2, Calendar, CheckCircle2, Download, Eye } from "lucide-react";

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: completedWorkflows, isLoading } = useQuery({
    queryKey: ["completed-workflows-search", query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(quote_number, customer_name, file_name, file_path),
          customer_pos(po_number, file_name, file_path),
          company_pos(po_number, distributor_name, file_name, file_path),
          invoices(invoice_number, amount, file_name, file_path),
          projects(project_number, project_name, status, completion_date, documentation_path)
        `)
        .not("invoice_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter by search query
      if (!query) return data;

      return data?.filter((workflow) => {
        const searchLower = query.toLowerCase();
        return (
          workflow.quotes?.quote_number?.toLowerCase().includes(searchLower) ||
          workflow.quotes?.customer_name?.toLowerCase().includes(searchLower) ||
          workflow.customer_pos?.po_number?.toLowerCase().includes(searchLower) ||
          workflow.company_pos?.po_number?.toLowerCase().includes(searchLower) ||
          workflow.company_pos?.distributor_name?.toLowerCase().includes(searchLower) ||
          workflow.invoices?.invoice_number?.toLowerCase().includes(searchLower) ||
          workflow.projects?.project_number?.toLowerCase().includes(searchLower) ||
          workflow.projects?.project_name?.toLowerCase().includes(searchLower)
        );
      });
    },
    enabled: !!query,
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

  const previewFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error loading preview", description: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Search Results</h1>
            <p className="text-muted-foreground mt-2">
              Showing completed orders for: <span className="font-medium">"{query}"</span>
            </p>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <div className="text-lg">Loading...</div>
            </div>
          )}

          {!isLoading && !completedWorkflows?.length && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No completed orders found for your search.
              </CardContent>
            </Card>
          )}

          {completedWorkflows?.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {workflow.quotes?.quote_number}
                    </CardTitle>
                    <CardDescription>
                      Customer: {workflow.quotes?.customer_name}
                    </CardDescription>
                    {workflow.quotes?.file_path && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => previewFile(workflow.quotes.file_path)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(workflow.quotes.file_path, workflow.quotes.file_name)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    )}
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Customer PO */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Package className="h-4 w-4" />
                      Customer PO
                    </div>
                    <div className="pl-6 text-sm space-y-1">
                      <div>PO #: {workflow.customer_pos?.po_number}</div>
                      <div className="text-muted-foreground">{workflow.customer_pos?.file_name}</div>
                      {workflow.customer_pos?.file_path && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewFile(workflow.customer_pos.file_path)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(workflow.customer_pos.file_path, workflow.customer_pos.file_name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company PO */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4" />
                      Company PO
                    </div>
                    <div className="pl-6 text-sm space-y-1">
                      <div>PO #: {workflow.company_pos?.po_number}</div>
                      <div>Distributor: {workflow.company_pos?.distributor_name}</div>
                      <div className="text-muted-foreground">{workflow.company_pos?.file_name}</div>
                      {workflow.company_pos?.file_path && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewFile(workflow.company_pos.file_path)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(workflow.company_pos.file_path, workflow.company_pos.file_name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Invoice */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Invoice
                    </div>
                    <div className="pl-6 text-sm space-y-1">
                      <div>Invoice #: {workflow.invoices?.invoice_number}</div>
                      <div>Amount: ${workflow.invoices?.amount}</div>
                      <div className="text-muted-foreground">{workflow.invoices?.file_name}</div>
                      {workflow.invoices?.file_path && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewFile(workflow.invoices.file_path)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(workflow.invoices.file_path, workflow.invoices.file_name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Project */}
                  {workflow.projects && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        Project
                      </div>
                      <div className="pl-6 text-sm space-y-1">
                        <div>Project #: {workflow.projects.project_number}</div>
                        <div>{workflow.projects.project_name}</div>
                        {workflow.projects.completion_date && (
                          <div className="text-muted-foreground">
                            Completed: {new Date(workflow.projects.completion_date).toLocaleDateString()}
                          </div>
                        )}
                        {workflow.projects.documentation_path && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => previewFile(workflow.projects.documentation_path!)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadFile(workflow.projects.documentation_path!, `${workflow.projects.project_number}_documentation.pdf`)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Document Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchResults;
