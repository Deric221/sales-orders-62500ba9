import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ExpensePaymentManagement from "@/components/expenses/ExpensePaymentManagement";

const ExpensePayments = () => {
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
    <DashboardLayout title="Expense Payments">
      <ExpensePaymentManagement />
    </DashboardLayout>
  );
};

export default ExpensePayments;
