import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FactBoxSection {
  title: string;
  items: { label: string; value: string | number }[];
}

interface FactBoxProps {
  sections: FactBoxSection[];
}

const FactBox = ({ sections }: FactBoxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-16 z-30 h-8 w-8 p-0"
        title={open ? "Hide FactBox" : "Show FactBox"}
      >
        {open ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </Button>

      {open && (
        <aside className="w-64 border-l bg-bc-factbox p-4 space-y-4 overflow-y-auto flex-shrink-0">
          {sections.map((section, i) => (
            <div key={i}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {section.title}
              </h4>
              <div className="space-y-1.5">
                {section.items.map((item, j) => (
                  <div key={j} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </aside>
      )}
    </>
  );
};

export default FactBox;
