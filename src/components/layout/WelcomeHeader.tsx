import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { User, Briefcase, Clock } from "lucide-react";

interface WelcomeHeaderProps {
  features: string[];
  pageDescription: string;
}

const WelcomeHeader = ({ features, pageDescription }: WelcomeHeaderProps) => {
  const { user, userRole } = useAuth();
  const [userName, setUserName] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("");

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        setGreeting("Good Morning");
      } else if (hour >= 12 && hour < 17) {
        setGreeting("Good Afternoon");
      } else if (hour >= 17 && hour < 21) {
        setGreeting("Good Evening");
      } else {
        setGreeting("Hello");
      }
    };

    updateGreeting();
    const interval = setInterval(updateGreeting, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) {
        // Get first name only
        const firstName = profile.full_name.split(" ")[0];
        setUserName(firstName);
      } else if (profile?.email) {
        // Use email username if no name
        setUserName(profile.email.split("@")[0]);
      }
    };

    fetchUserName();
  }, [user?.id]);

  const getRoleDisplay = () => {
    if (!userRole) return "";
    const deptRole = userRole.department_role
      ? userRole.department_role.charAt(0).toUpperCase() + userRole.department_role.slice(1)
      : "";
    const empType = userRole.employee_type === "manager" ? "Manager" : "Employee";
    return `${empType}${deptRole ? ` • ${deptRole} Department` : ""}`;
  };

  return (
    <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {greeting}, {userName || "User"}! 👋
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>{getRoleDisplay()}</span>
            </div>
            <p className="text-muted-foreground mt-2">{pageDescription}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-muted-foreground">Quick Overview:</div>
            <div className="flex flex-wrap gap-2">
              {features.map((feature, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WelcomeHeader;
