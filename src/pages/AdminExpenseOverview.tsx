import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WelcomeHeader from "@/components/layout/WelcomeHeader";
import { ExpenseWorkflowVisual } from "@/components/workflow/ExpenseWorkflowVisual";
import { useState } from "react";
import { Receipt, DollarSign, Clock, CheckCircle2 } from "lucide-react";

const AdminExpenseOverview = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: expenseTickets } = useQuery({
    queryKey: ["all-expense-tickets"],
    queryFn: async () => {
      const { data: tickets, error: ticketsError } = await supabase
        .from("expense_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (ticketsError) throw ticketsError;
      if (!tickets || tickets.length === 0) return [];

      const employeeIds = tickets.map(t => t.employee_id).filter(Boolean);
      const managerIds = tickets.map(t => t.manager_id).filter(Boolean);
      const allUserIds = [...new Set([...employeeIds, ...managerIds])];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allUserIds);

      if (profilesError) throw profilesError;

      return tickets.map(ticket => ({
        ...ticket,
        employee_profile: profiles?.find(p => p.id === ticket.employee_id),
        manager_profile: profiles?.find(p => p.id === ticket.manager_id),
      }));
    },
  });

  const filteredTickets = expenseTickets?.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.ticket_number?.toLowerCase().includes(query) ||
      ticket.purpose?.toLowerCase().includes(query) ||
      ticket.status?.toLowerCase().includes(query) ||
      ticket.employee_profile?.full_name?.toLowerCase().includes(query) ||
      ticket.employee_profile?.email?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      pending_manager_approval: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      rejected: "bg-red-100 text-red-800",
      paid: "bg-green-100 text-green-800",
      retired: "bg-purple-100 text-purple-800",
    };
    const labels: Record<string, string> = {
      draft: "Draft",
      pending_manager_approval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
      paid: "Paid",
      retired: "Retired",
    };
    return <Badge className={colors[status] || "bg-gray-100 text-gray-800"}>{labels[status] || status}</Badge>;
  };

  // Calculate stats
  const stats = {
    total: expenseTickets?.length || 0,
    pending: expenseTickets?.filter(t => t.status === "pending_manager_approval").length || 0,
    approved: expenseTickets?.filter(t => t.status === "approved").length || 0,
    paid: expenseTickets?.filter(t => t.status === "paid" || t.status === "retired").length || 0,
    totalAmount: expenseTickets?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
  };

  return (
    <DashboardLayout title="Expense Overview">
      <div className="space-y-6">
        <WelcomeHeader
          pageDescription="View and monitor all expense tickets across the organization."
          features={["View All Expenses", "Track Approvals", "Monitor Payments", "Audit Trail"]}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Receipt className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Tickets</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.paid}</div>
                  <div className="text-sm text-muted-foreground">Paid/Retired</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">₵{stats.totalAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle>All Expense Tickets</CardTitle>
            <CardDescription>
              <Input
                placeholder="Search by ticket number, purpose, status, or employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredTickets?.map((ticket) => (
                <div key={ticket.id} className="p-4 border rounded space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{ticket.ticket_number}</div>
                      <div className="text-sm text-muted-foreground">{ticket.purpose}</div>
                      <div className="text-sm text-muted-foreground">
                        Employee: {ticket.employee_profile?.full_name || ticket.employee_profile?.email || "Unknown"}
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(ticket.status)}
                      <div className="text-lg font-bold mt-1">
                        {ticket.currency} {ticket.total_amount?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Issued To:</span>
                      <div>{ticket.issued_in_favour_of}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <div>{new Date(ticket.date).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manager:</span>
                      <div>{ticket.manager_profile?.full_name || "Not assigned"}</div>
                    </div>
                  </div>

                  <ExpenseWorkflowVisual currentStatus={ticket.status} hasReceipt={ticket.has_receipt || false} />
                </div>
              ))}
              {!filteredTickets?.length && (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No matching tickets found" : "No expense tickets"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminExpenseOverview;
