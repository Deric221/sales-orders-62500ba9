import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import ExpenseRetirementDialog from "./ExpenseRetirementDialog";
import { ExpenseWorkflowVisual } from "@/components/workflow/ExpenseWorkflowVisual";
import { z } from "zod";
import { createNotification, createNotifications } from "@/lib/notifications";

interface ExpenseDetail {
  date: string;
  type: string;
  amount: number;
}

// Validation schemas
const expenseDetailSchema = z.object({
  date: z.string().refine(
    (d) => {
      const date = new Date(d);
      const now = new Date();
      now.setHours(23, 59, 59, 999); // Allow today
      return date <= now && date >= new Date('2000-01-01');
    },
    { message: "Date must be today or in the past, and after year 2000" }
  ),
  type: z.string().trim().min(2, "Type must be at least 2 characters").max(100, "Type must be less than 100 characters"),
  amount: z.number().positive("Amount must be positive").max(10000000, "Amount cannot exceed 10,000,000").multipleOf(0.01, "Amount can have maximum 2 decimal places"),
});

const expenseTicketSchema = z.object({
  date: z.string().refine(
    (d) => {
      const date = new Date(d);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      return date <= now && date >= new Date('2000-01-01');
    },
    { message: "Date must be today or in the past, and after year 2000" }
  ),
  issuedTo: z.string().trim().min(2, "Issued to must be at least 2 characters").max(200, "Issued to must be less than 200 characters"),
  purpose: z.string().trim().min(10, "Purpose must be at least 10 characters").max(1000, "Purpose must be less than 1000 characters"),
  amount: z.number().positive("Total amount must be positive").max(10000000, "Total amount cannot exceed 10,000,000"),
  expenseDetails: z.array(expenseDetailSchema).min(1, "At least one expense detail is required"),
});

const EmployeeExpenseDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [hasReceipt, setHasReceipt] = useState(true);
  const [currency, setCurrency] = useState<"GHS" | "USD">("GHS");
  const [amountRequested, setAmountRequested] = useState("");
  const [expenseDetails, setExpenseDetails] = useState<ExpenseDetail[]>([
    { date: format(new Date(), "yyyy-MM-dd"), type: "", amount: 0 },
  ]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [actualAmountSpent, setActualAmountSpent] = useState<Record<string, string>>({});
  const [refundStatus, setRefundStatus] = useState<Record<string, string>>({});

  // Fetch employee's tickets with paid_by profile info
  const { data: tickets = [] } = useQuery({
    queryKey: ["expense-tickets", user?.id],
    queryFn: async () => {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*), expense_retirements(*)")
        .eq("employee_id", user?.id)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      if (!ticketsData || ticketsData.length === 0) return [];

      // Get paid_by user profiles for paid tickets
      const paidByIds = [...new Set(ticketsData.map((t: any) => t.finance_paid_by).filter(Boolean))];
      
      if (paidByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", paidByIds);

        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        
        return ticketsData.map((ticket: any) => ({
          ...ticket,
          paid_by_profile: ticket.finance_paid_by ? profilesMap.get(ticket.finance_paid_by) || null : null,
        }));
      }

      return ticketsData;
    },
  });

  // Fetch manager info and user role
  const { data: managerMapping, isLoading: isLoadingManager } = useQuery({
    queryKey: ["manager-mapping", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_manager_mapping")
        .select("manager_id")
        .eq("employee_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("employee_type")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const addExpenseRow = () => {
    setExpenseDetails([
      ...expenseDetails,
      { date: format(new Date(), "yyyy-MM-dd"), type: "", amount: 0 },
    ]);
  };

  const removeExpenseRow = (index: number) => {
    setExpenseDetails(expenseDetails.filter((_, i) => i !== index));
  };

  const updateExpenseDetail = (index: number, field: keyof ExpenseDetail, value: any) => {
    const updated = [...expenseDetails];
    updated[index] = { ...updated[index], [field]: value };
    setExpenseDetails(updated);
  };

  const calculateTotal = () => {
    return expenseDetails.reduce((sum, detail) => sum + (Number(detail.amount) || 0), 0);
  };

  // Payment acknowledgment mutation (simplified - just acknowledges payment)
  const acknowledgeMutation = useMutation({
    mutationFn: async ({ 
      ticketId, 
      hasReceipt 
    }: { 
      ticketId: string; 
      hasReceipt: boolean;
    }) => {
      const updateData: any = {
        payment_acknowledged: true,
        payment_acknowledged_at: new Date().toISOString(),
      };
      
      // If no receipt expected, mark as retired
      if (!hasReceipt) {
        updateData.status = "retired";
      }

      const { error } = await supabase
        .from("expense_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-tickets", user?.id] });
      toast({
        title: "Success",
        description: "Payment acknowledged successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reconciliation mutation (separate from acknowledgment)
  const reconciliationMutation = useMutation({
    mutationFn: async ({ 
      ticketId, 
      actualAmountSpent: actualSpent, 
      refundStatus: refStatus 
    }: { 
      ticketId: string; 
      actualAmountSpent: number;
      refundStatus: string;
    }) => {
      // Get ticket to calculate remaining balance correctly
      const { data: ticketData } = await supabase
        .from("expense_tickets")
        .select("amount_requested, total_amount")
        .eq("id", ticketId)
        .single();
      
      // Remaining balance = amount_requested - actual_amount_spent
      const amountRequested = ticketData?.amount_requested || ticketData?.total_amount || 0;
      const remainingBalance = amountRequested - actualSpent;
      
      const updateData: any = {
        actual_amount_spent: actualSpent,
        remaining_balance: remainingBalance,
        refund_status: refStatus,
      };
      
      if (refStatus === 'refund_returned') {
        updateData.refund_confirmed_at = new Date().toISOString();
        updateData.refund_confirmed_by = user?.id;
      }

      const { error } = await supabase
        .from("expense_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
      
      // Notify finance if refund status requires attention
      if (refStatus === 'refund_pending' || remainingBalance > 0) {
        const { data: financeUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("department_role", "finance");
        
        if (financeUsers && financeUsers.length > 0) {
          const { data: ticket } = await supabase
            .from("expense_tickets")
            .select("ticket_number")
            .eq("id", ticketId)
            .single();
          
          const notifications = financeUsers.map(u => ({
            user_id: u.user_id,
            title: "Expense Reconciliation Submitted",
            message: `Expense ticket ${ticket?.ticket_number} reconciliation submitted. Remaining balance: ${remainingBalance.toFixed(2)}. Refund status: ${refStatus === 'refund_pending' ? 'Pending' : refStatus === 'refund_returned' ? 'Returned' : 'Not Required'}.`,
            related_type: "expense_ticket",
            related_id: ticketId,
          }));
          
          await createNotifications(notifications);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-tickets", user?.id] });
      toast({
        title: "Success",
        description: "Reconciliation submitted successfully",
      });
      setActualAmountSpent({});
      setRefundStatus({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update refund status mutation (for changing pending to returned)
  const updateRefundMutation = useMutation({
    mutationFn: async ({ 
      ticketId, 
      refundStatus: refStatus 
    }: { 
      ticketId: string; 
      refundStatus: string;
    }) => {
      const updateData: any = {
        refund_status: refStatus,
      };
      
      if (refStatus === 'refund_returned') {
        updateData.refund_confirmed_at = new Date().toISOString();
        updateData.refund_confirmed_by = user?.id;
      }

      const { error } = await supabase
        .from("expense_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
      
      // Notify finance
      const { data: financeUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("department_role", "finance");
      
      if (financeUsers && financeUsers.length > 0) {
        const { data: ticket } = await supabase
          .from("expense_tickets")
          .select("ticket_number")
          .eq("id", ticketId)
          .single();
        
        const notifications = financeUsers.map(u => ({
          user_id: u.user_id,
          title: "Refund Status Updated",
          message: `Expense ticket ${ticket?.ticket_number} refund has been marked as returned.`,
          related_type: "expense_ticket",
          related_id: ticketId,
        }));
        
        await createNotifications(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-tickets", user?.id] });
      toast({
        title: "Success",
        description: "Refund status updated to returned",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      // Check if user is a manager or regular employee
      const isManager = userRole?.employee_type === "manager";
      
      // Regular employees need a manager assigned
      if (!isManager && !managerMapping?.manager_id) {
        throw new Error("No manager assigned. Please contact admin.");
      }

      // Validate all inputs
      try {
        expenseTicketSchema.parse({
          date,
          issuedTo,
          purpose,
          amount: calculateTotal(),
          expenseDetails,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          throw new Error(firstError.message);
        }
        throw error;
      }

      // Sanitize text inputs
      const sanitizedIssuedTo = issuedTo.trim().slice(0, 200);
      const sanitizedPurpose = purpose.trim().slice(0, 1000);
      const sanitizedExpenseDetails = expenseDetails.map((detail) => ({
        ...detail,
        type: detail.type.trim().slice(0, 100),
      }));

      // Generate ticket number
      const { data: ticketNumber, error: fnError } = await supabase.rpc(
        "generate_expense_ticket_number"
      );

      if (fnError) throw fnError;

      // Create ticket
      // For managers, manager_id is null - all other managers can approve
      // For employees, manager_id is set to their assigned manager
      const { data: ticket, error: ticketError } = await supabase
        .from("expense_tickets")
        .insert({
          ticket_number: ticketNumber,
          employee_id: user!.id,
          manager_id: isManager ? null : managerMapping!.manager_id,
          date,
          total_amount: calculateTotal(),
          amount_requested: parseFloat(amountRequested) || calculateTotal(),
          issued_in_favour_of: sanitizedIssuedTo,
          purpose: sanitizedPurpose,
          status: "pending_manager_approval",
          has_receipt: hasReceipt,
          currency,
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create expense details
      const detailsToInsert = sanitizedExpenseDetails.map((detail) => ({
        expense_ticket_id: ticket.id,
        date: detail.date,
        type: detail.type,
        amount: detail.amount,
      }));

      const { error: detailsError } = await supabase
        .from("expense_details")
        .insert(detailsToInsert);

      if (detailsError) throw detailsError;

      return ticket;
    },
    onSuccess: async (ticket) => {
      toast({
        title: "Success",
        description: "Expense ticket created and submitted for approval",
      });
      
      // Create in-app notification and try to send email to manager
      if (ticket && ticket.manager_id) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user!.id)
            .single();

          // Create in-app notification via secure edge function
          await createNotification({
            user_id: ticket.manager_id,
            title: "New Expense Ticket for Approval",
            message: `Expense ticket ${ticket.ticket_number} from ${profile?.full_name || "Employee"} requires your approval (GHS ${ticket.total_amount}).`,
            related_type: "expense_ticket",
            related_id: ticket.id,
          });

          // Try to send email
          const { data: session } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-expense-notification', {
            body: {
              ticketId: ticket.id,
              employeeName: profile?.full_name || "Employee",
              ticketNumber: ticket.ticket_number,
              amount: ticket.total_amount.toString(),
              managerId: ticket.manager_id,
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
          }).catch(err => console.log('Email notification failed (expected if domain not verified):', err));
        } catch (error) {
          console.error("Failed to send notification:", error);
        }
      }

      // Reset form
      setDate(format(new Date(), "yyyy-MM-dd"));
      setAmount("");
      setAmountRequested("");
      setIssuedTo("");
      setPurpose("");
      setHasReceipt(true);
      setCurrency("GHS");
      setExpenseDetails([{ date: format(new Date(), "yyyy-MM-dd"), type: "", amount: 0 }]);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      pending_manager_approval: "default",
      approved: "default",
      rejected: "destructive",
      paid: "default",
      retired: "default",
    };

    const labels: Record<string, string> = {
      draft: "Draft",
      pending_manager_approval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
      paid: "Paid",
      retired: "Retired",
    };

    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Expense Ticket</CardTitle>
          <CardDescription>Submit a new expense ticket for approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "GHS" | "USD")}
              >
                <option value="GHS">GHS (₵)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountRequested">Amount Requested ({currency})</Label>
              <Input 
                id="amountRequested" 
                type="number"
                step="0.01"
                value={amountRequested}
                onChange={(e) => setAmountRequested(e.target.value)}
                placeholder="Enter amount requested"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total">Expense Total ({currency})</Label>
              <Input id="total" value={calculateTotal().toFixed(2)} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issuedTo">Issued In Favour Of</Label>
            <Input
              id="issuedTo"
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              placeholder="Enter recipient name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the purpose of this expense"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="hasReceipt"
              checked={hasReceipt}
              onChange={(e) => setHasReceipt(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="hasReceipt" className="cursor-pointer">
              I have a receipt for this expense
            </Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Details of Expenses</Label>
              <Button type="button" variant="outline" size="sm" onClick={addExpenseRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Amount ({currency})</th>
                    <th className="p-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenseDetails.map((detail, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        <Input
                          type="date"
                          value={detail.date}
                          onChange={(e) => updateExpenseDetail(index, "date", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={detail.type}
                          onChange={(e) => updateExpenseDetail(index, "type", e.target.value)}
                          placeholder="Expense type"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={detail.amount}
                          onChange={(e) =>
                            updateExpenseDetail(index, "amount", parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="p-2">
                        {expenseDetails.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExpenseRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Button
            onClick={() => createTicketMutation.mutate()}
            disabled={
              createTicketMutation.isPending || 
              !issuedTo || 
              !purpose || 
              isLoadingManager || 
              isLoadingRole ||
              (!userRole || (userRole.employee_type !== "manager" && !managerMapping?.manager_id))
            }
            className="w-full"
          >
            {isLoadingManager || isLoadingRole 
              ? "Loading..." 
              : (!userRole || (userRole.employee_type !== "manager" && !managerMapping?.manager_id))
                ? "No Manager Assigned - Contact Admin"
                : "Submit Expense Ticket"
            }
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Expense Tickets</CardTitle>
          <CardDescription>View and manage your submitted expense tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No expense tickets yet</p>
            ) : (
              tickets.map((ticket: any) => (
                <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{ticket.ticket_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(ticket.date), "PPP")}
                      </div>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <strong>Amount Requested:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.amount_requested || ticket.total_amount).toFixed(2)}
                      </div>
                      <div>
                        <strong>Total Expenses:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.total_amount).toFixed(2)}
                      </div>
                    </div>
                    {ticket.actual_amount_spent !== null && ticket.actual_amount_spent !== undefined && (
                      <div className="grid grid-cols-2 gap-2 bg-muted/50 p-2 rounded">
                        <div>
                          <strong>Actual Amount Spent:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.actual_amount_spent).toFixed(2)}
                        </div>
                        <div>
                          <strong>Remaining Balance:</strong> {ticket.currency === 'USD' ? '$' : '₵'} {Number(ticket.remaining_balance || 0).toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div>
                      <strong>Issued To:</strong> {ticket.issued_in_favour_of}
                    </div>
                    <div>
                      <strong>Purpose:</strong> {ticket.purpose}
                    </div>
                    <div>
                      <strong>Has Receipt:</strong> {ticket.has_receipt ? "Yes" : "No"}
                    </div>
                    {ticket.refund_status && ticket.refund_status !== 'no_refund_required' && (
                      <div>
                        <strong>Refund Status:</strong>{" "}
                        <Badge variant={ticket.refund_status === 'refund_returned' ? 'default' : 'secondary'}>
                          {ticket.refund_status === 'refund_pending' ? 'Refund Pending' : 
                           ticket.refund_status === 'refund_returned' ? 'Refund Returned' : 'No Refund Required'}
                        </Badge>
                      </div>
                    )}
                    {ticket.manager_notes && (
                      <div>
                        <strong>Manager Notes:</strong> {ticket.manager_notes}
                      </div>
                    )}
                    {ticket.status === "paid" && ticket.finance_paid_at && (
                      <>
                        <div>
                          <strong>Paid On:</strong> {format(new Date(ticket.finance_paid_at), "PPP")}
                        </div>
                        {ticket.paid_by_profile && (
                          <div>
                            <strong>Paid By:</strong>{" "}
                            {ticket.paid_by_profile.full_name || ticket.paid_by_profile.email}
                          </div>
                        )}
                        {ticket.payment_details && (
                          <div>
                            <strong>Payment Details:</strong> {ticket.payment_details}
                          </div>
                        )}
                        {!ticket.payment_acknowledged && (
                          <div className="mt-2 p-2 border rounded bg-blue-50">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => acknowledgeMutation.mutate({ 
                                ticketId: ticket.id, 
                                hasReceipt: (ticket as any).has_receipt
                              })}
                              disabled={acknowledgeMutation.isPending}
                              className="w-full"
                            >
                              Acknowledge Payment Received
                            </Button>
                          </div>
                        )}
                        
                        {ticket.payment_acknowledged && (
                          <div className="text-green-600 font-medium">
                            ✓ Payment Acknowledged on{" "}
                            {format(new Date(ticket.payment_acknowledged_at), "PPP")}
                          </div>
                        )}
                        
                        {/* Reconciliation section - shown after payment is acknowledged */}
                        {ticket.payment_acknowledged && !ticket.actual_amount_spent && (
                          <div className="space-y-2 mt-2 p-2 border rounded bg-muted/30">
                            <Label className="text-sm font-medium">Submit Reconciliation</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Actual Amount Spent</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter actual amount"
                                  value={actualAmountSpent[ticket.id] || ''}
                                  onChange={(e) => setActualAmountSpent(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Refund Status</Label>
                                <select
                                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                                  value={refundStatus[ticket.id] || 'no_refund_required'}
                                  onChange={(e) => setRefundStatus(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                >
                                  <option value="no_refund_required">No Refund Required</option>
                                  <option value="refund_pending">Refund Pending</option>
                                  <option value="refund_returned">Refund Returned</option>
                                </select>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reconciliationMutation.mutate({ 
                                ticketId: ticket.id, 
                                actualAmountSpent: parseFloat(actualAmountSpent[ticket.id] || '0'),
                                refundStatus: refundStatus[ticket.id] || 'no_refund_required'
                              })}
                              disabled={reconciliationMutation.isPending}
                              className="w-full"
                            >
                              Submit Reconciliation
                            </Button>
                          </div>
                        )}
                        
                        {/* Update refund status section - shown when refund is pending */}
                        {ticket.payment_acknowledged && ticket.actual_amount_spent && ticket.refund_status === 'refund_pending' && (
                          <div className="space-y-2 mt-2 p-2 border rounded bg-amber-50">
                            <Label className="text-sm font-medium">Update Refund Status</Label>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => updateRefundMutation.mutate({ 
                                  ticketId: ticket.id, 
                                  refundStatus: 'refund_returned'
                                })}
                                disabled={updateRefundMutation.isPending}
                                className="flex-1"
                              >
                                Mark Refund as Returned
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {ticket.status === "paid" && (ticket as any).has_receipt && !ticket.expense_retirements?.length && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTicket(ticket.id)}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Retirement Document
                    </Button>
                  )}
                  {ticket.expense_retirements?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <strong className="text-sm">Retirement Documents:</strong>
                      {ticket.expense_retirements.map((retirement: any) => (
                        <div key={retirement.id} className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.storage
                                  .from("expense-retirements")
                                  .download(retirement.file_path);
                                
                                if (error) throw error;
                                
                                const url = URL.createObjectURL(data);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = retirement.file_name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                
                                toast({
                                  title: "Success",
                                  description: "Retirement document downloaded",
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Download {retirement.file_name}
                          </Button>
                          {retirement.notes && (
                            <p className="text-xs text-muted-foreground">
                              Notes: {retirement.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTicket && (
        <ExpenseRetirementDialog
          ticketId={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            queryClient.invalidateQueries({ queryKey: ["expense-tickets"] });
          }}
        />
      )}
    </div>
  );
};

export default EmployeeExpenseDashboard;
