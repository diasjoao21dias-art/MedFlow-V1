import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import LayoutShell from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { HeaderResumo } from "@/components/agenda/HeaderResumo";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { AppointmentCardCompact } from "@/components/agenda/AppointmentCardCompact";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function DoctorAppointmentsPage() {
  const [date, setDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(["agendado", "em_atendimento", "presente", "confirmado"]);
  const [onlyPending, setOnlyPending] = useState(false);
  const [showFinished, setShowFinished] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: [api.appointments.list.path, format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      const res = await fetch(`${api.appointments.list.path}?date=${format(date, "yyyy-MM-dd")}`);
      if (!res.ok) throw new Error("Falha ao buscar agenda");
      return res.json();
    }
  });

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((apt: any) => {
      const patientName = apt?.patient?.name || "";
      const matchesSearch = 
        patientName.toLowerCase().includes(search.toLowerCase()) ||
        (apt?.patient?.cpf && apt.patient.cpf.includes(search)) ||
        (apt?.patient?.phone && apt.patient.phone.includes(search));
      
      const matchesStatus = statusFilter.includes(apt?.status);
      const matchesPending = !onlyPending || (apt?.paymentStatus === 'pendente' || !apt?.triageDone);

      return matchesSearch && matchesStatus && matchesPending;
    }).sort((a: any, b: any) => (a?.startTime || "").localeCompare(b?.startTime || ""));
  }, [appointments, search, statusFilter, onlyPending]);

  const stats = useMemo(() => {
    if (!appointments) return { total: 0, scheduled: 0, inProgress: 0, finished: 0, pending: 0 };
    return {
      total: appointments.length,
      scheduled: appointments.filter((a: any) => a.status === 'agendado').length,
      inProgress: appointments.filter((a: any) => a.status === 'em_atendimento').length,
      finished: appointments.filter((a: any) => a.status === 'finalizado').length,
      pending: appointments.filter((a: any) => a.paymentStatus === 'pendente' || !a.triageDone).length,
    };
  }, [appointments]);

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const inProgress = filteredAppointments.filter((a: any) => a.status === 'em_atendimento');
  const upcoming = filteredAppointments.filter((a: any) => a.status !== 'em_atendimento' && a.status !== 'finalizado');
  const finished = filteredAppointments.filter((a: any) => a.status === 'finalizado');

  return (
    <LayoutShell>
      <PageHeader title="Consultas" description="Agenda do médico" className="mb-6" />

      <HeaderResumo {...stats} />

      <AgendaFilters
        date={date}
        onDateChange={setDate}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onlyPending={onlyPending}
        onOnlyPendingChange={setOnlyPending}
      />

      <div className="space-y-6">
        {inProgress.length > 0 && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              Em Atendimento
            </h2>
            <div className="space-y-2">
              {inProgress.map(apt => <AppointmentCardCompact key={apt.id} appointment={apt} />)}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            {inProgress.length > 0 ? "Próximos Atendimentos" : "Atendimentos do Dia"}
          </h2>
          {upcoming.length === 0 && inProgress.length === 0 && finished.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Nenhum agendamento encontrado</h3>
              <p className="text-slate-600">Tente ajustar os filtros ou mudar a data.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map(apt => <AppointmentCardCompact key={apt.id} appointment={apt} />)}
            </div>
          )}
        </div>

        {finished.length > 0 && (
          <Collapsible open={showFinished} onOpenChange={setShowFinished}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex justify-between items-center py-6 border-t rounded-none hover:bg-slate-50">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Finalizados ({finished.length})
                </span>
                {showFinished ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-4 animate-in fade-in slide-in-from-top-4">
              {finished.map(apt => <AppointmentCardCompact key={apt.id} appointment={apt} />)}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </LayoutShell>
  );
}

