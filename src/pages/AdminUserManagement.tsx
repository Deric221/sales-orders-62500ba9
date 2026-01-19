import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, KeyRound, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";

const AdminUserManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<"employee" | "manager">("employee");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedDepartmentRole, setSelectedDepartmentRole] = useState<"admin" | "sales" | "orders" | "finance" | "projects" | null>(null);
  const [selectedManagerialRole, setSelectedManagerialRole] = useState<"director_finance" | "director_business" | "director_cx" | "director_of_technology" | "head_compliance" | null>(null);
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
  const [searchQuery, setSearchQuery] = useState("");

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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*, departments(name)");

      if (rolesError) throw rolesError;

      const { data: managerAssignments, error: assignmentsError } = await supabase
        .from("manager_assignments")
        .select("*, departments(name)");

      if (assignmentsError) throw assignmentsError;

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

  const filteredUsers = users?.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.user_roles?.department_role?.toLowerCase().includes(query)
    );
  });

  const assignRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Please select a user");
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

  const addUserMutation = useMutation({
    mutationFn: async () => {
      if (!newUserEmail || !newUserPassword || !newUserFullName) throw new Error("All fields are required");
      if (newUserPassword.length < 12) throw new Error("Password must be at least 12 characters");
      const hasUppercase = /[A-Z]/.test(newUserPassword);
      const hasLowercase = /[a-z]/.test(newUserPassword);
      const hasNumber = /\d/.test(newUserPassword);
      const hasSpecialChar = /[^a-zA-Z0-9]/.test(newUserPassword);
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
        throw new Error("Password must contain uppercase, lowercase, number, and special character");
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: newUserEmail, password: newUserPassword, fullName: newUserFullName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

  const changeRoleMutation = useMutation({
    mutationFn: async () => {
      if (!changeRoleUserId) throw new Error("Please select a user");
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

  return (
    <DashboardLayout title="User Management">
      <div className="space-y-6">
        <WelcomeHeader
          pageDescription="Manage all system users, assign roles, and control access permissions."
          features={["Add Users", "Assign Roles", "Reset Passwords", "Delete Users"]}
        />

        <div className="flex justify-end">
          <Button onClick={() => setAddUserDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
        </div>

        {/* Assign Role Section */}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Type</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={selectedEmployeeType}
                  onChange={(e) => setSelectedEmployeeType(e.target.value as "employee" | "manager")}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department Role</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={selectedDepartmentRole || ""}
                  onChange={(e) => setSelectedDepartmentRole(e.target.value ? e.target.value as any : null)}
                >
                  <option value="">No Role</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                  <option value="orders">Orders</option>
                  <option value="finance">Finance</option>
                  <option value="projects">Projects</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Managerial Role (Managers Only)</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={selectedManagerialRole || ""}
                  onChange={(e) => setSelectedManagerialRole(e.target.value ? e.target.value as any : null)}
                  disabled={selectedEmployeeType !== "manager"}
                >
                  <option value="">No Managerial Role</option>
                  <option value="director_finance">Director of Finance</option>
                  <option value="director_business">Director of Business</option>
                  <option value="director_cx">Director of CX</option>
                  <option value="director_of_technology">Director of Technology</option>
                  <option value="head_compliance">Head of Compliance</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() => assignRoleMutation.mutate()}
              disabled={!selectedUserId || assignRoleMutation.isPending}
              className="w-full"
            >
              {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>System Users</CardTitle>
            <CardDescription>
              <Input
                placeholder="Search by email, name, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers?.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{user.full_name || user.email}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{user.user_roles?.employee_type || "employee"}</Badge>
                      {user.user_roles?.department_role && (
                        <Badge>{user.user_roles.department_role}</Badge>
                      )}
                      {user.manager_assignments?.role && (
                        <Badge variant="secondary">{user.manager_assignments.role.replace(/_/g, " ")}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setChangeRoleUserId(user.id);
                        setNewEmployeeTypeForUser(user.user_roles?.employee_type || "employee");
                        setNewDepartmentIdForUser(user.user_roles?.department_id || null);
                        setNewDepartmentRoleForUser(user.user_roles?.department_role || null);
                        setNewManagerialRoleForUser(user.manager_assignments?.role || null);
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
                      variant="destructive"
                      onClick={() => {
                        setDeleteUserId(user.id);
                        setDeleteUserDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min 12 chars, upper, lower, number, special" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => addUserMutation.mutate()} disabled={addUserMutation.isPending}>
                {addUserMutation.isPending ? "Adding..." : "Add User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Set a new password for this user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 12 chars, upper, lower, number, special" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => resetPasswordMutation.mutate()} disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>Are you sure you want to delete this user? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteUserMutation.mutate()} disabled={deleteUserMutation.isPending}>
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>Update the role for this user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee Type</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={newEmployeeTypeForUser}
                  onChange={(e) => setNewEmployeeTypeForUser(e.target.value as "employee" | "manager")}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
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
                <Label>Department Role</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={newDepartmentRoleForUser || ""}
                  onChange={(e) => setNewDepartmentRoleForUser(e.target.value ? e.target.value as any : null)}
                >
                  <option value="">No Role</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                  <option value="orders">Orders</option>
                  <option value="finance">Finance</option>
                  <option value="projects">Projects</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Managerial Role</Label>
                <select
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                  value={newManagerialRoleForUser || ""}
                  onChange={(e) => setNewManagerialRoleForUser(e.target.value ? e.target.value as any : null)}
                  disabled={newEmployeeTypeForUser !== "manager"}
                >
                  <option value="">No Managerial Role</option>
                  <option value="director_finance">Director of Finance</option>
                  <option value="director_business">Director of Business</option>
                  <option value="director_cx">Director of CX</option>
                  <option value="director_of_technology">Director of Technology</option>
                  <option value="head_compliance">Head of Compliance</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => changeRoleMutation.mutate()} disabled={changeRoleMutation.isPending}>
                {changeRoleMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;
