import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import DashboardFeatureLinks from "@/components/dashboards/DashboardFeatureLinks";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  if (noRoleAssigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  const getDescription = () => {
    switch (userRole.department_role) {
      case "sales":
        return "Manage quotes, track customer POs, and monitor your sales pipeline. Upload documents and coordinate with the orders team.";
      case "orders":
        return "Process company purchase orders, create waybills, manage deliveries, and upload distributor invoices. Track order fulfillment.";
      case "finance":
        return "Generate invoices for completed orders, manage expense payments, and oversee financial workflows.";
      case "projects":
        return "Manage project lifecycles, track documentation, and mark projects as complete for invoicing.";
      case "admin":
        return "Oversee all system activities, manage users and roles, track workflows, and monitor expense tickets.";
      default:
        return "Welcome to your dashboard.";
    }
  };

  const getFeatures = () => {
    switch (userRole.department_role) {
      case "sales":
        return ["Upload Quotes", "Link Customer POs", "Track Documents"];
      case "orders":
        return ["Create Waybills", "Upload Company POs", "Manage Deliveries"];
      case "finance":
        return ["Generate Invoices", "Expense Payments", "Order Lookup"];
      case "projects":
        return ["Project Management", "Documentation", "Completion Tracking"];
      case "admin":
        return ["User Management", "Workflow Tracking", "System Overview"];
      default:
        return [];
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
      <div className="space-y-6">
        <WelcomeHeader
          pageDescription={getDescription()}
          features={getFeatures()}
        />
        
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">{userRole.department_role} Quick Actions</CardTitle>
            <CardDescription>
              Access your department's key features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardFeatureLinks departmentRole={userRole.department_role} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
