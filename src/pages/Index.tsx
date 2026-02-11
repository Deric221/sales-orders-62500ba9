import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText, ShoppingCart, Truck, Receipt, FolderKanban, CreditCard,
  BarChart3, Users, CheckCircle, ArrowRight, Search, Package
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const departments = [
    {
      name: "Sales",
      icon: FileText,
      color: "border-l-bc-cue-blue",
      description: "Upload and track quotes, link customer purchase orders, and manage distributor quotes through the full sales pipeline.",
      features: ["Upload Quotes", "Customer POs", "Distributor Quotes", "Document Tracking"],
    },
    {
      name: "Orders",
      icon: ShoppingCart,
      color: "border-l-bc-cue-green",
      description: "Create company POs, generate waybills, track deliveries, and manage the full order fulfillment lifecycle.",
      features: ["Company POs", "Waybill Management", "Delivery Tracking", "Order Lookup"],
    },
    {
      name: "Finance",
      icon: Receipt,
      color: "border-l-bc-cue-amber",
      description: "Generate invoices for completed orders, process expense ticket payments, and manage financial workflows.",
      features: ["Invoice Generation", "Expense Payments", "Payment Processing", "Reports"],
    },
    {
      name: "Projects",
      icon: FolderKanban,
      color: "border-l-bc-cue-purple",
      description: "Track project progress from creation to completion, upload documentation, and manage project milestones.",
      features: ["Project Lifecycle", "Documentation", "Completion Tracking", "Team Collaboration"],
    },
  ];

  // Sample KPI data for the demo preview
  const sampleKPIs = [
    { label: "Open Quotes", value: 24, color: "border-l-bc-cue-blue" },
    { label: "Pending Orders", value: 12, color: "border-l-bc-cue-green" },
    { label: "Awaiting Invoice", value: 8, color: "border-l-bc-cue-amber" },
    { label: "Active Projects", value: 5, color: "border-l-bc-cue-purple" },
  ];

  const sampleTableRows = [
    { id: "QT-2024-001", customer: "Acme Corp", status: "Pending PO", date: "Feb 10, 2026", amount: "₦2,450,000" },
    { id: "QT-2024-002", customer: "Tech Solutions Ltd", status: "PO Received", date: "Feb 09, 2026", amount: "₦1,800,000" },
    { id: "QT-2024-003", customer: "Global Industries", status: "Invoice Sent", date: "Feb 08, 2026", amount: "₦3,200,000" },
    { id: "QT-2024-004", customer: "Premier Services", status: "Completed", date: "Feb 07, 2026", amount: "₦950,000" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            alt="Logo"
            className="h-8 w-8"
            src="/lovable-uploads/c6537105-6cc4-4fc9-ad09-cccf97882c02.jpg"
          />
          <h1 className="text-lg font-semibold text-foreground">Sales & Orders Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/expense-auth")}>
            <CreditCard className="h-4 w-4 mr-1.5" />
            Expense Portal
          </Button>
          <Button size="sm" onClick={() => navigate("/auth")}>
            Sign In
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Main content area */}
        <div className="flex-1 p-6 space-y-6">

          {/* BC-style Get Started Hero Card */}
          <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-primary/15 border border-primary/20 rounded-sm p-8 overflow-hidden">
            <div className="relative z-10 max-w-lg">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Get started</p>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Hi, welcome to Sales & Orders Tracker!
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your all-in-one platform for managing quotes, purchase orders, waybills, invoices, expense tickets, and project tracking across every department. Sign in to access your personalised dashboard.
              </p>
            </div>
            {/* Decorative elements */}
            <div className="absolute right-4 top-4 bottom-4 w-1/3 hidden md:flex items-center justify-center opacity-20">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-3 bg-primary rounded-sm" />
                  <div className="w-16 h-3 bg-primary/60 rounded-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-3 bg-primary/40 rounded-sm" />
                  <div className="w-20 h-3 bg-primary rounded-sm" />
                  <div className="w-8 h-3 bg-primary/60 rounded-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-3 bg-primary/60 rounded-sm" />
                  <div className="w-24 h-3 bg-primary/40 rounded-sm" />
                </div>
                <div className="flex gap-2 mt-4">
                  <BarChart3 className="h-10 w-10 text-primary" />
                  <FileText className="h-10 w-10 text-primary/70" />
                  <ShoppingCart className="h-10 w-10 text-primary/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Department Overview Cards */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Department Modules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {departments.map((dept) => (
                <div key={dept.name} className={`bg-card border-l-4 ${dept.color} p-4 rounded-sm shadow-sm`}>
                  <div className="flex items-center gap-2 mb-2">
                    <dept.icon className="h-5 w-5 text-foreground" />
                    <span className="font-semibold text-sm text-foreground">{dept.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{dept.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Demo Preview */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dashboard Preview</h3>
            <p className="text-xs text-muted-foreground">A preview of your department workspace — sign in to access your live dashboard.</p>
          </div>

          {/* Demo BC Ribbon */}
          <div className="bg-bc-ribbon border border-bc-ribbon-border rounded-sm px-3 py-2 flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled>
              <FileText className="h-3.5 w-3.5" /> New Quote
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled>
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled>
              <Package className="h-3.5 w-3.5" /> Create Waybill
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled>
              <Receipt className="h-3.5 w-3.5" /> Generate Invoice
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled>
              <BarChart3 className="h-3.5 w-3.5" /> Reports
            </Button>
          </div>

          {/* Demo KPI Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {sampleKPIs.map((kpi) => (
              <div
                key={kpi.label}
                className={`bg-card border-l-4 ${kpi.color} p-3 rounded-sm shadow-sm`}
              >
                <div className="text-2xl font-semibold text-foreground">{kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Demo Table */}
          <div className="bg-card border rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/50">
              <span className="text-sm font-medium text-foreground">Recent Quotes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Quote No.</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleTableRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-primary font-medium">{row.id}</td>
                      <td className="px-3 py-2 text-foreground">{row.customer}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-sm ${
                          row.status === "Completed" ? "bg-bc-cue-green/10 text-bc-cue-green" :
                          row.status === "Invoice Sent" ? "bg-bc-cue-amber/10 text-bc-cue-amber" :
                          row.status === "PO Received" ? "bg-bc-cue-blue/10 text-bc-cue-blue" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.date}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demo FactBox hint */}
          <div className="bg-bc-factbox border rounded-sm p-3 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Quotes</span><span className="font-medium">24</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This Month</span><span className="font-medium">6</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Conversion Rate</span><span className="font-medium">67%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg. Value</span><span className="font-medium">₦2.1M</span></div>
            </div>
          </div>
        </div>

        {/* Right: Features / Login Panel */}
        <div className="w-full lg:w-80 border-l bg-card p-6 space-y-6">
          <div className="space-y-2 text-center">
            <img
              alt="Logo"
              className="h-12 w-12 mx-auto"
              src="/lovable-uploads/c6537105-6cc4-4fc9-ad09-cccf97882c02.jpg"
            />
            <h2 className="text-lg font-semibold text-foreground">Welcome</h2>
            <p className="text-sm text-muted-foreground">Sign in to access your department dashboard</p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" size="lg" onClick={() => navigate("/auth")}>
              <Users className="h-4 w-4 mr-2" />
              Sign In to Dashboard
            </Button>
            <Button variant="outline" className="w-full" size="lg" onClick={() => navigate("/expense-auth")}>
              <CreditCard className="h-4 w-4 mr-2" />
              Expense Ticket Portal
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-semibold text-foreground">Department Modules</h3>
            {departments.map((dept) => (
              <div key={dept.name} className={`border-l-4 ${dept.color} bg-muted/30 p-3 rounded-sm`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <dept.icon className="h-4 w-4 text-foreground" />
                  <span className="font-medium text-sm text-foreground">{dept.name}</span>
                </div>
                <ul className="space-y-0.5">
                  {dept.features.map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-bc-cue-green" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <div className="border-l-4 border-l-bc-cue-amber bg-muted/30 p-3 rounded-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <CreditCard className="h-4 w-4 text-foreground" />
                <span className="font-medium text-sm text-foreground">Expense System</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All employees can submit and track expense tickets through the dedicated Expense Portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
