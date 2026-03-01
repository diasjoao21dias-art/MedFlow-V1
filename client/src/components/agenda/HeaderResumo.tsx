import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface SummaryProps {
  total: number;
  scheduled: number;
  inProgress: number;
  finished: number;
  pending: number;
}

export function HeaderResumo({ total, scheduled, inProgress, finished, pending }: SummaryProps) {
  const cards = [
    { label: "Total Hoje", value: total, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Agendados", value: scheduled, icon: Calendar, color: "text-slate-600", bg: "bg-slate-50" },
    { label: "Em Atendimento", value: inProgress, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Finalizados", value: finished, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Pendentes", value: pending, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {cards.map((card) => (
        <Card key={card.label} className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
