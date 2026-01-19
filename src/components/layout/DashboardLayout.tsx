import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const { user, userRole } = useAuth();

  if (!userRole) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar userRole={userRole} />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4 gap-4">
            <SidebarTrigger />
            {title && <h1 className="text-xl font-semibold">{title}</h1>}
            <div className="ml-auto text-sm text-muted-foreground">
              {user?.email}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
