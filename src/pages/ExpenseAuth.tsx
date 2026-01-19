import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
const ExpenseAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Client-side password validation
    if (password.length < 12) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 12 characters long",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
      toast({
        title: "Invalid Password",
        description: "Password must contain uppercase, lowercase, number, and special character",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      // Check user role to redirect to appropriate expense dashboard
      const {
        data: roleData,
        error: roleError
      } = await supabase.from("user_roles").select("employee_type, department_role").eq("user_id", data.user.id).single();
      if (roleError || !roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have access to the expense ticket system.",
          variant: "destructive"
        });
        await supabase.auth.signOut();
        return;
      }

      // Allow all employees/managers, plus finance department role
      const hasAccess = roleData.employee_type === "employee" || roleData.employee_type === "manager" || roleData.department_role === "finance";
      if (hasAccess) {
        navigate("/expense-dashboard");
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have access to the expense ticket system.",
          variant: "destructive"
        });
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img alt="Logo" className="h-12 w-12" src="/lovable-uploads/f4270385-62bf-44ca-984b-a6b433cf86cb.jpg" />
          <h1 className="text-3xl font-bold">Expense Ticket System</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the expense ticket system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} required />
                <p className="text-xs text-muted-foreground">
                  Minimum 12 characters with uppercase, lowercase, number, and special character
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
          Back to Home
        </Button>
      </div>
    </div>;
};
export default ExpenseAuth;