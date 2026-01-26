import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FinanceDashboard from "@/components/dashboards/FinanceDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const FinanceInvoices = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || !userRole) {
    navigate("/auth");
    return null;
  }

  return (
    <DashboardLayout title="Invoice Management">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <FinanceDashboard />
      </div>
    </DashboardLayout>
  );
};

export default FinanceInvoices;
