import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CueTileProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "green" | "amber" | "red" | "purple";
  path?: string;
  subtitle?: string;
}

const colorMap = {
  blue: "border-l-bc-cue-blue",
  green: "border-l-bc-cue-green",
  amber: "border-l-bc-cue-amber",
  red: "border-l-bc-cue-red",
  purple: "border-l-bc-cue-purple",
};

const iconColorMap = {
  blue: "text-bc-cue-blue",
  green: "text-bc-cue-green",
  amber: "text-bc-cue-amber",
  red: "text-bc-cue-red",
  purple: "text-bc-cue-purple",
};

const CueTile = ({ title, value, icon: Icon, color, path, subtitle }: CueTileProps) => {
  const navigate = useNavigate();

  return (
    <div
      className={`bc-cue-tile ${colorMap[color]} p-4 flex items-center justify-between gap-3`}
      onClick={() => path && navigate(path)}
      role={path ? "button" : undefined}
      tabIndex={path ? 0 : undefined}
    >
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <Icon className={`h-8 w-8 ${iconColorMap[color]} opacity-70 flex-shrink-0`} />
    </div>
  );
};

export default CueTile;
