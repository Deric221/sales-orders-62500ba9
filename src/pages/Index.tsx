import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShoppingCart, Truck, Receipt } from "lucide-react";
import logo from "@/assets/logo.png";
const Index = () => {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img alt="Logo" className="h-16 w-16" src="/lovable-uploads/c6537105-6cc4-4fc9-ad09-cccf97882c02.jpg" />
            <h1 className="text-5xl font-bold">Sales & Orders Tracker</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Streamline your sales and orders workflow</p>
          <div className="mt-8 flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/expense-auth")}>
              Expense Ticket
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mt-16">
          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Sales Team</CardTitle>
              <CardDescription>Upload quotes and customer purchase orders</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <ShoppingCart className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Orders Team</CardTitle>
              <CardDescription>Manage company POs and waybills with tracking</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Receipt className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Finance Team</CardTitle>
              <CardDescription>Generate invoices when all documents are complete</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Truck className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Projects Team</CardTitle>
              <CardDescription>Manage project execution and documentation</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Workflow Tracking</CardTitle>
              <CardDescription>Monitor order stages and document status</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>;
};
export default Index;