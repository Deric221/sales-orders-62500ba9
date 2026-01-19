import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  if (noRoleAssigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="max-w-md w-full mx-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Assignment Pending</CardTitle>
              <CardDescription>
                Your account has been created successfully, but you haven't been assigned a role yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please contact your administrator to assign you a role to access the system.
              </p>
              <Button onClick={signOut} className="w-full" variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (userRole.department_role) {
      case "sales":
        return <SalesDashboard />;
      case "orders":
        return <OrdersDashboard />;
      case "finance":
        return <FinanceDashboard />;
      case "projects":
        return <ProjectsDashboard />;
      case "admin":
        return <AdminDashboard />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (userRole.department_role) {
      case "sales": return "Sales Dashboard";
      case "orders": return "Orders Dashboard";
      case "finance": return "Finance Dashboard";
      case "projects": return "Projects Dashboard";
      case "admin": return "Admin Dashboard";
      default: return "Dashboard";
    }
  };

  return (
    <DashboardLayout title={getTitle()}>
      {renderDashboard()}
    </DashboardLayout>
  );
};

export default Dashboard;
