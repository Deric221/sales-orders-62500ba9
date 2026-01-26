import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Upload,
  Package,
  Truck,
  Receipt,
  Search,
  FolderKanban,
  CreditCard,
  FileCheck,
  Settings,
  Users,
} from "lucide-react";

interface DashboardFeatureLinksProps {
  departmentRole: "admin" | "sales" | "orders" | "finance" | "projects" | null;
}

const DashboardFeatureLinks = ({ departmentRole }: DashboardFeatureLinksProps) => {
  const navigate = useNavigate();

  const getFeatureLinks = () => {
    switch (departmentRole) {
      case "sales":
        return [
          { title: "Upload Quote", icon: FileText, path: "/sales-upload-quote", description: "Upload new quotes" },
          { title: "Customer PO", icon: Upload, path: "/sales-customer-po", description: "Link customer purchase orders" },
          { title: "Distributor Quote", icon: FileCheck, path: "/sales-distributor-quote", description: "Manage distributor quotes" },
          { title: "Quotes & Documents", icon: FileText, path: "/sales-quotes", description: "View linked documents" },
        ];
      case "orders":
        return [
          { title: "Upload Company PO", icon: Upload, path: "/upload-company-po", description: "Upload company purchase orders" },
          { title: "Upload Distributor Invoice", icon: FileCheck, path: "/upload-distributor-invoice", description: "Upload distributor invoices" },
          { title: "Create Waybill", icon: Truck, path: "/waybill-management", description: "Create and manage waybills" },
          { title: "Order Lookup", icon: Search, path: "/order-lookup", description: "Search and track orders" },
          { title: "Delivery Management", icon: Package, path: "/delivery-management", description: "Manage deliveries" },
        ];
      case "finance":
        return [
          { title: "Invoice Management", icon: Receipt, path: "/finance-invoices", description: "Generate and manage invoices" },
          { title: "Order Lookup", icon: Search, path: "/order-lookup", description: "Search orders for invoicing" },
          { title: "Expense Payments", icon: CreditCard, path: "/expense-payments", description: "Process expense payments" },
        ];
      case "projects":
        return [
          { title: "Project Management", icon: FolderKanban, path: "/projects-management", description: "Manage project lifecycle" },
          { title: "Completed Projects", icon: FileCheck, path: "/completed-projects", description: "View completed projects" },
        ];
      case "admin":
        return [
          { title: "User Management", icon: Users, path: "/admin/users", description: "Manage system users" },
          { title: "Workflow Tracking", icon: FileText, path: "/admin/workflows", description: "Track all workflows" },
          { title: "Expense Overview", icon: Receipt, path: "/admin/expenses", description: "View expense reports" },
          { title: "Waybill Overview", icon: Truck, path: "/admin/waybills", description: "View all waybills" },
        ];
      default:
        return [];
    }
  };

  const features = getFeatureLinks();

  if (features.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {features.map((feature) => (
        <Button
          key={feature.path}
          variant="outline"
          size="sm"
          onClick={() => navigate(feature.path)}
          className="gap-2 bg-card hover:bg-accent"
        >
          <feature.icon className="h-4 w-4" />
          {feature.title}
        </Button>
      ))}
    </div>
  );
};

export default DashboardFeatureLinks;
