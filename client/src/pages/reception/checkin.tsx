import LayoutShell from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  Search,
  ClipboardList,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Clock,
  Phone,
  AlertCircle,
  QrCode,
  Banknote,
  CreditCard,
  CalendarDays,
  Play,
  SquareCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StatusKey =
  | "all"
  | "agendado"
  | "confirmado"
  | "presente"
  | "em_atendimento"
  | "finalizado"
  | "cancelado"
  | "ausente"
  | "remarcado";

const statusMeta: Record<
  Exclude<StatusKey, "all">,
  { label: string; leftBar: string; badge: string; icon: any }
> = {
  agendado: {
    label: "Agendado",
    leftBar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Clock,
  },
  confirmado: {
    label: "Confirmado",
    leftBar: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    icon: CheckCircle2,
  },
  presente: {
    label: "Aguardando",
    leftBar: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: ClipboardList,
  },
  em_atendimento: {
    label: "Em atendimento",
    leftBar: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Loader2,
  },
  finalizado: {
    label: "Finalizado",
    leftBar: "bg-green-600",
    badge: "bg-green-50 text-green-700 border-green-200",
    icon: SquareCheck,
  },
  cancelado: {
    label: "Cancelado",
    leftBar: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  },
  ausente: {
    label: "Ausente",
    leftBar: "bg-slate-500",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    icon: AlertCircle,
  },
  remarcado: {
    label: "Remarcado",
    leftBar: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: CalendarDays,
  },
};

function minutesDiff(now: Date, date: string, startTime: string) {
  // date: yyyy-MM-dd, startTime: HH:mm
  const start = new Date(`${date}T${startTime}:00`);
  const diffMs = now.getTime() - start.getTime();
  return Math.round(diffMs / 60000);
}

function delayBadge(now: Date, apt: any) {
  if (!apt?.date || !apt?.startTime) return null;
  const diffMin = minutesDiff(now, apt.date, apt.startTime);

  // Se ainda não chegou o horário
  if (diffMin < 0) {
    const mins = Math.abs(diffMin);
    return (
      <Badge
        variant="outline"
        className="rounded-xl border bg-slate-50 text-slate-700 border-slate-200"
        title="Tempo até o horário agendado"
      >
        <Clock className="w-3.5 h-3.5 mr-1" />
        em {mins} min
      </Badge>
    );
  }

  // Já passou do horário
  const label = diffMin === 0 ? "no horário" : `+${diffMin} min`;
  const cls = diffMin <= 5
    ? "bg-green-50 text-green-700 border-green-200"
    : diffMin <= 15
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <Badge variant="outline" className={cn("rounded-xl border", cls)} title="Atraso em relação ao horário">
      <Clock className="w-3.5 h-3.5 mr-1" />
      {label}
    </Badge>
  );
}

