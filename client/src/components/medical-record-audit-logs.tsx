import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, History, User, Clock, FileText } from "lucide-react";

export function MedicalRecordAuditLogs({ patientId }: { patientId: number }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: records, isLoading } = useQuery({
    queryKey: [api.medicalRecords.listByPatient.path, patientId],
    queryFn: async () => {
      const res = await fetch(api.medicalRecords.listByPatient.path.replace(':patientId', patientId.toString()));
      if (!res.ok) throw new Error("Falha ao buscar registros");
      return res.json();
    }
  });

  const selectedTitle = useMemo(() => {
    if (!selected) return "";
    const when = selected.createdAt ? format(new Date(selected.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "";
    return `Registro #${selected.id}${when ? ` • ${when}` : ""}`;
  }, [selected]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold">Histórico de Alterações e Auditoria</h3>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-4">
          {records && records.length > 0 ? (
            records.map((record: any) => (
              <Card key={record.id} className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="py-3 px-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                        Registro #{record.id}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(record.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                      <User className="w-3 h-3" />
                      Dr(a). {record.doctor?.name || 'Médico'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {record.diagnosis && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Diagnóstico</span>
                      <p className="text-sm font-medium">{record.diagnosis}</p>
                    </div>
                  )}
                  {record.chiefComplaint && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Queixa Principal</span>
                      <p className="text-sm text-slate-700 italic">"{record.chiefComplaint}"</p>
                    </div>
                  )}
                  <div className="pt-2 flex justify-end">
                     <button
                       type="button"
                       onClick={() => {
                         setSelected(record);
                         setOpen(true);
                       }}
                       className="inline-flex"
                     >
                       <Badge
                         variant="outline"
                         className="text-[10px] gap-1 opacity-80 hover:opacity-100 cursor-pointer select-none"
                       >
                         <FileText className="w-3 h-3" /> Visualizar Log Completo
                       </Badge>
                     </button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum registro histórico encontrado para este paciente.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedTitle || "Log do prontuário"}</DialogTitle>
            <DialogDescription>
              Visualização completa do conteúdo registrado neste prontuário.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Médico</div>
                    <div className="text-sm font-medium">Dr(a). {selected.doctor?.name || "Médico"}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Paciente</div>
                    <div className="text-sm font-medium">{selected.patient?.name || "Paciente"}</div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Sinais vitais</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div><span className="text-slate-500">PA:</span> {selected.vitals?.bloodPressure || "—"}</div>
                    <div><span className="text-slate-500">FC:</span> {selected.vitals?.heartRate || "—"}</div>
                    <div><span className="text-slate-500">Temp:</span> {selected.vitals?.temperature || "—"}</div>
                    <div><span className="text-slate-500">Peso:</span> {selected.vitals?.weight || "—"}</div>
                    <div><span className="text-slate-500">Altura:</span> {selected.vitals?.height || "—"}</div>
                  </div>
                </div>

                <Separator />

                {selected.chiefComplaint ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Queixa principal</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.chiefComplaint}</div>
                  </section>
                ) : null}

                {selected.history ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">História / HDA</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.history}</div>
                  </section>
                ) : null}

                {selected.diagnosis ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Diagnóstico</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.diagnosis}</div>
                  </section>
                ) : null}

                {selected.allergies ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alergias</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.allergies}</div>
                  </section>
                ) : null}

                {selected.medications ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Medicamentos em uso</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{String(selected.medications)}</div>
                  </section>
                ) : null}

                {selected.prescription ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Prescrição / Plano</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.prescription}</div>
                  </section>
                ) : null}

                {selected.notes ? (
                  <section>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Observações</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{selected.notes}</div>
                  </section>
                ) : null}

                <div className="text-xs text-muted-foreground">
                  Este painel mostra o conteúdo clínico registrado no prontuário para conferência e auditoria.
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum log selecionado.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
