import LayoutShell from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments } from "@/hooks/use-appointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  CalendarDays,
  FileText,
  Activity,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: appointments } = useAppointments({ 
    date: today,
    doctorId: user?.id 
  });

  const activeApts = appointments?.filter(a => a.status !== 'completed' && a.status !== 'cancelled') || [];
  const nextUp = activeApts.find(a => a.status === 'presente' || a.status === 'agendado');
  const completedCount = appointments?.filter(a => a.status === 'completed').length || 0;

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader title="Dashboard" description="Visão geral para hoje" />
          <div className="flex gap-3">
             <Link href="/doctor/appointments">
              <Button variant="outline" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                Ver Agenda
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground/80 text-sm font-medium">Pacientes Restantes</p>
                  <h3 className="text-3xl font-bold mt-1">{activeApts.length}</h3>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Consultas Concluídas</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-900">{completedCount}</h3>
                </div>
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Média de Tempo</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-900">24m</h3>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {nextUp && (
              <div className="bg-white border rounded-2xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Activity className="w-32 h-32 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    Próximo Atendimento • {nextUp.startTime}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{nextUp.patient.name}</h2>
                  <p className="text-slate-500 max-w-lg mb-6 line-clamp-2">
                    {nextUp.notes || "Consulta de rotina sem observações específicas."}
                  </p>
                  <Link href={`/doctor/attend/${nextUp.id}`}>
                    <Button size="lg" className="rounded-xl px-8 h-12 font-bold shadow-lg shadow-primary/20">
                      Iniciar Consulta
                      <PlayCircle className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Próximos na Fila</CardTitle>
                <Link href="/doctor/appointments">
                  <Button variant="ghost" size="sm" className="text-primary gap-1">
                    Ver todos <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {activeApts.slice(0, 5).map((apt) => (
                    <div key={apt.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {apt.patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{apt.patient.name}</p>
                          <p className="text-xs text-slate-600">{apt.startTime} • {apt.duration} min</p>
                        </div>
                      </div>
                      <Link href={`/doctor/attend/${apt.id}`}>
                        <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          Atender
                        </Button>
                      </Link>
                    </div>
                  ))}
                  {activeApts.length === 0 && (
                    <div className="py-12 text-center text-slate-600">
                      Nenhum paciente aguardando
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Ferramentas Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                <Link href="/doctor/prescriptions">
                  <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span>Modelos de Receita</span>
                  </Button>
                </Link>
                <Link href="/doctor/calculators">
                  <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl">
                    <Activity className="w-5 h-5 text-green-500" />
                    <span>Calculadoras Médicas</span>
                  </Button>
                </Link>
                <Link href="/reception/patients">
                  <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl">
                    <Users className="w-5 h-5 text-orange-500" />
                    <span>Diretório de Pacientes</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-slate-900 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-bold">Tempo Real</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Tempo médio de espera</span>
                    <span className="font-bold">12 min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Atraso na agenda</span>
                    <span className="font-bold text-green-400">Nenhum</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
