import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Phone, MessageCircle, ChevronDown, ChevronUp, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AppointmentCardProps {
  appointment: any;
}

export function AppointmentCardCompact({ appointment }: AppointmentCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const statusColors: Record<string, string> = {
    agendado: "bg-blue-100 text-blue-700 border-blue-200",
    confirmado: "bg-indigo-100 text-indigo-700 border-indigo-200",
    presente: "bg-green-100 text-green-700 border-green-200",
    em_atendimento: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse",
    finalizado: "bg-slate-100 text-slate-700 border-slate-200",
    cancelado: "bg-red-100 text-red-700 border-red-200",
  };

  const statusLabels: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    presente: "Presente",
    em_atendimento: "Em Atendimento",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };

  return (
    <Card className="hover:shadow-md transition-all border-none shadow-sm overflow-hidden group mb-2">
      <div className="flex items-center p-3 gap-4">
        <div className="w-16 flex flex-col items-center justify-center border-r pr-4">
          <span className="text-lg font-bold text-primary leading-none">{appointment.startTime}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{appointment.duration}min</span>
        </div>

        <div className="flex-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
              {appointment?.patient?.name?.charAt(0) || "?"}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-none mb-1">{appointment?.patient?.name || "Paciente não identificado"}</h3>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="text-[9px] px-1 h-4 uppercase">{appointment?.type || "consulta"}</Badge>
                {appointment?.patient?.phone && (
                   <span className="flex items-center gap-1"><Phone className="w-2 h-2" /> {appointment.patient.phone}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge className={cn("px-2 py-0 h-6 text-[10px] font-bold border", statusColors[appointment?.status || "agendado"])}>
              {statusLabels[appointment?.status || "agendado"] || appointment?.status || "Agendado"}
            </Badge>

            <div className="flex items-center gap-1">
              {appointment?.status !== 'finalizado' && appointment?.id && (
                <Link href={`/doctor/attend/${appointment.id}`}>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {appointment?.patient?.phone && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(!isOpen)}
              >
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent className="bg-slate-50 border-t p-4 animate-in slide-in-from-top-2">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Informações do Paciente</p>
              <p><strong>CPF:</strong> {appointment?.patient?.cpf || "---"}</p>
              <p><strong>Gênero:</strong> {appointment?.patient?.gender || "---"}</p>
              <p><strong>Nascimento:</strong> {appointment?.patient?.birthDate || "---"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detalhes do Agendamento</p>
              <p><strong>Convênio:</strong> {appointment?.insurance || "Particular"}</p>
              <p><strong>Valor:</strong> {((appointment?.price || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p><strong>Pagamento:</strong> <Badge variant={appointment?.paymentStatus === 'pago' ? 'default' : 'outline'} className="text-[9px]">{appointment?.paymentStatus || "pendente"}</Badge></p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Triagem / Notas</p>
              {appointment?.triageDone ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100">
                  Triagem realizada: PA {appointment.triageData?.bloodPressure || "N/A"}, T {appointment.triageData?.temperature || "N/A"}°C
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhuma triagem realizada</p>
              )}
              {appointment?.notes && <p className="text-xs italic text-slate-600">"{appointment.notes}"</p>}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-end gap-2">
            {/*
              Para atendimentos finalizados, o prontuário deve abrir em modo visualização (somente leitura)
              para não disparar o bloqueio de acesso do fluxo de atendimento.
            */}
            <Link
              href={
                appointment.status === 'finalizado'
                  ? `/doctor/attend/${appointment.id}?view=1&tab=history`
                  : `/doctor/attend/${appointment.id}`
              }
            >
              <Button variant="outline" size="sm" className="h-8 text-xs">Ver Prontuário</Button>
            </Link>

            {appointment.status !== 'finalizado' && (
              <Link href={`/doctor/attend/${appointment.id}`}>
                <Button size="sm" className="h-8 text-xs">{appointment.status === 'em_atendimento' ? 'Continuar' : 'Iniciar'}</Button>
              </Link>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
