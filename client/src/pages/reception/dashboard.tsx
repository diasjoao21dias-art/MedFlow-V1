import * as React from "react";
import LayoutShell from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";
import { StatCard } from "@/components/stat-card";
import {
  Calendar,
  Users,
  Clock,
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { cn } from "@/lib/utils";

type LicenseStatus = {
  active: boolean;
  expiresAt: number | null;
  issuedAt: number | null;
  daysRemaining: number | null;
  keyHint: string | null;
};

function parseTimeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 w-full rounded-2xl bg-slate-100 animate-pulse" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[108px] rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="grid xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 h-[420px] rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-[420px] rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "amber" | "violet" | "slate" }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>
      <span className="opacity-80">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function ReceptionDashboard() {
  const { user } = useAuth();
  const selectedDate = format(new Date(), "yyyy-MM-dd");

  const renewUrl = React.useMemo(() => {
    const text = encodeURIComponent("Olá! Quero renovar a licença do MedFlow. Pode me ajudar?");
    return `https://wa.me/553498250458?text=${text}`;
  }, []);

  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    enabled: !!user && (user.role === "admin" || user.role === "operator"),
  });

  const {
    data: allAppointments,
    isLoading: isLoadingAppointments,
    error: appointmentsError,
  } = useAppointments({ date: selectedDate });

  const {
    data: doctors,
    isLoading: isLoadingDoctors,
    error: doctorsError,
  } = useQuery<User[]>({
    // IMPORTANT:
    // /api/users is admin-only in the backend. Reception (operator) should use /api/doctors.
    queryKey: ["/api/doctors"],
    queryFn: async () => {
      const res = await fetch("/api/doctors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
    enabled:
      !!user &&
      // Roles supported by the backend schema: admin | operator | doctor | nurse
      (user.role === "admin" || user.role === "operator"),
  });

  if (isLoadingAppointments) {
    return (
      <LayoutShell>
        <DashboardSkeleton />
      </LayoutShell>
    );
  }

  const appts = allAppointments ?? [];

  // Normalize + order by time (critical for "próximas")
  const apptsByTime = [...appts].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const countTotal = appts.length;
  const countPending = appts.filter((a) => ["agendado", "confirmado"].includes(a.status)).length;
  const countWaiting = appts.filter((a) => ["presente"].includes(a.status)).length;
  const countInService = appts.filter((a) => a.status === "em_atendimento").length;
  const countDone = appts.filter((a) => a.status === "finalizado").length;

  // Sections
  const waitingQueue = apptsByTime.filter((a) => a.status === "presente");
  const inService = apptsByTime.filter((a) => a.status === "em_atendimento");
  const upcoming = apptsByTime.filter((a) => ["agendado", "confirmado"].includes(a.status)).slice(0, 6);

  const hasErrors = !!appointmentsError || !!doctorsError;

  const showLicenseWarning =
    !!licenseStatus?.active &&
    typeof licenseStatus?.daysRemaining === "number" &&
    licenseStatus.daysRemaining <= 5;

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Dashboard" description="Visão geral da clínica para hoje" />
          <div className="hidden md:flex flex-col items-end gap-2">
            <div className="text-sm text-muted-foreground">{format(new Date(), "dd/MM/yyyy")}</div>
            <div className="flex flex-wrap justify-end gap-2">
              <StatusPill label="Pendentes" value={countPending} tone="amber" />
              <StatusPill label="Aguardando" value={countWaiting} tone="blue" />
              <StatusPill label="Em atendimento" value={countInService} tone="violet" />
              <StatusPill label="Finalizados" value={countDone} tone="green" />
            </div>
          </div>
        </div>

        {showLicenseWarning && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-sm text-amber-950">
                  <div className="font-semibold">Atenção: licença perto de expirar</div>
                  <div className="mt-1">
                    Restam <span className="font-semibold tabular-nums">{licenseStatus?.daysRemaining}</span> dia(s).
                    Renove para evitar interrupções no sistema.
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {user?.role === "admin" && (
                    <Button asChild variant="outline">
                      <Link href="/admin/license">Gerenciar licença</Link>
                    </Button>
                  )}
                  <Button onClick={() => window.open(renewUrl, "_blank")}>Renovar pelo WhatsApp</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hasErrors && (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="py-4 text-sm text-amber-900">
              Alguns dados não puderam ser carregados. Tente atualizar a página.
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Agendamentos Hoje" value={countTotal} icon={Calendar} color="primary" />
          <StatCard title="Aguardando" value={countWaiting} icon={Clock} color="orange" />
          <StatCard
            title="Médicos"
            value={isLoadingDoctors ? "…" : doctors?.length || 0}
            icon={Users}
            color="accent"
          />
          <StatCard title="Pendentes" value={countPending} icon={AlertCircle} color="purple" />
        </div>

        <div className="grid xl:grid-cols-3 gap-8">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Fluxo de Hoje</CardTitle>
                <p className="text-sm text-muted-foreground">Fila de espera, em atendimento e próximas consultas</p>
              </div>
              <Link href="/reception/schedule">
                <span className="text-sm text-blue-700 hover:underline font-medium cursor-pointer">Ver Agenda Completa</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Aguardando</div>
                    <Clock className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{countWaiting}</div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${countTotal === 0 ? 0 : Math.round((countWaiting / countTotal) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Em atendimento</div>
                    <Stethoscope className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{countInService}</div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: `${countTotal === 0 ? 0 : Math.round((countInService / countTotal) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Finalizados</div>
                    <CheckCircle2 className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{countDone}</div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${countTotal === 0 ? 0 : Math.round((countDone / countTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Fila de espera</h3>
                    <span className="text-xs text-muted-foreground">Status: Presente</span>
                  </div>

                  <div className="space-y-3">
                    {waitingQueue.length > 0 ? (
                      waitingQueue.slice(0, 4).map((apt) => (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold shadow-sm">
                              {apt.startTime.split(":")[0]}h
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{apt.patient.name}</p>
                              <p className="text-sm text-muted-foreground truncate">Dr. {apt.doctor.name}</p>
                            </div>
                          </div>
                          <StatusBadge status={apt.status} />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-muted-foreground">
                        Nenhum paciente aguardando no momento.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Próximas consultas</h3>
                    <span className="text-xs text-muted-foreground">Agendado / Confirmado</span>
                  </div>

                  <div className="space-y-3">
                    {upcoming.length > 0 ? (
                      upcoming.map((apt) => (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 font-bold shadow-sm">
                              {apt.startTime}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{apt.patient.name}</p>
                              <p className="text-sm text-muted-foreground truncate">Dr. {apt.doctor.name}</p>
                            </div>
                          </div>
                          <StatusBadge status={apt.status} />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-muted-foreground">
                        Nenhuma consulta pendente para hoje.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {inService.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Em atendimento agora</h3>
                    <span className="text-xs text-muted-foreground">{inService.length} paciente(s)</span>
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    {inService.slice(0, 4).map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between rounded-2xl bg-white border border-slate-200 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold rounded-full bg-violet-50 text-violet-700 px-2 py-1">
                              {apt.startTime}
                            </span>
                            <p className="font-semibold text-slate-900 truncate">{apt.patient.name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">Dr. {apt.doctor.name}</p>
                        </div>
                        <StatusBadge status={apt.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Link href="/reception/schedule">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group">
                  <CalendarDays className="w-8 h-8 text-slate-400 group-hover:text-primary mb-3" />
                  <span className="font-semibold text-slate-700 group-hover:text-primary">Novo agendamento</span>
                </div>
              </Link>
              <Link href="/reception/checkin">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group">
                  <ClipboardList className="w-8 h-8 text-slate-400 group-hover:text-primary mb-3" />
                  <span className="font-semibold text-slate-700 group-hover:text-primary">Check-in rápido</span>
                </div>
              </Link>
              <Link href="/reception/patients">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group">
                  <Users className="w-8 h-8 text-slate-400 group-hover:text-primary mb-3" />
                  <span className="font-semibold text-slate-700 group-hover:text-primary">Cadastrar paciente</span>
                </div>
              </Link>
              <Link href="/reception/agenda">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group">
                  <Calendar className="w-8 h-8 text-slate-400 group-hover:text-primary mb-3" />
                  <span className="font-semibold text-slate-700 group-hover:text-primary">Visão semanal</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
