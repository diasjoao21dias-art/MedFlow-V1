import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface FiltersProps {
  date: Date;
  onDateChange: (date: Date) => void;
  search: string;
  onSearchChange: (search: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (status: string[]) => void;
  onlyPending: boolean;
  onOnlyPendingChange: (val: boolean) => void;
}

export function AgendaFilters({
  date,
  onDateChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onlyPending,
  onOnlyPendingChange,
}: FiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const toggleStatus = (status: string) => {
    if (statusFilter.includes(status)) {
      onStatusFilterChange(statusFilter.filter((s) => s !== status));
    } else {
      onStatusFilterChange([...statusFilter, status]);
    }
  };

  const statuses = [
    { id: "agendado", label: "Agendado" },
    { id: "em_atendimento", label: "Em atendimento" },
    { id: "finalizado", label: "Finalizado" },
    { id: "cancelado", label: "Cancelado" },
  ];

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 space-y-4 sticky top-0 z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onDateChange(subDays(date, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col items-center min-w-[140px]">
            <span className="text-sm font-bold capitalize">
              {format(date, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(date, "dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(date, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDateChange(new Date())} className="ml-2">
            Hoje
          </Button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            className="pl-10"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> STATUS:
          </span>
          {statuses.map((s) => (
            <Badge
              key={s.id}
              variant={statusFilter.includes(s.id) ? "default" : "outline"}
              className="cursor-pointer px-3 py-1 transition-all"
              onClick={() => toggleStatus(s.id)}
            >
              {s.label}
            </Badge>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="pending" checked={onlyPending} onCheckedChange={onOnlyPendingChange} />
          <Label htmlFor="pending" className="text-sm font-medium cursor-pointer">
            Somente pendentes
          </Label>
        </div>
      </div>
    </div>
  );
}
