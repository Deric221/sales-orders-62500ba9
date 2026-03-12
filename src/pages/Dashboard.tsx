import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, FileText, Upload, Search, Package, Truck, Receipt, FolderKanban, FileCheck, CreditCard, Settings, Plus, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import CueTile from "@/components/bc/CueTile";
import ActionRibbon, { RibbonGroup } from "@/components/bc/ActionRibbon";
import FactBox from "@/components/bc/FactBox";
import DepartmentPerformanceChart from "@/components/charts/DepartmentPerformanceChart";
import SalesDashboard from "@/components/dashboards/SalesDashboard";
import OrdersDashboard from "@/components/dashboards/OrdersDashboard";
import FinanceDashboard from "@/components/dashboards/FinanceDashboard";
import ProjectsDashboard from "@/components/dashboards/ProjectsDashboard";
import AdminDashboard from "@/components/dashboards/AdminDashboard";

const Dashboard = () => {
  const { user, userRole, loading, signOut, noRoleAssigned } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch counts for KPI tiles
  const { data: quotesCount } = useQuery({
    queryKey: ["quotes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!user && (userRole?.department_role === "sales" || userRole?.department_role === "admin"),
  });

  const { data: workflowsData } = useQuery({
    queryKey: ["workflows-kpi"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_tracker").select("current_stage, customer_po_id, company_po_id, invoice_id");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: waybillsCount } = useQuery({
    queryKey: ["waybills-count"],
    queryFn: async () => {
      const { count } = await supabase.from("waybills").select("*", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!user && (userRole?.department_role === "orders" || userRole?.department_role === "admin"),
  });

  const { data: invoicesCount } = useQuery({
    queryKey: ["invoices-count"],
    queryFn: async () => {
      const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!user && (userRole?.department_role === "finance" || userRole?.department_role === "admin"),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects-kpi"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("status");
      return data || [];
    },
    enabled: !!user && (userRole?.department_role === "projects" || userRole?.department_role === "admin"),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !userRole) return null;

  if (noRoleAssigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Assignment Pending</CardTitle>
              <CardDescription>Your account has been created but you haven't been assigned a role yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Please contact your administrator to assign you a role.</p>
              <Button onClick={signOut} className="w-full" variant="outline">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    switch (userRole.department_role) {
      case "sales": return "Sales Dashboard";
      case "orders": return "Orders Dashboard";
      case "finance": return "Finance Dashboard";
      case "projects": return "Projects Dashboard";
      case "admin": return "Administration";
      default: return "Dashboard";
    }
  };

  const getCueTiles = () => {
    const pendingPO = workflowsData?.filter(w => w.current_stage === "quote_uploaded").length || 0;
    const awaitingInvoice = workflowsData?.filter(w => w.current_stage === "waybill_created" || w.current_stage === "company_po_uploaded").length || 0;

    switch (userRole.department_role) {
      case "sales":
        return [
          { title: "Total Quotes", value: quotesCount || 0, icon: FileText, color: "blue" as const, path: "/sales-quotes" },
          { title: "Pending Customer PO", value: pendingPO, icon: FileCheck, color: "amber" as const, path: "/sales-customer-po" },
          { title: "Workflows Active", value: workflowsData?.filter(w => w.current_stage !== "completed").length || 0, icon: RefreshCw, color: "green" as const },
          { title: "Completed", value: workflowsData?.filter(w => w.current_stage === "completed").length || 0, icon: FileCheck, color: "purple" as const },
        ];
      case "orders":
        return [
          { title: "Total Waybills", value: waybillsCount || 0, icon: Truck, color: "blue" as const, path: "/waybill-management" },
          { title: "Awaiting Invoice", value: awaitingInvoice, icon: Receipt, color: "amber" as const },
          { title: "Pending PO Upload", value: workflowsData?.filter(w => w.current_stage === "customer_po_uploaded").length || 0, icon: Upload, color: "red" as const, path: "/upload-company-po" },
          { title: "Deliveries", value: waybillsCount || 0, icon: Package, color: "green" as const, path: "/delivery-management" },
        ];
      case "finance":
        return [
          { title: "Total Invoices", value: invoicesCount || 0, icon: Receipt, color: "blue" as const, path: "/finance-invoices" },
          { title: "Awaiting Invoice", value: awaitingInvoice, icon: FileText, color: "amber" as const, path: "/finance-invoices" },
          { title: "Workflows Active", value: workflowsData?.filter(w => w.current_stage !== "completed").length || 0, icon: RefreshCw, color: "green" as const },
          { title: "Expense Payments", value: 0, icon: CreditCard, color: "purple" as const, path: "/expense-payments", subtitle: "View pending" },
        ];
      case "projects":
        return [
          { title: "Total Projects", value: projectsData?.length || 0, icon: FolderKanban, color: "blue" as const, path: "/projects-management" },
          { title: "In Progress", value: projectsData?.filter(p => p.status === "in_progress").length || 0, icon: RefreshCw, color: "amber" as const },
          { title: "Completed", value: projectsData?.filter(p => p.status === "completed").length || 0, icon: FileCheck, color: "green" as const, path: "/completed-projects" },
          { title: "Pending", value: projectsData?.filter(p => p.status !== "completed" && p.status !== "in_progress").length || 0, icon: FileText, color: "red" as const },
        ];
      case "admin":
        return [
          { title: "Total Workflows", value: workflowsData?.length || 0, icon: FileText, color: "blue" as const, path: "/admin/workflows" },
          { title: "Active", value: workflowsData?.filter(w => w.current_stage !== "completed").length || 0, icon: RefreshCw, color: "amber" as const },
          { title: "Completed", value: workflowsData?.filter(w => w.current_stage === "completed").length || 0, icon: FileCheck, color: "green" as const },
          { title: "Total Quotes", value: quotesCount || 0, icon: FileText, color: "purple" as const },
        ];
      default:
        return [];
    }
  };

  const getRibbonGroups = (): RibbonGroup[] => {
    switch (userRole.department_role) {
      case "sales":
        return [
          { label: "New", actions: [
            { label: "New Quote", icon: Plus, onClick: () => navigate("/sales-upload-quote") },
            { label: "Customer PO", icon: Upload, onClick: () => navigate("/sales-customer-po") },
          ]},
          { label: "View", actions: [
            { label: "All Quotes", icon: FileText, onClick: () => navigate("/sales-quotes") },
            { label: "Dist. Quotes", icon: FileCheck, onClick: () => navigate("/sales-distributor-quote") },
          ]},
        ];
      case "orders":
        return [
          { label: "New", actions: [
            { label: "Company PO", icon: Plus, onClick: () => navigate("/upload-company-po") },
            { label: "Waybill", icon: Truck, onClick: () => navigate("/waybill-management") },
          ]},
          { label: "Process", actions: [
            { label: "Dist. Invoice", icon: Upload, onClick: () => navigate("/upload-distributor-invoice") },
            { label: "Deliveries", icon: Package, onClick: () => navigate("/delivery-management") },
          ]},
          { label: "Find", actions: [
            { label: "Order Lookup", icon: Search, onClick: () => navigate("/order-lookup") },
          ]},
        ];
      case "finance":
        return [
          { label: "Process", actions: [
            { label: "Invoices", icon: Receipt, onClick: () => navigate("/finance-invoices") },
            { label: "Expenses", icon: CreditCard, onClick: () => navigate("/expense-payments") },
          ]},
          { label: "Find", actions: [
            { label: "Order Lookup", icon: Search, onClick: () => navigate("/order-lookup") },
          ]},
        ];
      case "projects":
        return [
          { label: "Manage", actions: [
            { label: "Projects", icon: FolderKanban, onClick: () => navigate("/projects-management") },
            { label: "Completed", icon: FileCheck, onClick: () => navigate("/completed-projects") },
          ]},
        ];
      case "admin":
        return [
          { label: "System", actions: [
            { label: "Users", icon: Settings, onClick: () => navigate("/admin/users") },
            { label: "Workflows", icon: FileText, onClick: () => navigate("/admin/workflows") },
          ]},
          { label: "Reports", actions: [
            { label: "Expenses", icon: Receipt, onClick: () => navigate("/admin/expenses") },
            { label: "Waybills", icon: Truck, onClick: () => navigate("/admin/waybills") },
          ]},
        ];
      default:
        return [];
    }
  };

  const getFactBoxSections = () => {
    const active = workflowsData?.filter(w => w.current_stage !== "completed").length || 0;
    const completed = workflowsData?.filter(w => w.current_stage === "completed").length || 0;
    const total = workflowsData?.length || 0;

    return [
      {
        title: "Workflow Summary",
        items: [
          { label: "Total", value: total },
          { label: "Active", value: active },
          { label: "Completed", value: completed },
          { label: "Rate", value: total > 0 ? `${Math.round((completed / total) * 100)}%` : "0%" },
        ],
      },
    ];
  };

  const getWelcomeDescription = () => {
    switch (userRole.department_role) {
      case "sales": return "Manage quotes, customer POs, and distributor quotes. Track your sales pipeline.";
      case "orders": return "Process company POs, create waybills, and manage deliveries.";
      case "finance": return "Generate invoices, manage expense payments, and track financial workflows.";
      case "projects": return "Track project progress, upload documentation, and mark completions.";
      case "admin": return "Manage users, monitor workflows, and oversee all department activities.";
      default: return "Welcome to your dashboard.";
    }
  };

  const getWelcomeFeatures = () => {
    switch (userRole.department_role) {
      case "sales": return ["Upload Quotes", "Link Customer POs", "Track Orders"];
      case "orders": return ["Company POs", "Waybills", "Deliveries"];
      case "finance": return ["Invoices", "Expense Payments", "Order Lookup"];
      case "projects": return ["Manage Projects", "Upload Docs", "Track Status"];
      case "admin": return ["User Management", "Workflows", "Reports"];
      default: return [];
    }
  };

  const ribbonGroups = getRibbonGroups();

  return (
    <DashboardLayout
      title={getTitle()}
      ribbon={ribbonGroups.length > 0 ? <ActionRibbon groups={ribbonGroups} /> : undefined}
    >
      <div className="space-y-4 relative">
        {/* Greeting Card */}
        <WelcomeHeader
          pageDescription={getWelcomeDescription()}
          features={getWelcomeFeatures()}
        />

        {/* KPI Cue Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {getCueTiles().map((tile) => (
            <CueTile key={tile.title} {...tile} />
          ))}
        </div>

        {/* Main content with optional FactBox */}
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <DepartmentPerformanceChart departmentRole={userRole.department_role} />
          </div>
        </div>

        {/* FactBox */}
        <FactBox sections={getFactBoxSections()} />

        {/* Department-specific Dashboard */}
        {userRole.department_role === "sales" && <SalesDashboard />}
        {userRole.department_role === "orders" && <OrdersDashboard />}
        {userRole.department_role === "finance" && <FinanceDashboard />}
        {userRole.department_role === "projects" && <ProjectsDashboard />}
        {userRole.department_role === "admin" && <AdminDashboard />}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
