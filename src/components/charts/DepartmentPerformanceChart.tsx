import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, FileText, Package, Receipt, FolderKanban, CheckCircle } from "lucide-react";

interface DepartmentPerformanceChartProps {
  departmentRole: "admin" | "sales" | "orders" | "finance" | "projects" | null;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

const DepartmentPerformanceChart = ({ departmentRole }: DepartmentPerformanceChartProps) => {
  // Fetch workflow data for metrics
  const { data: workflows } = useQuery({
    queryKey: ["workflow-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select("*, quotes(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch quotes for sales
  const { data: quotes } = useQuery({
    queryKey: ["quotes-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: departmentRole === "sales" || departmentRole === "admin",
  });

  // Fetch waybills for orders
  const { data: waybills } = useQuery({
    queryKey: ["waybills-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: departmentRole === "orders" || departmentRole === "admin",
  });

  // Fetch invoices for finance
  const { data: invoices } = useQuery({
    queryKey: ["invoices-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: departmentRole === "finance" || departmentRole === "admin",
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: departmentRole === "projects" || departmentRole === "admin",
  });

  const getMetrics = () => {
    switch (departmentRole) {
      case "sales":
        const totalQuotes = quotes?.length || 0;
        const quotesWithPO = workflows?.filter(w => w.customer_po_id)?.length || 0;
        const conversionRate = totalQuotes > 0 ? Math.round((quotesWithPO / totalQuotes) * 100) : 0;
        return {
          stats: [
            { label: "Total Quotes", value: totalQuotes, icon: FileText },
            { label: "Quotes with PO", value: quotesWithPO, icon: CheckCircle },
            { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp },
          ],
          chartData: [
            { name: "Quotes", value: totalQuotes },
            { name: "With PO", value: quotesWithPO },
            { name: "Pending", value: Math.max(0, totalQuotes - quotesWithPO) },
          ],
          progress: conversionRate,
        };
      case "orders":
        const totalWaybills = waybills?.length || 0;
        const delivered = waybills?.filter(w => w.delivery_status === "delivered")?.length || 0;
        const pending = waybills?.filter(w => w.delivery_status === "pending" || !w.delivery_status)?.length || 0;
        const deliveryRate = totalWaybills > 0 ? Math.round((delivered / totalWaybills) * 100) : 0;
        return {
          stats: [
            { label: "Total Waybills", value: totalWaybills, icon: Package },
            { label: "Delivered", value: delivered, icon: CheckCircle },
            { label: "Pending", value: pending, icon: FileText },
          ],
          chartData: [
            { name: "Delivered", value: delivered },
            { name: "Pending", value: pending },
            { name: "Partial", value: Math.max(0, totalWaybills - delivered - pending) },
          ],
          progress: deliveryRate,
        };
      case "finance":
        const totalInvoices = invoices?.length || 0;
        const totalAmount = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
        return {
          stats: [
            { label: "Total Invoices", value: totalInvoices, icon: Receipt },
            { label: "Total Amount", value: `₦${totalAmount.toLocaleString()}`, icon: TrendingUp },
            { label: "This Month", value: invoices?.filter(i => new Date(i.created_at || "").getMonth() === new Date().getMonth())?.length || 0, icon: FileText },
          ],
          chartData: [
            { name: "Invoices", value: totalInvoices },
          ],
          progress: Math.min(100, totalInvoices * 10),
        };
      case "projects":
        const totalProjects = projects?.length || 0;
        const completed = projects?.filter(p => p.status === "completed")?.length || 0;
        const inProgress = projects?.filter(p => p.status === "in_progress")?.length || 0;
        const completionRate = totalProjects > 0 ? Math.round((completed / totalProjects) * 100) : 0;
        return {
          stats: [
            { label: "Total Projects", value: totalProjects, icon: FolderKanban },
            { label: "Completed", value: completed, icon: CheckCircle },
            { label: "In Progress", value: inProgress, icon: TrendingUp },
          ],
          chartData: [
            { name: "Completed", value: completed },
            { name: "In Progress", value: inProgress },
            { name: "Pending", value: Math.max(0, totalProjects - completed - inProgress) },
          ],
          progress: completionRate,
        };
      case "admin":
        const workflowsCompleted = workflows?.filter(w => w.current_stage === "completed")?.length || 0;
        const workflowsTotal = workflows?.length || 0;
        return {
          stats: [
            { label: "Total Workflows", value: workflowsTotal, icon: FileText },
            { label: "Completed", value: workflowsCompleted, icon: CheckCircle },
            { label: "Active", value: workflowsTotal - workflowsCompleted, icon: TrendingUp },
          ],
          chartData: [
            { name: "Completed", value: workflowsCompleted },
            { name: "Active", value: workflowsTotal - workflowsCompleted },
          ],
          progress: workflowsTotal > 0 ? Math.round((workflowsCompleted / workflowsTotal) * 100) : 0,
        };
      default:
        return { stats: [], chartData: [], progress: 0 };
    }
  };

  const metrics = getMetrics();

  if (!departmentRole) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Performance Progress</CardTitle>
          <CardDescription>
            {departmentRole === "sales" && "Quote to PO conversion rate"}
            {departmentRole === "orders" && "Delivery completion rate"}
            {departmentRole === "finance" && "Invoice processing"}
            {departmentRole === "projects" && "Project completion rate"}
            {departmentRole === "admin" && "Workflow completion rate"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={metrics.progress} className="flex-1" />
            <span className="text-sm font-medium w-12 text-right">{metrics.progress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Activity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.chartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {metrics.chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DepartmentPerformanceChart;
