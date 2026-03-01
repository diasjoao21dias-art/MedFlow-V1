import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  agendado: {
    label: "Agendado",
    className: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  },
  aguardando: {
    label: "Aguardando",
    className: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
  },
  em_atendimento: {
    label: "Em Atendimento",
    className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status.toLowerCase()];
  
  if (!config) {
    return (
      <Badge variant="outline" className="capitalize" data-testid={`status-badge-unknown-${status}`}>
        {status.replace("_", " ")}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium shadow-sm", config.className)}
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </Badge>
  );
}