export default function CheckInPage() {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [showClosed, setShowClosed] = useState(false);

  // Modal pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credito" | "debito" | "dinheiro">("pix");
  const [paymentPrice, setPaymentPrice] = useState<number>(0);

  const { data: appointments, isLoading: isLoadingAppointments } = useAppointments({ date: today });
  const updateStatus = useUpdateAppointmentStatus();

  // Busca pacientes só quando o usuário digitar (sem carregar TODOS os pacientes)
  const { data: patientSearch, isLoading: isLoadingPatientSearch } = useQuery({
    queryKey: [api.patients.list.path, { search: query }],
    queryFn: async () => {
      const res = await fetch(`${api.patients.list.path}?search=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to search patients");
      return api.patients.list.responses[200].parse(await res.json());
    },
    enabled: query.trim().length >= 2,
  });

  const now = new Date();

  const sortedToday = useMemo(() => {
    const list = appointments ? [...appointments] : [];
    list.sort((a: any, b: any) => (a.startTime || "").localeCompare(b.startTime || ""));
    return list;
  }, [appointments]);

  const filteredQueue = useMemo(() => {
    let list = sortedToday;

    if (status !== "all") list = list.filter((a: any) => String(a.status) === status);

    if (query.trim().length) {
      const q = query.trim().toLowerCase();
      // filtra dentro da fila do dia por nome/telefone/cpf
      list = list.filter((a: any) => {
        const p = a.patient || {};
        return (
          String(p.name || "").toLowerCase().includes(q) ||
          String(p.phone || "").toLowerCase().includes(q) ||
          String(p.cpf || "").toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [sortedToday, status, query]);

  const groups = useMemo(() => {
    const waiting = filteredQueue.filter((a: any) => a.status === "presente");
    const inCare = filteredQueue.filter((a: any) => a.status === "em_atendimento");
    const upcoming = filteredQueue.filter((a: any) => a.status === "agendado" || a.status === "confirmado");
    const closed = filteredQueue.filter((a: any) => ["finalizado", "cancelado", "ausente", "remarcado"].includes(String(a.status)));
    return { waiting, inCare, upcoming, closed };
  }, [filteredQueue]);

  const queueStats = useMemo(() => {
    const all = sortedToday.length;
    const waiting = sortedToday.filter((a: any) => a.status === "presente").length;
    const inCare = sortedToday.filter((a: any) => a.status === "em_atendimento").length;
    const done = sortedToday.filter((a: any) => a.status === "finalizado").length;
    const scheduled = sortedToday.filter((a: any) => a.status === "agendado" || a.status === "confirmado").length;
    return { all, scheduled, waiting, inCare, done };
  }, [sortedToday]);

  const openPayment = (appointment: any) => {
    setSelectedAppointment(appointment);
    setPaymentPrice((appointment.price || 0) / 100);
    setIsPaymentModalOpen(true);
  };

  const confirmCheckin = async () => {
    if (!selectedAppointment) return;
    try {
      await updateStatus.mutateAsync({
        id: selectedAppointment.id,
        status: "presente",
        paymentMethod,
        paymentStatus: "pago",
        price: paymentPrice,
      });

      setIsPaymentModalOpen(false);
      setSelectedAppointment(null);

      toast({
        title: "Check-in realizado",
        description: "Paciente marcado como presente e pagamento registrado.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao realizar check-in",
        description: "Não foi possível atualizar o agendamento.",
      });
    }
  };

  const moveStatus = async (apt: any, nextStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: apt.id, status: nextStatus });
      toast({
        title: "Status atualizado",
        description: `Agendamento: ${statusMeta[nextStatus as any]?.label ?? nextStatus}`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o status.",
      });
    }
  };

  const showSearchResultsPanel =
    query.trim().length >= 2 && (isLoadingPatientSearch || (patientSearch && patientSearch.length > 0));

  const Row = ({ apt, variant }: { apt: any; variant?: "waiting" | "incare" | "default" }) => {
    const p = apt.patient;
    const meta = statusMeta[String(apt.status) as Exclude<StatusKey, "all">];
    const Icon = meta?.icon || ClipboardList;

    const canCheckin = ["agendado", "confirmado"].includes(String(apt.status));
    const canCall = String(apt.status) === "presente";
    const canFinish = String(apt.status) === "em_atendimento";

    return (
      <div
        className={cn(
          "group flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 transition",
          variant === "waiting" && "bg-orange-50/50 hover:bg-orange-50",
          variant === "incare" && "bg-purple-50/40 hover:bg-purple-50/60",
          variant === "default" && "hover:bg-slate-50/60",
        )}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-1.5 rounded-full mt-1.5", meta?.leftBar || "bg-slate-300")} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900 truncate">{p?.name}</p>

              <Badge variant="outline" className={cn("rounded-xl border", meta?.badge)}>
                <Icon
                  className={cn(
                    "w-3.5 h-3.5 mr-1",
                    String(apt.status) === "em_atendimento" && "animate-spin",
                  )}
                />
                {meta?.label || apt.status}
              </Badge>

              {delayBadge(now, apt)}
            </div>

            <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {apt.startTime}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {p?.phone || "Sem telefone"}
              </span>
              <span className="truncate">Dr. {apt.doctor?.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end flex-wrap">
          {canCheckin ? (
            <Button
              className="rounded-xl font-semibold"
              onClick={() => openPayment(apt)}
              disabled={updateStatus.isPending}
              data-testid={`button-checkin-${p?.id}`}
            >
              {updateStatus.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Confirmar presença
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : null}

          {canCall ? (
            <Button
              variant="outline"
              className="rounded-xl font-semibold"
              onClick={() => moveStatus(apt, "em_atendimento")}
              disabled={updateStatus.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Chamar
            </Button>
          ) : null}

          {canFinish ? (
            <Button
              variant="outline"
              className="rounded-xl font-semibold"
              onClick={() => moveStatus(apt, "finalizado")}
              disabled={updateStatus.isPending}
            >
              <SquareCheck className="w-4 h-4 mr-2" />
              Finalizar
            </Button>
          ) : null}

          {!canCheckin && !canCall && !canFinish ? (
            <div className="px-3 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 inline-flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              OK
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        <PageHeader
          title="Check-in"
          description={todayLabel}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/reception/patients?new=1">
                <Button className="rounded-xl">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Novo paciente
                </Button>
              </Link>
              <Link href="/reception/agenda">
                <Button variant="outline" className="rounded-xl">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Agenda
                </Button>
              </Link>
            </div>
          }
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total do dia" value={queueStats.all} icon={ClipboardList} color="primary" />
          <StatCard title="Agendados" value={queueStats.scheduled} icon={Clock} color="purple" />
          <StatCard title="Na espera" value={queueStats.waiting} icon={ClipboardList} color="orange" />
          <StatCard title="Em atendimento" value={queueStats.inCare} icon={Loader2} color="accent" />
          <StatCard title="Atendidos" value={queueStats.done} icon={SquareCheck} color="accent" />
        </div>

        <Card className="border-slate-200/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-semibold text-slate-900">Fila de hoje</CardTitle>
              </div>

              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <Tabs value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
                  <TabsList className="rounded-2xl">
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="agendado">Agendados</TabsTrigger>
                    <TabsTrigger value="confirmado">Confirmados</TabsTrigger>
                    <TabsTrigger value="presente">Aguardando</TabsTrigger>
                    <TabsTrigger value="em_atendimento">Atendendo</TabsTrigger>
                    <TabsTrigger value="finalizado">Finalizados</TabsTrigger>
                    <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative w-full lg:w-[420px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar na fila (nome, CPF ou telefone)…"
                    className="pl-11 rounded-2xl h-11"
                    data-testid="input-search-patient"
                  />
                </div>
              </div>

              {/* painel opcional: resultados globais (fora da fila) */}
              {showSearchResultsPanel ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Resultados (cadastros)</p>
                    <p className="text-xs text-slate-500">Digite pelo menos 2 caracteres</p>
                  </div>

                  {isLoadingPatientSearch ? (
                    <div className="flex items-center gap-2 py-3 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Buscando…
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-2">
                      {patientSearch?.slice(0, 5).map((p: any) => (
                        <div
                          key={p.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-white border border-slate-200 p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {p.phone || "Sem telefone"}
                              </span>
                              <span>CPF: {p.cpf || "---"}</span>
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Link href={`/reception/agenda?patientId=${p.id}`}>
                              <Button variant="outline" size="sm" className="rounded-xl">
                                Criar encaixe
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoadingAppointments ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                <p className="text-slate-500 font-medium">Carregando fila…</p>
              </div>
            ) : filteredQueue.length ? (
              <div className="divide-y divide-slate-100">
                {/* Aguardando (Premium: seção destacada) */}
                {groups.waiting.length ? (
                  <div className="bg-orange-50/30">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Aguardando</p>
                      <Badge variant="outline" className="rounded-xl border bg-orange-50 text-orange-700 border-orange-200">
                        {groups.waiting.length}
                      </Badge>
                    </div>
                    <div className="divide-y divide-orange-100">
                      {groups.waiting.map((apt: any) => (
                        <Row key={apt.id} apt={apt} variant="waiting" />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Em atendimento */}
                {groups.inCare.length ? (
                  <div className="bg-purple-50/20">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Em atendimento</p>
                      <Badge variant="outline" className="rounded-xl border bg-purple-50 text-purple-700 border-purple-200">
                        {groups.inCare.length}
                      </Badge>
                    </div>
                    <div className="divide-y divide-purple-100">
                      {groups.inCare.map((apt: any) => (
                        <Row key={apt.id} apt={apt} variant="incare" />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Próximos */}
                {groups.upcoming.length ? (
                  <div>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Próximos</p>
                      <Badge variant="outline" className="rounded-xl border bg-slate-50 text-slate-700 border-slate-200">
                        {groups.upcoming.length}
                      </Badge>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {groups.upcoming.map((apt: any) => (
                        <Row key={apt.id} apt={apt} variant="default" />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Encerrados (colapsável) */}
                {groups.closed.length ? (
                  <div>
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
                      onClick={() => setShowClosed((s) => !s)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">Finalizados / Cancelados</p>
                        <Badge variant="outline" className="rounded-xl border bg-slate-50 text-slate-700 border-slate-200">
                          {groups.closed.length}
                        </Badge>
                      </div>
                      {showClosed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showClosed ? (
                      <div className="divide-y divide-slate-100">
                        {groups.closed.map((apt: any) => (
                          <Row key={apt.id} apt={apt} variant="default" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500">
                <p className="font-semibold">Nenhum agendamento para exibir</p>
                <p className="text-sm text-slate-400 mt-1">Ajuste os filtros ou crie um encaixe pela Agenda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de pagamento */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-800">Check-in e pagamento</DialogTitle>
            <DialogDescription className="text-slate-500">
              Confirme a presença e registre o pagamento de <strong>{selectedAppointment?.patient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Médico</span>
                <span className="font-semibold text-slate-700">Dr. {selectedAppointment?.doctor?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Horário</span>
                <span className="font-semibold text-slate-700">{selectedAppointment?.startTime}</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="font-semibold text-slate-800">Valor</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">R$</span>
                  <Input
                    type="number"
                    value={paymentPrice}
                    onChange={(e) => setPaymentPrice(Number(e.target.value))}
                    className="w-28 h-9 font-bold text-right rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "pix" ? "default" : "outline"}
                className="h-14 rounded-2xl flex items-center justify-center gap-2"
                onClick={() => setPaymentMethod("pix")}
              >
                <QrCode className="w-5 h-5" /> PIX
              </Button>

              <Button
                type="button"
                variant={paymentMethod === "dinheiro" ? "default" : "outline"}
                className="h-14 rounded-2xl flex items-center justify-center gap-2"
                onClick={() => setPaymentMethod("dinheiro")}
              >
                <Banknote className="w-5 h-5" /> Dinheiro
              </Button>

              <Button
                type="button"
                variant={paymentMethod === "credito" ? "default" : "outline"}
                className="h-14 rounded-2xl flex items-center justify-center gap-2"
                onClick={() => setPaymentMethod("credito")}
              >
                <CreditCard className="w-5 h-5" /> Crédito
              </Button>

              <Button
                type="button"
                variant={paymentMethod === "debito" ? "default" : "outline"}
                className="h-14 rounded-2xl flex items-center justify-center gap-2"
                onClick={() => setPaymentMethod("debito")}
              >
                <CreditCard className="w-5 h-5" /> Débito
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={confirmCheckin} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}
