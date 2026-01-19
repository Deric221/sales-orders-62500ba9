import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import EmployeeExpenseDashboard from "@/components/expenses/EmployeeExpenseDashboard";
import ManagerExpenseDashboard from "@/components/expenses/ManagerExpenseDashboard";
import FinanceExpenseDashboard from "@/components/expenses/FinanceExpenseDashboard";
const ExpenseDashboard = () => {
  const {
    user,
    userRole,
    loading,
    signOut,
    noRoleAssigned
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) {
      navigate("/expense-auth");
    }
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>;
  }
  if (!user || !userRole) {
    return null;
  }

  // Expense system allows access for all users with employee_type (even without department_role)
  // Only check if they have employee_type set
  const hasAccess = userRole.employee_type === "employee" || userRole.employee_type === "manager";
  if (!hasAccess) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have access to the expense ticket system.</p>
          <Button onClick={() => navigate("/")}>Go to Home</Button>
        </div>
      </div>;
  }
  const renderDashboard = () => {
    // All managers (including finance) get the manager approval dashboard
    // Employees get employee dashboard
    return userRole.employee_type === "manager" ? <ManagerExpenseDashboard /> : <EmployeeExpenseDashboard />;
  };
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img alt="Logo" className="h-8 w-8" src="/lovable-uploads/5bf41aad-4444-4704-b092-2f758189b017.jpg" />
            <h1 className="text-2xl font-bold">Expense Ticket System</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="font-medium">{user.email}</div>
              <div className="text-muted-foreground capitalize">
                {userRole.employee_type}
                {userRole.department_role && ` - ${userRole.department_role}`}
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {renderDashboard()}
      </main>
    </div>;
};
export default ExpenseDashboard;