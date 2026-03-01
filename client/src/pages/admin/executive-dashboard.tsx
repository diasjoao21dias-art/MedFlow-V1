import LayoutShell from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { useAppointments } from "@/hooks/use-appointments";
import { 
  Users, 
  CalendarCheck, 
  CalendarClock, 
  TrendingUp, 
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertCircle,
  Clock,
  User
} from "lucide-react";
import { useState, useMemo } from "react";
import { 
  format, 
  subDays, 
  startOfDay, 
  endOfDay, 
  isWithinInterval, 
  parseISO,
  isSameDay
} from "date-fns";

export default function ExecutiveDashboard() {
  const [period, setPeriod] = useState<"today" | "7days" | "30days">("7days");

  // Período Atual
  const currentInterval = useMemo(() => {
    const now = new Date();
    const end = endOfDay(now);
    let start = startOfDay(now);

    if (period === "7days") {
      start = startOfDay(subDays(now, 6));
    } else if (period === "30days") {
      start = startOfDay(subDays(now, 29));
    }

    return { start, end };
  }, [period]);

  // Período Anterior (para comparação)
  const previousInterval = useMemo(() => {
    const { start, end } = currentInterval;
    const diff = end.getTime() - start.getTime() + 1000; // +1s para cobrir o intervalo completo
    
    return {
      start: new Date(start.getTime() - diff),
      end: new Date(end.getTime() - diff)
    };
  }, [currentInterval]);

  // Busca dados de ambos os períodos (usando um intervalo maior para cobrir ambos)
  const { data: allAppointments, isLoading } = useAppointments({
    startDate: format(previousInterval.start, "yyyy-MM-dd"),
    endDate: format(currentInterval.end, "yyyy-MM-dd"),
  });

  const stats = useMemo(() => {
    if (!allAppointments) return null;

    const processStats = (interval: { start: Date, end: Date }) => {
      return allAppointments.reduce(
        (acc, apt) => {
          const aptDate = parseISO(apt.date);
          if (isWithinInterval(aptDate, { start: interval.start, end: interval.end })) {
            acc.total++;
            if (apt.status === "finalizado") {
              acc.completed++;
              acc.revenue += (apt.price || 0) / 100;
            }
            if (apt.paymentStatus !== "pago") {
              acc.pendingRevenue += (apt.price || 0) / 100;
            }
          }
          return acc;
        },
        { total: 0, completed: 0, revenue: 0, pendingRevenue: 0 }
      );
    };

    const current = processStats(currentInterval);
    const previous = processStats(previousInterval);

    const calcVariation = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    // Próximos atendimentos (Hoje)
    const today = new Date();
    const nextAppointments = allAppointments
      .filter(apt => isSameDay(parseISO(apt.date), today) && (apt.status === "agendado" || apt.status === "confirmado"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5);

    // Pendências Críticas
    const criticalIssues = allAppointments
      .filter(apt => (apt.paymentStatus !== "pago" && apt.status === "finalizado") || (apt.triageDone === false && apt.status === "presente"))
      .slice(0, 5);

    // Rankings (apenas período atual)
    const doctorStats: Record<number, { name: string, count: number, revenue: number }> = {};
    allAppointments.forEach(apt => {
      const aptDate = parseISO(apt.date);
      if (isWithinInterval(aptDate, { start: currentInterval.start, end: currentInterval.end })) {
        const docId = apt.doctorId;
        if (!doctorStats[docId]) {
          doctorStats[docId] = { name: apt.doctor?.name || `Médico ${docId}`, count: 0, revenue: 0 };
        }
        doctorStats[docId].count++;
        if (apt.status === "finalizado") {
          doctorStats[docId].revenue += (apt.price || 0) / 100;
        }
      }
    });

    const rankingQty = Object.values(doctorStats).sort((a, b) => b.count - a.count).slice(0, 5);
    const rankingRevenue = Object.values(doctorStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      current,
      variations: {
        total: calcVariation(current.total, previous.total),
        completed: calcVariation(current.completed, previous.completed),
        revenue: calcVariation(current.revenue, previous.revenue)
      },
      nextAppointments,
      criticalIssues,
      rankingQty,
      rankingRevenue,
      ticketMedio: current.completed > 0 ? current.revenue / current.completed : 0
    };
  }, [allAppointments, currentInterval, previousInterval]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const VariationBadge = ({ value }: { value: number }) => (
    <span className={`flex items-center text-xs font-medium ${value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
      {value >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
      {Math.abs(value)}%
    </span>
  );

  return (
    <LayoutShell>
      <div className="space-y-10 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
          <div>
            <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Painel de Gestão</h1>
            <p className="text-slate-500 mt-2 text-lg">Indicadores estratégicos para tomada de decisão.</p>
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full md:w-auto">
            <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 w-full md:w-auto">
              <TabsTrigger value="today" className="px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Hoje</TabsTrigger>
              <TabsTrigger value="7days" className="px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">7 Dias</TabsTrigger>
              <TabsTrigger value="30days" className="px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">30 Dias</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading || !stats ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary/60" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Atendimentos</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.current.total}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <VariationBadge value={stats.variations.total} />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">vs anterior</span>
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
                </div>
              </Card>

              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Finalizados</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.current.completed}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <VariationBadge value={stats.variations.completed} />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">vs anterior</span>
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg"><CalendarCheck className="w-5 h-5 text-emerald-600" /></div>
                </div>
              </Card>

              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Receita Realizada</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.current.revenue)}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <VariationBadge value={stats.variations.revenue} />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">vs anterior</span>
                    </div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
                </div>
              </Card>

              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Ticket Médio</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.ticketMedio)}</h3>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">Média por finalizado</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg"><DollarSign className="w-5 h-5 text-purple-600" /></div>
                </div>
              </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white lg:col-span-2">
                <CardHeader><CardTitle className="text-lg font-bold text-slate-800">Próximos Atendimentos (Hoje)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {stats.nextAppointments.length > 0 ? stats.nextAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-bold text-primary w-12">{apt.startTime}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{apt.patient?.name}</p>
                            <p className="text-xs text-slate-500">{apt.doctor?.name}</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 font-bold uppercase text-slate-600 tracking-tighter">
                          {apt.status}
                        </span>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-slate-400 text-sm italic">Nenhum atendimento agendado para hoje.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm ring-1 ring-rose-100 bg-rose-50/20">
                <CardHeader><CardTitle className="text-lg font-bold text-rose-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Pendências Críticas</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.criticalIssues.length > 0 ? stats.criticalIssues.map((apt) => (
                      <div key={apt.id} className="p-3 bg-white rounded-lg border border-rose-100 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-slate-900">{apt.patient?.name}</p>
                          <span className="text-[9px] font-black uppercase text-rose-600">{apt.paymentStatus !== 'pago' ? 'PGTO PENDENTE' : 'TRIAGEM'}</span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {format(parseISO(apt.date), "dd/MM")} às {apt.startTime}</p>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-slate-400 text-sm italic">Nenhuma pendência crítica encontrada.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
                <CardHeader><CardTitle className="text-lg font-bold text-slate-800">Ranking: Médicos (Volume)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.rankingQty.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{i+1}</div>
                          <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{doc.count} <span className="text-[10px] text-slate-400 font-normal uppercase">atend.</span></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
                <CardHeader><CardTitle className="text-lg font-bold text-slate-800">Ranking: Médicos (Faturamento)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.rankingRevenue.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{i+1}</div>
                          <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                        </div>
                        <div className="text-sm font-bold text-emerald-600">{formatCurrency(doc.revenue)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </LayoutShell>
  );
}

