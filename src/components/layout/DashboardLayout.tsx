import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  ribbon?: ReactNode;
}

const DashboardLayout = ({ children, title, ribbon }: DashboardLayoutProps) => {
  const { user, userRole } = useAuth();

  if (!userRole) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar userRole={userRole} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 border-b bg-card flex items-center px-4 gap-4">
            <SidebarTrigger />
            {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </header>
          {ribbon}
          <main className="flex-1 p-4 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
