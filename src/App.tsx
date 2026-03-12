import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SearchResults from "./pages/SearchResults";
import CompletedOrders from "./pages/CompletedOrders";
import AllWaybills from "./pages/AllWaybills";
import CompletedProjects from "./pages/CompletedProjects";
import ExpenseAuth from "./pages/ExpenseAuth";
import ExpenseDashboard from "./pages/ExpenseDashboard";
import OrderLookup from "./pages/OrderLookup";
import DeliveryManagementPage from "./pages/DeliveryManagementPage";
import WaybillManagement from "./pages/WaybillManagement";
import UploadCompanyPO from "./pages/UploadCompanyPO";
import UploadDistributorInvoice from "./pages/UploadDistributorInvoice";
import ExpensePayments from "./pages/ExpensePayments";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminWorkflowTracking from "./pages/AdminWorkflowTracking";
import AdminExpenseOverview from "./pages/AdminExpenseOverview";
import AdminWaybillOverview from "./pages/AdminWaybillOverview";
import SalesQuotes from "./pages/SalesQuotes";
import SalesUploadQuote from "./pages/SalesUploadQuote";
import SalesCustomerPO from "./pages/SalesCustomerPO";
import SalesDistributorQuote from "./pages/SalesDistributorQuote";
import SalesCustomerManagement from "./pages/SalesCustomerManagement";
import SalesOrderTracking from "./pages/SalesOrderTracking";
import OrdersDistributorManagement from "./pages/OrdersDistributorManagement";
import FinanceInvoices from "./pages/FinanceInvoices";
import ProjectsManagement from "./pages/ProjectsManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/completed-orders" element={<CompletedOrders />} />
            <Route path="/all-waybills" element={<AllWaybills />} />
            <Route path="/completed-projects" element={<CompletedProjects />} />
            <Route path="/expense-auth" element={<ExpenseAuth />} />
            <Route path="/expense-dashboard" element={<ExpenseDashboard />} />
            <Route path="/order-lookup" element={<OrderLookup />} />
            <Route path="/delivery-management" element={<DeliveryManagementPage />} />
            <Route path="/waybill-management" element={<WaybillManagement />} />
            <Route path="/upload-company-po" element={<UploadCompanyPO />} />
            <Route path="/upload-distributor-invoice" element={<UploadDistributorInvoice />} />
            <Route path="/expense-payments" element={<ExpensePayments />} />
            <Route path="/admin/users" element={<AdminUserManagement />} />
            <Route path="/admin/workflows" element={<AdminWorkflowTracking />} />
            <Route path="/admin/expenses" element={<AdminExpenseOverview />} />
            <Route path="/admin/waybills" element={<AdminWaybillOverview />} />
            <Route path="/sales-quotes" element={<SalesQuotes />} />
            <Route path="/sales-upload-quote" element={<SalesUploadQuote />} />
            <Route path="/sales-customer-po" element={<SalesCustomerPO />} />
            <Route path="/sales-distributor-quote" element={<SalesDistributorQuote />} />
            <Route path="/finance-invoices" element={<FinanceInvoices />} />
            <Route path="/projects-management" element={<ProjectsManagement />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
