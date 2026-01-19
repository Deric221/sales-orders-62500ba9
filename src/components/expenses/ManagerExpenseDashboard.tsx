import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import EmployeeExpenseDashboard from "./EmployeeExpenseDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createNotification, createNotifications } from "@/lib/notifications";

const ManagerExpenseDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  // Check if user is a finance director
  const { data: isFinanceDirector = false } = useQuery({
    queryKey: ["is-finance-director", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_assignments")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "director_finance")
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Fetch pending tickets for approval
  const { data: pendingTickets = [], isLoading, error } = useQuery({
    queryKey: ["manager-pending-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      console.log("Fetching pending tickets for manager:", user.id);

      // Get tickets assigned to this manager (regular employees)
      const { data: assignedTickets, error: assignedError } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*)")
        .eq("manager_id", user.id)
        .eq("status", "pending_manager_approval")
        .order("created_at", { ascending: false });

      if (assignedError) {
        console.error("Error fetching assigned tickets:", assignedError);
        throw assignedError;
      }

      // Get ALL pending manager approval tickets (excluding own tickets) for cross-department approval
      const { data: allPendingTickets, error: pendingError } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*)")
        .eq("status", "pending_manager_approval")
        .neq("employee_id", user.id);

      if (pendingError) {
        console.error("Error fetching pending tickets:", pendingError);
        throw pendingError;
      }

      // All managers can now approve tickets from any department - use all pending tickets
      // Remove duplicates by combining with assigned tickets
      const assignedTicketIds = new Set((assignedTickets || []).map(t => t.id));
      const otherPendingTickets = (allPendingTickets || []).filter(
        (ticket: any) => !assignedTicketIds.has(ticket.id)
      );

      // Combine both ticket sets
      const allTickets = [...(assignedTickets || []), ...otherPendingTickets];

      if (allTickets.length === 0) {
        return [];
      }

      // Get unique employee IDs
      const employeeIds = [...new Set(allTickets.map((t: any) => t.employee_id))];

      // Fetch profiles for these employees
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", employeeIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Map profiles to tickets
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      const data = allTickets.map((ticket: any) => ({
        ...ticket,
        profiles: profilesMap.get(ticket.employee_id) || null,
      }));

      console.log("Pending tickets found:", data?.length || 0);
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  // Fetch approval history for this manager
  const { data: approvalHistory = [] } = useQuery({
    queryKey: ["manager-approval-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: ticketsData, error } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*)")
        .eq("manager_id", user.id)
        .in("status", ["approved", "rejected", "paid", "retired"])
        .order("manager_approved_at", { ascending: false });

      if (error) throw error;
      if (!ticketsData || ticketsData.length === 0) return [];

      // Get employee profiles
      const employeeIds = [...new Set(ticketsData.map((t: any) => t.employee_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", employeeIds);

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      return ticketsData.map((ticket: any) => ({
        ...ticket,
        profiles: profilesMap.get(ticket.employee_id) || null,
      }));
    },
    enabled: !!user?.id,
  });

  const handleApprovalMutation = useMutation({
    mutationFn: async ({
      ticketId,
      status,
      managerNotes,
    }: {
      ticketId: string;
      status: "approved" | "rejected";
      managerNotes: string;
    }) => {
      console.log("Processing approval:", { ticketId, status, managerNotes });
      
      // Get ticket details for notification
      const { data: ticket } = await supabase
        .from("expense_tickets")
        .select("employee_id, ticket_number, total_amount")
        .eq("id", ticketId)
        .single();

      const { error } = await supabase
        .from("expense_tickets")
        .update({
          status,
          manager_notes: managerNotes,
          manager_approved_at: new Date().toISOString(),
          manager_id: user?.id,
        })
        .eq("id", ticketId);

      if (error) {
        console.error("Approval error:", error);
        throw error;
      }

      // Create in-app notifications via secure edge function
      if (ticket) {
        try {
          // Notify employee
          await createNotification({
            user_id: ticket.employee_id,
            title: `Expense ${status === "approved" ? "Approved" : "Rejected"}`,
            message: `Your expense ticket ${ticket.ticket_number} has been ${status === "approved" ? "approved" : "rejected"} by your manager.${managerNotes ? ` Note: ${managerNotes}` : ""}`,
            related_type: "expense_ticket",
            related_id: ticketId,
          });

          // If approved, notify Finance team
          if (status === "approved") {
            const { data: financeUsers } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("department_role", "finance");
            
            if (financeUsers && financeUsers.length > 0) {
              const notifications = financeUsers.map(u => ({
                user_id: u.user_id,
                title: "Approved Expense Ready for Payment",
                message: `Expense ticket ${ticket.ticket_number} (GHS ${ticket.total_amount}) has been approved and is ready for payment.`,
                related_type: "expense_ticket",
                related_id: ticketId,
              }));
              
              await createNotifications(notifications);
            }
          }
        } catch (notifyError) {
          console.error("Notification error:", notifyError);
        }
      }
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Ticket ${variables.status === "approved" ? "approved" : "rejected"}`,
      });
      setNotes((prev) => {
        const updated = { ...prev };
        delete updated[variables.ticketId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["manager-pending-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["expense-tickets"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg">Loading pending tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg text-destructive">
          Error loading tickets. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue={isFinanceDirector ? "mytickets" : "pending"} className="space-y-6">
      <TabsList>
        {!isFinanceDirector && (
          <TabsTrigger value="pending">
            Pending Approvals {pendingTickets.length > 0 && `(${pendingTickets.length})`}
          </TabsTrigger>
        )}
        <TabsTrigger value="approval-history">Approval History</TabsTrigger>
        <TabsTrigger value="mytickets">My Tickets</TabsTrigger>
      </TabsList>

      {!isFinanceDirector && (
        <TabsContent value="pending" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Review and approve expense tickets from your team members and fellow managers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {pendingTickets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No pending tickets for approval</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tickets submitted by your team will appear here
                  </p>
                </div>
              ) : (
                pendingTickets.map((ticket: any) => (
                  <div key={ticket.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-lg">{ticket.ticket_number}</div>
                        <div className="text-sm text-muted-foreground">
                          Submitted by: {ticket.profiles?.full_name || ticket.profiles?.email || "Unknown Employee"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Date: {format(new Date(ticket.date), "PPP")}
                        </div>
                      </div>
                      <Badge variant="default">Pending Approval</Badge>
                    </div>

                    <div className="space-y-2 text-sm bg-muted/50 p-3 rounded-md">
                      <div>
                        <strong>Amount:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.total_amount).toFixed(2)} {ticket.currency || 'GHS'}
                      </div>
                      <div>
                        <strong>Issued To:</strong> {ticket.issued_in_favour_of}
                      </div>
                      <div>
                        <strong>Purpose:</strong> {ticket.purpose}
                      </div>
                    </div>

                    {ticket.expense_details && ticket.expense_details.length > 0 && (
                      <div>
                        <Label className="mb-2 block">Expense Details</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="p-2 text-left">Date</th>
                                <th className="p-2 text-left">Type</th>
                                <th className="p-2 text-right">Amount ({ticket.currency || 'GHS'})</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ticket.expense_details.map((detail: any) => (
                                <tr key={detail.id} className="border-t">
                                  <td className="p-2">{format(new Date(detail.date), "PP")}</td>
                                  <td className="p-2">{detail.type}</td>
                                  <td className="p-2 text-right">
                                    {Number(detail.amount).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`notes-${ticket.id}`}>Manager Notes (Optional)</Label>
                      <Textarea
                        id={`notes-${ticket.id}`}
                        value={notes[ticket.id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        placeholder="Add any notes or comments about this expense ticket..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          handleApprovalMutation.mutate({
                            ticketId: ticket.id,
                            status: "approved",
                            managerNotes: notes[ticket.id] || "",
                          })
                        }
                        disabled={handleApprovalMutation.isPending}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          handleApprovalMutation.mutate({
                            ticketId: ticket.id,
                            status: "rejected",
                            managerNotes: notes[ticket.id] || "",
                          })
                        }
                        disabled={handleApprovalMutation.isPending}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      )}

      <TabsContent value="approval-history">
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>View tickets you have approved or rejected</CardDescription>
          </CardHeader>
          <CardContent>
            {approvalHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No approval history</p>
            ) : (
              <div className="space-y-4">
                {approvalHistory.map((ticket: any) => (
                  <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{ticket.ticket_number}</div>
                        <div className="text-sm text-muted-foreground">
                          Employee: {ticket.profiles?.full_name || ticket.profiles?.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Submitted: {format(new Date(ticket.date), "PPP")}
                        </div>
                        {ticket.manager_approved_at && (
                          <div className="text-sm text-muted-foreground">
                            {ticket.status === "approved" || ticket.status === "paid" || ticket.status === "retired" ? "Approved" : "Rejected"} on: {format(new Date(ticket.manager_approved_at), "PPP")}
                          </div>
                        )}
                      </div>
                      <Badge variant={ticket.status === "approved" || ticket.status === "paid" || ticket.status === "retired" ? "default" : "destructive"}>
                        {ticket.status === "approved" || ticket.status === "paid" || ticket.status === "retired" ? "Approved" : "Rejected"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Amount:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.total_amount).toFixed(2)} {ticket.currency || 'GHS'}</div>
                      <div><strong>Purpose:</strong> {ticket.purpose}</div>
                      {ticket.manager_notes && (
                        <div><strong>Your Notes:</strong> {ticket.manager_notes}</div>
                      )}
                    </div>
                    {ticket.expense_details && ticket.expense_details.length > 0 && (
                      <div className="border rounded-lg overflow-hidden mt-2">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Date</th>
                              <th className="p-2 text-left">Type</th>
                              <th className="p-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ticket.expense_details.map((detail: any) => (
                              <tr key={detail.id} className="border-t">
                                <td className="p-2">{format(new Date(detail.date), "PP")}</td>
                                <td className="p-2">{detail.type}</td>
                                <td className="p-2 text-right">GHS {Number(detail.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mytickets">
        <Card>
          <CardHeader>
            <CardTitle>Create Expense Ticket</CardTitle>
            <CardDescription>As a manager, you can also submit expense tickets</CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeExpenseDashboard />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default ManagerExpenseDashboard;
