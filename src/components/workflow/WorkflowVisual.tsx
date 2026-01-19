import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  ShoppingCart, 
  Package, 
  Truck, 
  Wrench, 
  FileCheck,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

interface WorkflowVisualProps {
  currentStage: string;
  hasProject: boolean;
}

const stages = [
  { key: "quote_uploaded", label: "Quote", icon: FileText },
  { key: "customer_po_uploaded", label: "Customer PO", icon: ShoppingCart },
  { key: "company_po_uploaded", label: "Company PO", icon: Package },
  { key: "waybill_created", label: "Waybill", icon: Truck },
  { key: "project", label: "Project", icon: Wrench, conditional: true },
  { key: "invoice_generated", label: "Invoice", icon: FileCheck },
];

export function WorkflowVisual({ currentStage, hasProject }: WorkflowVisualProps) {
  const getStageStatus = (stageKey: string): "completed" | "current" | "pending" => {
    const stageOrder = [
      "quote_uploaded",
      "customer_po_uploaded", 
      "company_po_uploaded",
      "waybill_created",
      ...(hasProject ? ["project_completed"] : []),
      "invoice_generated"
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    const checkIndex = stageOrder.indexOf(
      stageKey === "project" ? "project_completed" : stageKey
    );

    if (checkIndex < currentIndex) return "completed";
    if (checkIndex === currentIndex) return "current";
    return "pending";
  };

  const visibleStages = stages.filter(stage => 
    !stage.conditional || hasProject
  );

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Workflow Progress</h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {visibleStages.map((stage, index) => {
          const status = getStageStatus(stage.key);
          const Icon = stage.icon;
          
          return (
            <div key={stage.key} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex flex-col items-center gap-2">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-colors
                  ${status === "completed" ? "bg-primary text-primary-foreground" : ""}
                  ${status === "current" ? "bg-accent text-accent-foreground ring-2 ring-primary" : ""}
                  ${status === "pending" ? "bg-muted text-muted-foreground" : ""}
                `}>
                  {status === "completed" ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <Badge 
                  variant={status === "current" ? "default" : "outline"}
                  className="text-xs whitespace-nowrap"
                >
                  {stage.label}
                </Badge>
              </div>
              
              {index < visibleStages.length - 1 && (
                <ArrowRight className={`
                  h-5 w-5 flex-shrink-0
                  ${status === "completed" ? "text-primary" : "text-muted-foreground"}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}