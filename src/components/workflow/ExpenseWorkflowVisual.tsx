import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  UserCheck, 
  Wallet, 
  CheckSquare, 
  Receipt,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

interface ExpenseWorkflowVisualProps {
  currentStatus: string;
  hasReceipt: boolean;
}

const stages = [
  { key: "draft", label: "Submitted", icon: FileText },
  { key: "pending_manager_approval", label: "Manager Approval", icon: UserCheck },
  { key: "approved", label: "Finance Payment", icon: Wallet },
  { key: "paid", label: "Payment Ack.", icon: CheckSquare },
  { key: "retired", label: "Retire Document", icon: Receipt, conditional: true },
];

export function ExpenseWorkflowVisual({ currentStatus, hasReceipt }: ExpenseWorkflowVisualProps) {
  const getStageStatus = (stageKey: string): "completed" | "current" | "pending" => {
    const stageOrder = [
      "draft",
      "pending_manager_approval",
      "approved",
      "paid",
      ...(hasReceipt ? ["retired"] : [])
    ];

    const currentIndex = stageOrder.indexOf(currentStatus);
    const checkIndex = stageOrder.indexOf(stageKey);

    if (checkIndex < currentIndex) return "completed";
    if (checkIndex === currentIndex) return "current";
    return "pending";
  };

  const visibleStages = stages.filter(stage => 
    !stage.conditional || hasReceipt
  );

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Expense Workflow Progress</h3>
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