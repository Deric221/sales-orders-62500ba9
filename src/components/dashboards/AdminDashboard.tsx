import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, FileText, ShoppingCart, Truck, Receipt, Download, KeyRound, Search, Trash2, Eye } from "lucide-react";
import { ExpenseWorkflowVisual } from "@/components/workflow/ExpenseWorkflowVisual";
import { WorkflowVisual } from "@/components/workflow/WorkflowVisual";

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<"employee" | "manager">("employee");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedDepartmentRole, setSelectedDepartmentRole] = useState<"admin" | "sales" | "orders" | "finance" | "projects" | null>(null);
  const [selectedManagerialRole, setSelectedManagerialRole] = useState<"director_finance" | "director_business" | "director_cx" | "director_of_technology" | "head_compliance" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeRoleUserId, setChangeRoleUserId] = useState("");
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [newEmployeeTypeForUser, setNewEmployeeTypeForUser] = useState<"employee" | "manager">("employee");
  const [newDepartmentIdForUser, setNewDepartmentIdForUser] = useState<string | null>(null);
  const [newDepartmentRoleForUser, setNewDepartmentRoleForUser] = useState<"admin" | "sales" | "orders" | "finance" | "projects" | null>(null);
  const [newManagerialRoleForUser, setNewManagerialRoleForUser] = useState<"director_finance" | "director_business" | "director_cx" | "director_of_technology" | "head_compliance" | null>(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*, departments(name)");

      if (rolesError) throw rolesError;

      // Fetch manager assignments
      const { data: managerAssignments, error: assignmentsError } = await supabase
        .from("manager_assignments")
        .select("*, departments(name)");

      if (assignmentsError) throw assignmentsError;

      // Combine data
      const combinedData = profiles?.map(profile => {
        const role = userRoles?.find(r => r.user_id === profile.id);
        const managerAssignment = managerAssignments?.find(m => m.user_id === profile.id);
        
        return {
          ...profile,
          user_roles: role,
          manager_assignments: managerAssignment
        };
      });

      return combinedData || [];
    },
  });


  const { data: waybills } = useQuery({
    queryKey: ["all-waybills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waybills")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: expenseTickets } = useQuery({
    queryKey: ["all-expense-tickets"],
    queryFn: async () => {
      // Fetch expense tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from("expense_tickets")
        .select("*")
        .neq("status", "retired")
        .order("created_at", { ascending: false });
      
      if (ticketsError) throw ticketsError;
      if (!tickets || tickets.length === 0) return [];

      // Fetch all relevant profiles
      const employeeIds = tickets.map(t => t.employee_id).filter(Boolean);
      const managerIds = tickets.map(t => t.manager_id).filter(Boolean);
      const allUserIds = [...new Set([...employeeIds, ...managerIds])];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allUserIds);

      if (profilesError) throw profilesError;

      // Combine data
      return tickets.map(ticket => ({
        ...ticket,
        employee_profile: profiles?.find(p => p.id === ticket.employee_id),
        manager_profile: profiles?.find(p => p.id === ticket.manager_id),
      }));
    },
  });

  const { data: incompleteWorkflows } = useQuery({
    queryKey: ["incomplete-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tracker")
        .select(`
          *,
          quotes(*),
          customer_pos(*),
          company_pos(*),
          projects(project_name, project_number, status)
        `)
        .not("current_stage", "in", "(invoice_generated,completed)")
        .order("updated_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });


  const assignRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) {
        throw new Error("Please select a user");
      }

      // Validate: only allow managerial role assignment if employee type is manager
      if (selectedManagerialRole && selectedEmployeeType !== "manager") {
        throw new Error("Managerial roles can only be assigned to users with employee type 'manager'");
      }

      const { data, error } = await supabase.functions.invoke('admin-update-user-role', {
        body: {
          userId: selectedUserId,
          employeeType: selectedEmployeeType,
          departmentId: selectedDepartmentId,
          departmentRole: selectedDepartmentRole,
          managerialRole: selectedManagerialRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Role assigned successfully" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setSelectedUserId("");
      setSelectedEmployeeType("employee");
      setSelectedDepartmentId(null);
      setSelectedDepartmentRole(null);
      setSelectedManagerialRole(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resetPasswordUserId || !newPassword) throw new Error("User and password are required");
      if (newPassword.length < 12) throw new Error("Password must be at least 12 characters");
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /\d/.test(newPassword);
      const hasSpecialChar = /[^a-zA-Z0-9]/.test(newPassword);
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
        throw new Error("Password must contain uppercase, lowercase, number, and special character");
      }

      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: resetPasswordUserId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setResetPasswordDialogOpen(false);
      setResetPasswordUserId("");
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error resetting password", description: error.message });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async () => {
      if (!changeRoleUserId) {
        throw new Error("Please select a user");
      }

      // Validate: only allow managerial role assignment if employee type is manager
      if (newManagerialRoleForUser && newEmployeeTypeForUser !== "manager") {
        throw new Error("Managerial roles can only be assigned to users with employee type 'manager'");
      }

      const { data, error } = await supabase.functions.invoke('admin-update-user-role', {
        body: {
          userId: changeRoleUserId,
          employeeType: newEmployeeTypeForUser,
          departmentId: newDepartmentIdForUser,
          departmentRole: newDepartmentRoleForUser,
          managerialRole: newManagerialRoleForUser,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Role changed successfully" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setChangeRoleDialogOpen(false);
      setChangeRoleUserId("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error changing role", description: error.message });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async () => {
      if (!newUserEmail || !newUserPassword || !newUserFullName) {
        throw new Error("All fields are required");
      }
      if (newUserPassword.length < 12) {
        throw new Error("Password must be at least 12 characters");
      }
      const hasUppercase = /[A-Z]/.test(newUserPassword);
      const hasLowercase = /[a-z]/.test(newUserPassword);
      const hasNumber = /\d/.test(newUserPassword);
      const hasSpecialChar = /[^a-zA-Z0-9]/.test(newUserPassword);
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
        throw new Error("Password must contain uppercase, lowercase, number, and special character");
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "User added successfully" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setAddUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFullName("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error adding user", description: error.message });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!deleteUserId) throw new Error("User ID is required");

      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteUserId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setDeleteUserDialogOpen(false);
      setDeleteUserId("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error deleting user", description: error.message });
    },
  });


  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "Download failed", description: error.message });
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "File downloaded successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error downloading file", description: error.message });
    }
  };

  const viewFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) {
        toast({ variant: "destructive", title: "View failed", description: error.message });
        return;
      }
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error viewing file", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={() => setAddUserDialogOpen(true)} variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
          <Button onClick={() => navigate("/completed-orders")}>
            <FileText className="h-4 w-4 mr-2" />
            View Completed Orders
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign User Role</CardTitle>
          <CardDescription>Assign roles to users in the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="select-user">Select User</Label>
            <select
              id="select-user"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select a user...</option>
              {users?.map((user) => {
                const userRole = user.user_roles;
                const managerAssignment = user.manager_assignments;
                return (
                  <option key={user.id} value={user.id}>
                    {user.email} ({userRole?.employee_type || 'employee'}
                    {userRole?.departments?.name ? ` - ${userRole.departments.name}` : ''}
                    {userRole?.department_role ? ` - ${userRole.department_role}` : ''}
                    {managerAssignment?.role ? ` - ${managerAssignment.role.replace(/_/g, ' ')}` : ''})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="select-employee-type">Employee Type</Label>
            <select
              id="select-employee-type"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedEmployeeType}
              onChange={(e) => setSelectedEmployeeType(e.target.value as "employee" | "manager")}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="select-department">Department</Label>
            <select
              id="select-department"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedDepartmentId || ""}
              onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
            >
              <option value="">No Department</option>
              {departments?.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="select-department-role">Department Role (Optional)</Label>
            <select
              id="select-department-role"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedDepartmentRole || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDepartmentRole(value ? value as "admin" | "sales" | "orders" | "finance" | "projects" : null);
              }}
            >
              <option value="">No Role</option>
              <option value="sales">Sales</option>
              <option value="orders">Orders</option>
              <option value="finance">Finance</option>
              <option value="projects">Projects</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="select-managerial-role">Managerial Role (Managers only)</Label>
            <select
              id="select-managerial-role"
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
              value={selectedManagerialRole || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedManagerialRole(value ? value as "director_finance" | "director_business" | "director_cx" | "head_compliance" : null);
              }}
              disabled={selectedEmployeeType !== "manager"}
            >
              <option value="">No Managerial Role</option>
              <option value="director_finance">Director of Finance</option>
              <option value="director_business">Director of Business</option>
              <option value="director_cx">Director of CX</option>
              <option value="head_compliance">Head of Compliance</option>
            </select>
            {selectedEmployeeType !== "manager" && (
              <p className="text-sm text-muted-foreground">
                Only users with employee type "manager" can be assigned managerial roles
              </p>
            )}
          </div>

          <Button
            onClick={() => assignRoleMutation.mutate()}
            disabled={!selectedUserId || assignRoleMutation.isPending}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all system users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users?.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-sm text-muted-foreground">
                      {user.full_name || "No name"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm flex flex-col gap-1">
                    {(() => {
                      const userRole = user.user_roles;
                      const managerAssignment = user.manager_assignments;
                      return (
                        <>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded capitalize">
                            {userRole?.employee_type || 'employee'}
                          </span>
                          {userRole?.departments?.name && (
                            <span className="px-2 py-1 bg-secondary/10 text-secondary-foreground rounded text-xs">
                              Dept: {userRole.departments.name}
                            </span>
                          )}
                          {userRole?.department_role && (
                            <span className="px-2 py-1 bg-accent/10 text-accent-foreground rounded text-xs">
                              Role: {userRole.department_role}
                            </span>
                          )}
                          {managerAssignment?.role && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 rounded text-xs">
                              Manager: {managerAssignment.role.replace(/_/g, ' ')}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setChangeRoleUserId(user.id);
                      const userRole = user.user_roles;
                      const managerAssignment = user.manager_assignments;
                      setNewEmployeeTypeForUser(userRole?.employee_type || "employee");
                      setNewDepartmentIdForUser(userRole?.department_id || null);
                      setNewDepartmentRoleForUser(userRole?.department_role || null);
                      setNewManagerialRoleForUser(managerAssignment?.role || null);
                      setChangeRoleDialogOpen(true);
                    }}
                  >
                    Change Role
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setResetPasswordUserId(user.id);
                      setResetPasswordDialogOpen(true);
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeleteUserId(user.id);
                      setDeleteUserDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {!users?.length && (
              <div className="text-center text-muted-foreground py-8">No users found</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search All Orders</CardTitle>
          <CardDescription>Search across all sales and purchase orders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by quote number, customer name, PO number, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incomplete Workflows</CardTitle>
          <CardDescription>Track ongoing order workflows not yet completed</CardDescription>
        </CardHeader>
        <CardContent>
          {incompleteWorkflows && incompleteWorkflows.length > 0 ? (
            <div className="space-y-4">
              {incompleteWorkflows.map((workflow: any) => (
                <Card key={workflow.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{workflow.quotes?.quote_number}</h4>
                          <p className="text-sm text-muted-foreground">{workflow.quotes?.customer_name}</p>
                        </div>
                        <Badge variant="secondary">
                          {workflow.current_stage.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {workflow.quotes?.file_path && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => viewFile(workflow.quotes.file_path)}>
                              <Eye className="h-4 w-4 mr-1" />View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadFile(workflow.quotes.file_path, workflow.quotes.file_name)}>
                              <Download className="h-4 w-4 mr-1" />Quote
                            </Button>
                          </>
                        )}
                        {workflow.customer_pos?.file_path && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => viewFile(workflow.customer_pos.file_path)}>
                              <Eye className="h-4 w-4 mr-1" />View CPO
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadFile(workflow.customer_pos.file_path, workflow.customer_pos.file_name)}>
                              <Download className="h-4 w-4 mr-1" />Customer PO
                            </Button>
                          </>
                        )}
                        {workflow.company_pos?.file_path && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => viewFile(workflow.company_pos.file_path)}>
                              <Eye className="h-4 w-4 mr-1" />View CoPO
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadFile(workflow.company_pos.file_path, workflow.company_pos.file_name)}>
                              <Download className="h-4 w-4 mr-1" />Company PO
                            </Button>
                          </>
                        )}
                      </div>
                      
                      <WorkflowVisual 
                        currentStage={workflow.current_stage}
                        hasProject={!!workflow.project_id}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No incomplete workflows found
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Password must be at least 12 characters with uppercase, lowercase, number, and special character.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialogOpen(false);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="change-employee-type">Employee Type</Label>
              <select
                id="change-employee-type"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={newEmployeeTypeForUser}
                onChange={(e) => setNewEmployeeTypeForUser(e.target.value as "employee" | "manager")}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-department">Department</Label>
              <select
                id="change-department"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={newDepartmentIdForUser || ""}
                onChange={(e) => setNewDepartmentIdForUser(e.target.value || null)}
              >
                <option value="">No Department</option>
                {departments?.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-department-role">Department Role (Optional)</Label>
              <select
                id="change-department-role"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={newDepartmentRoleForUser || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewDepartmentRoleForUser(value ? value as "admin" | "sales" | "orders" | "finance" | "projects" : null);
                }}
              >
                <option value="">No Role</option>
                <option value="sales">Sales</option>
                <option value="orders">Orders</option>
                <option value="finance">Finance</option>
                <option value="projects">Projects</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-managerial-role">Managerial Role (Optional)</Label>
              <select
                id="change-managerial-role"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={newManagerialRoleForUser || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewManagerialRoleForUser(value ? value as "director_finance" | "director_business" | "director_cx" | "head_compliance" : null);
                }}
              >
                <option value="">No Managerial Role</option>
                <option value="director_finance">Director of Finance</option>
                <option value="director_business">Director of Business</option>
                <option value="director_cx">Director of CX</option>
                <option value="head_compliance">Head of Compliance</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangeRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => changeRoleMutation.mutate()}
              disabled={changeRoleMutation.isPending}
            >
              {changeRoleMutation.isPending ? "Changing..." : "Change Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. Password must be at least 12 characters with uppercase, lowercase, number, and special character.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Full Name</Label>
              <Input
                id="new-user-name"
                type="text"
                placeholder="John Doe"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                placeholder="user@company.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                placeholder="Min 12 chars: Aa1!"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must include uppercase, lowercase, number, and special character
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddUserDialogOpen(false);
                setNewUserEmail("");
                setNewUserPassword("");
                setNewUserFullName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => addUserMutation.mutate()}
              disabled={addUserMutation.isPending}
            >
              {addUserMutation.isPending ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteUserDialogOpen(false);
                setDeleteUserId("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserMutation.mutate()}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
