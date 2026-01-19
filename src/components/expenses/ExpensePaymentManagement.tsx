import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

const ExpensePaymentManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({});

  // Fetch approved tickets ready for payment
  const { data: approvedTickets = [] } = useQuery({
    queryKey: ["approved-expense-tickets"],
    queryFn: async () => {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      if (!ticketsData || ticketsData.length === 0) return [];

      // Get all unique user IDs (employees + managers who approved)
      const employeeIds = [...new Set(ticketsData.map((t: any) => t.employee_id))];
      const managerIds = [...new Set(ticketsData.map((t: any) => t.manager_id).filter(Boolean))];
      const allUserIds = [...new Set([...employeeIds, ...managerIds])];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", allUserIds);

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      return ticketsData.map((ticket: any) => ({
        ...ticket,
        profiles: profilesMap.get(ticket.employee_id) || null,
        manager_profile: ticket.manager_id ? profilesMap.get(ticket.manager_id) || null : null,
      }));
    },
  });

  // Fetch paid tickets with refetch interval for real-time updates
  const { data: paidTickets = [] } = useQuery({
    queryKey: ["paid-expense-tickets"],
    queryFn: async () => {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("expense_tickets")
        .select("*, expense_details(*), expense_retirements(*)")
        .in("status", ["paid", "retired"])
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      if (!ticketsData || ticketsData.length === 0) return [];

      // Get all unique user IDs (employees + paid_by users + managers)
      const employeeIds = [...new Set(ticketsData.map((t: any) => t.employee_id))];
      const paidByIds = [...new Set(ticketsData.map((t: any) => t.finance_paid_by).filter(Boolean))];
      const managerIds = [...new Set(ticketsData.map((t: any) => t.manager_id).filter(Boolean))];
      const allUserIds = [...new Set([...employeeIds, ...paidByIds, ...managerIds])];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", allUserIds);

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      return ticketsData.map((ticket: any) => ({
        ...ticket,
        profiles: profilesMap.get(ticket.employee_id) || null,
        paid_by_profile: ticket.finance_paid_by ? profilesMap.get(ticket.finance_paid_by) || null : null,
        manager_profile: ticket.manager_id ? profilesMap.get(ticket.manager_id) || null : null,
      }));
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ ticketId, details, userId }: { ticketId: string; details: string; userId: string }) => {
      const { error } = await supabase
        .from("expense_tickets")
        .update({
          status: "paid",
          payment_details: details,
          finance_paid_at: new Date().toISOString(),
          finance_paid_by: userId,
        })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Ticket marked as paid",
      });
      setPaymentDetails((prev) => {
        const updated = { ...prev };
        delete updated[variables.ticketId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["approved-expense-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["paid-expense-tickets"] });
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
    return status === "paid" ? (
      <Badge variant="default">Paid</Badge>
    ) : (
      <Badge>Retired</Badge>
    );
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("expense-retirements")
      .download(filePath);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
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
  };

  const [searchQuery, setSearchQuery] = useState("");

  const filteredPaidTickets = paidTickets.filter((ticket: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.ticket_number?.toLowerCase().includes(query) ||
      ticket.profiles?.email?.toLowerCase().includes(query) ||
      ticket.profiles?.full_name?.toLowerCase().includes(query) ||
      ticket.issued_in_favour_of?.toLowerCase().includes(query) ||
      ticket.purpose?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Approved Tickets - Pending Payment</CardTitle>
          <CardDescription>Process payments for approved expense tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {approvedTickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No approved tickets pending payment
              </p>
            ) : (
              approvedTickets.map((ticket: any) => (
                <div key={ticket.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">{ticket.ticket_number}</div>
                      <div className="text-sm text-muted-foreground">
                        Employee: {ticket.profiles?.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Date: {format(new Date(ticket.date), "PPP")}
                      </div>
                      {ticket.manager_profile && (
                        <div className="text-sm font-medium text-primary">
                          Approved by: {ticket.manager_profile.full_name || ticket.manager_profile.email}
                        </div>
                      )}
                    </div>
                    <Badge>Approved</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Amount:</strong> GHS {Number(ticket.total_amount).toFixed(2)}
                    </div>
                    <div>
                      <strong>Issued To:</strong> {ticket.issued_in_favour_of}
                    </div>
                    <div>
                      <strong>Purpose:</strong> {ticket.purpose}
                    </div>
                    {ticket.manager_notes && (
                      <div>
                        <strong>Manager Notes:</strong> {ticket.manager_notes}
                      </div>
                    )}
                  </div>

                  {ticket.expense_details && ticket.expense_details.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-right">Amount (GHS)</th>
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
                  )}

                  <div className="space-y-2">
                    <Label>Payment Details</Label>
                    <Textarea
                      value={paymentDetails[ticket.id] || ""}
                      onChange={(e) =>
                        setPaymentDetails((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      placeholder="Enter payment reference, method, etc..."
                    />
                  </div>

                  <Button
                    onClick={() =>
                      markAsPaidMutation.mutate({
                        ticketId: ticket.id,
                        details: paymentDetails[ticket.id] || "",
                        userId: user?.id || "",
                      })
                    }
                    disabled={markAsPaidMutation.isPending}
                    className="w-full"
                  >
                    Mark as Paid
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paid Tickets</CardTitle>
          <CardDescription>View paid and retired expense tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Search Tickets</Label>
            <Input
              placeholder="Search by ticket number, employee, issued to, or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="space-y-4">
            {filteredPaidTickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? "No tickets match your search" : "No paid tickets yet"}
              </p>
            ) : (
              filteredPaidTickets.map((ticket: any) => (
                <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">{ticket.ticket_number}</div>
                      <div className="text-sm text-muted-foreground">
                        Employee: {ticket.profiles?.full_name || ticket.profiles?.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Date: {format(new Date(ticket.date), "PPP")}
                      </div>
                      {ticket.manager_profile && (
                        <div className="text-sm font-medium text-primary">
                          Approved by: {ticket.manager_profile.full_name || ticket.manager_profile.email}
                        </div>
                      )}
                      {ticket.finance_paid_by && ticket.paid_by_profile && (
                        <div className="text-sm font-medium text-green-600">
                          Paid by: {ticket.paid_by_profile.full_name || ticket.paid_by_profile.email}
                        </div>
                      )}
                      {ticket.finance_paid_at && (
                        <div className="text-sm text-muted-foreground">
                          Paid on: {format(new Date(ticket.finance_paid_at), "PPP")}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <div className="space-y-2 text-sm">
                    {/* Reconciliation Section */}
                    {(() => {
                      const amountRequested = Number(ticket.amount_requested || ticket.total_amount || 0);
                      const actualSpent = Number(ticket.actual_amount_spent || 0);
                      const remainingBalance = ticket.remaining_balance !== null 
                        ? Number(ticket.remaining_balance) 
                        : (actualSpent > 0 ? amountRequested - actualSpent : 0);
                      const hasReconciliation = ticket.payment_acknowledged && (actualSpent > 0 || ticket.refund_status);
                      
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/50 p-2 rounded">
                          <div>
                            <strong className="text-xs">Amount Requested:</strong>
                            <div>{ticket.currency === 'USD' ? '$' : '₵'} {amountRequested.toFixed(2)}</div>
                          </div>
                          <div>
                            <strong className="text-xs">Actual Spent:</strong>
                            <div className={hasReconciliation ? 'font-medium' : 'text-muted-foreground'}>
                              {hasReconciliation 
                                ? `${ticket.currency === 'USD' ? '$' : '₵'} ${actualSpent.toFixed(2)}`
                                : 'Pending reconciliation'
                              }
                            </div>
                          </div>
                          <div>
                            <strong className="text-xs">Remaining Balance:</strong>
                            <div className={remainingBalance > 0 ? 'text-amber-600 font-medium' : ''}>
                              {hasReconciliation 
                                ? `${ticket.currency === 'USD' ? '$' : '₵'} ${remainingBalance.toFixed(2)}`
                                : '-'
                              }
                            </div>
                          </div>
                          <div>
                            <strong className="text-xs">Refund Status:</strong>
                            {hasReconciliation ? (
                              <Badge 
                                variant={ticket.refund_status === 'refund_returned' ? 'default' : 
                                        ticket.refund_status === 'refund_pending' ? 'secondary' : 'outline'} 
                                className="text-xs mt-1"
                              >
                                {ticket.refund_status === 'refund_pending' ? 'Pending' : 
                                 ticket.refund_status === 'refund_returned' ? 'Returned' : 'Not Required'}
                              </Badge>
                            ) : (
                              <div className="text-muted-foreground">-</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {ticket.refund_confirmed_at && (
                      <div className="text-xs text-green-600">
                        Refund confirmed on {format(new Date(ticket.refund_confirmed_at), "PPP")}
                      </div>
                    )}
                    
                    <div>
                      <strong>Issued To:</strong> {ticket.issued_in_favour_of}
                    </div>
                    <div>
                      <strong>Purpose:</strong> {ticket.purpose}
                    </div>
                    {ticket.payment_details && (
                      <div>
                        <strong>Payment Details:</strong> {ticket.payment_details}
                      </div>
                    )}
                    {ticket.manager_notes && (
                      <div>
                        <strong>Manager Notes:</strong> {ticket.manager_notes}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Payment Acknowledged:</span>
                        <Badge variant={ticket.payment_acknowledged ? "default" : "secondary"} className="text-xs">
                          {ticket.payment_acknowledged ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Has Receipt:</span>
                        <Badge variant={ticket.has_receipt ? "default" : "secondary"} className="text-xs">
                          {ticket.has_receipt ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Retirement Status:</span>
                        <Badge variant={ticket.expense_retirements && ticket.expense_retirements.length > 0 ? "default" : "secondary"} className="text-xs">
                          {ticket.expense_retirements && ticket.expense_retirements.length > 0 ? "Uploaded" : "Not Uploaded"}
                        </Badge>
                      </div>
                    </div>
                    {ticket.expense_retirements && ticket.expense_retirements.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-sm font-medium mb-2">Retirement Documents:</div>
                        {ticket.expense_retirements.map((retirement: any) => (
                          <div key={retirement.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div>
                              <div className="text-sm font-medium">{retirement.file_name}</div>
                              {retirement.notes && (
                                <div className="text-xs text-muted-foreground">{retirement.notes}</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadFile(retirement.file_path, retirement.file_name)}
                            >
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensePaymentManagement;
