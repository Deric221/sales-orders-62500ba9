import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface RibbonAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
}

export interface RibbonGroup {
  label: string;
  actions: RibbonAction[];
}

interface ActionRibbonProps {
  groups: RibbonGroup[];
}

const ActionRibbon = ({ groups }: ActionRibbonProps) => {
  return (
    <div className="bg-bc-ribbon border-b border-bc-ribbon-border px-4 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <Separator orientation="vertical" className="h-8 mx-2" />}
            <div className="flex items-center gap-1">
              {group.actions.map((action, ai) => (
                <Button
                  key={ai}
                  variant={action.variant || "ghost"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="gap-1.5 text-xs h-8"
                >
                  <action.icon className="h-3.5 w-3.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionRibbon;
