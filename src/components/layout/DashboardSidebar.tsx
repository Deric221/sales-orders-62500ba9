import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Package,
  Truck,
  Receipt,
  Search,
  User,
  LogOut,
  Key,
  FolderKanban,
  CreditCard,
  FileCheck,
  Settings,
} from "lucide-react";

interface DashboardSidebarProps {
  userRole: {
    employee_type: "employee" | "manager";
    department_role: "admin" | "sales" | "orders" | "finance" | "projects" | null;
  };
}

const DashboardSidebar = ({ userRole }: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const [showProfile, setShowProfile] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast({ title: "Password updated successfully" });
      setShowPasswordReset(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update password",
        description: error.message,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Define menu items based on role
  const getMenuItems = () => {
    const baseItems = [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ];

    const salesItems = [
      { title: "Quotes & Documents", icon: FileText, path: "/sales-quotes" },
    ];

    const ordersItems = [
      { title: "Upload Company PO", icon: Upload, path: "/upload-company-po" },
      { title: "Upload Distributor Invoice", icon: FileCheck, path: "/upload-distributor-invoice" },
      { title: "Create Waybill", icon: Truck, path: "/waybill-management" },
      { title: "Order Lookup", icon: Search, path: "/order-lookup" },
      { title: "Delivery Management", icon: Package, path: "/delivery-management" },
    ];

    const financeItems = [
      { title: "Invoice Management", icon: Receipt, path: "/dashboard" },
      { title: "Order Lookup", icon: Search, path: "/order-lookup" },
      { title: "Expense Payments", icon: CreditCard, path: "/expense-payments" },
    ];

    const projectsItems = [
      { title: "Project Management", icon: FolderKanban, path: "/dashboard" },
      { title: "Completed Projects", icon: FileCheck, path: "/completed-projects" },
    ];

    const adminItems = [
      { title: "User Management", icon: Settings, path: "/admin/users" },
      { title: "Workflow Tracking", icon: FileText, path: "/admin/workflows" },
      { title: "Expense Overview", icon: Receipt, path: "/admin/expenses" },
      { title: "Waybill Overview", icon: Truck, path: "/admin/waybills" },
    ];

    switch (userRole.department_role) {
      case "sales":
        return { base: baseItems, department: salesItems };
      case "orders":
        return { base: baseItems, department: ordersItems };
      case "finance":
        return { base: baseItems, department: financeItems };
      case "projects":
        return { base: baseItems, department: projectsItems };
      case "admin":
        return { base: baseItems, department: adminItems };
      default:
        return { base: baseItems, department: [] };
    }
  };

  const menuItems = getMenuItems();

  const getRoleLabel = () => {
    if (!userRole.department_role) return userRole.employee_type;
    return `${userRole.employee_type} - ${userRole.department_role}`;
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-2">
            <img
              alt="Logo"
              className="h-8 w-8"
              src="/lovable-uploads/911cb943-1516-4814-bade-6006da2aa631.jpg"
            />
            {!collapsed && (
              <span className="font-semibold text-sm">Sales & Orders</span>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.base.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
                      isActive={isActive(item.path)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Department Features */}
          {menuItems.department.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="capitalize">
                {userRole.department_role} Features
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.department.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={isActive(item.path)}
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Expense System */}
          <SidebarGroup>
            <SidebarGroupLabel>Expense System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/expense-dashboard")}
                    isActive={isActive("/expense-dashboard")}
                    tooltip="Expense Tickets"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Expense Tickets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setShowProfile(true)} tooltip="User Profile">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sign Out">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Your account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">
                  {userRole.employee_type}
                </Badge>
                {userRole.department_role && (
                  <Badge className="capitalize">{userRole.department_role}</Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowProfile(false);
                setShowPasswordReset(true);
              }}
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your new password</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button
              className="w-full"
              onClick={handlePasswordReset}
              disabled={isResetting || !newPassword || !confirmPassword}
            >
              {isResetting ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardSidebar;
