import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@shared/routes";
import type { InsertMedicalRecord } from "@shared/schema";
import LayoutShell from "@/components/layout-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMedicalRecordSchema } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useCreateMedicalRecord } from "@/hooks/use-medical-records";
import { useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, CheckCircle, History, FileText, ShieldCheck, User, ClipboardList, Activity, Stethoscope, Pill } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { MedicalRecordAuditLogs } from "@/components/medical-record-audit-logs";
import { useEffect } from "react";

export default function AttendPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isViewMode = new URLSearchParams(window.location.search).get("view") === "1";
  const viewTab = new URLSearchParams(window.location.search).get("tab") || "";
  const [, params] = useRoute("/doctor/attend/:id");
  const appointmentId = parseInt(params?.id || "0");

  const { data: clinic } = useQuery({
    queryKey: ["/api/clinic/me"],
  });

  const { data: appointment, isLoading } = useQuery({
    queryKey: [api.appointments.list.path, appointmentId],
    queryFn: async () => {
      const res = await fetch(api.appointments.list.path);
      const list = await res.json();
      return list.find((a: any) => a.id === appointmentId);
    },
    enabled: !!appointmentId,
  });

  const { data: patientRecords } = useQuery({
    queryKey: [api.medicalRecords.listByPatient.path, appointment?.patient?.id],
    queryFn: async () => {
      if (!appointment?.patient?.id) return [];
      const path = api.medicalRecords.listByPatient.path.replace(":patientId", String(appointment.patient.id));
      const res = await fetch(path);
      return res.json();
    },
    enabled: !!appointment?.patient?.id,
  });

  const signMutation = useMutation({
    mutationFn: async ({ recordId, hash }: { recordId: number, hash: string }) => {
      await apiRequest("POST", `/api/medical-records/${recordId}/sign`, {
        hash,
        certificate: "ICP-Brasil Standard v2.1"
      });
    },
    onSuccess: () => {
      if (appointment?.patientId) {
        queryClient.invalidateQueries({ queryKey: [api.medicalRecords.listByPatient.path, appointment.patientId] });
      }
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path, appointmentId] });
      toast({ title: "Assinado", description: "Prontuário assinado digitalmente com sucesso." });
    }
  });

  const form = useForm<InsertMedicalRecord>({
    resolver: zodResolver(insertMedicalRecordSchema),
    defaultValues: {
      appointmentId,
      patientId: appointment?.patientId,
      doctorId: appointment?.doctorId,
      clinicId: appointment?.clinicId,
      chiefComplaint: "",
      history: "",
      allergies: "",
      diagnosis: "",
      prescription: "",
      notes: "",
      vitals: {
        bloodPressure: "",
        temperature: "",
        heartRate: "",
        weight: "",
        height: "",
      }
    }
  });

  useEffect(() => {
    if (appointment && appointment.status === 'finalizado' && !isViewMode) {
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "Este atendimento já foi finalizado."
      });
      setLocation("/doctor/dashboard");
    }
  }, [appointment, isViewMode, setLocation, toast]);

  useEffect(() => {
    if (appointment) {
      form.reset({
        appointmentId: appointment.id,
        patientId: appointment.patient.id,
        doctorId: appointment.doctor.id,
        clinicId: appointment.clinicId,
        chiefComplaint: form.getValues("chiefComplaint") || "",
        history: form.getValues("history") || "",
        allergies: form.getValues("allergies") || "",
        diagnosis: form.getValues("diagnosis") || "",
        prescription: form.getValues("prescription") || "",
        notes: form.getValues("notes") || "",
        vitals: {
          bloodPressure: form.getValues("vitals.bloodPressure") || "",
          temperature: form.getValues("vitals.temperature") || "",
          heartRate: form.getValues("vitals.heartRate") || "",
          weight: form.getValues("vitals.weight") || "",
          height: form.getValues("vitals.height") || "",
        }
      });
    }
  }, [appointment, form]);

  const createRecord = useCreateMedicalRecord();

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (!appointment || !appointment.patient) {
    return (
      <LayoutShell>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900">Agendamento ou Paciente não encontrado</h2>
          <p className="text-muted-foreground mt-2">Verifique se o agendamento existe e tente novamente.</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Voltar
          </Button>
        </div>
      </LayoutShell>
    );
  }

  const onSubmit = async (data: InsertMedicalRecord) => {
    try {
      const payload = {
        ...data,
        patientId: appointment.patient.id,
        doctorId: appointment.doctor.id,
        clinicId: appointment.clinicId,
        appointmentId: appointment.id
      };
      
      const record = await createRecord.mutateAsync(payload);
      await signMutation.mutateAsync({ recordId: record.id, hash: "sha256:" + Math.random().toString(36).substring(7) });
      
      toast({ 
        title: "Atendimento Finalizado", 
        description: "O atendimento foi finalizado e o prontuário assinado com sucesso." 
      });

      setTimeout(() => {
        setLocation("/doctor/dashboard");
      }, 1500);
    } catch (error) {
      toast({ 
        variant: "destructive",
        title: "Erro ao finalizar", 
        description: "Ocorreu um erro ao tentar finalizar o atendimento." 
      });
    }
  };

  const handlePrint = (overrideText?: string) => {
    const prescriptionContent = (overrideText ?? form.getValues("prescription")) || "";
    const patientName = appointment.patient.name;

    // Use the logged-in doctor's data for the prescription
    const doctorName = currentUser?.name || appointment.doctor.name;
    const doctorSpecialty = currentUser?.specialty || appointment.doctor.specialty || "Clínico Geral";
    const dateStr = format(new Date(), 'dd/MM/yyyy');

    // Clinic details with fallbacks
    const clinicName = clinic?.name || "MediFlow - Gestão de Clínicas";
    const clinicCnpj = clinic?.cnpj ? `CNPJ: ${clinic.cnpj}` : "";
    const clinicAddress = clinic?.address || "";
    const clinicPhone = clinic?.phone || "";
    const clinicLogo = clinic?.logoUrl 
      ? `<img src="${clinic.logoUrl}" style="height: 60px;" />` 
      : `<h1 style="margin:0; color:#0f172a; font-size: 32px; font-weight: 900;">${clinicName.substring(0,1)}</h1>`;
    
    // Get professional council info from the logged-in doctor
    const { 
      professionalCouncilType: type, 
      professionalCouncilNumber: number, 
      professionalCouncilState: state 
    } = currentUser || appointment.doctor;

    const doctorCRM = (type && number && state) 
      ? `${type} ${number}-${state}`
      : "Registro profissional não informado";

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescrição Médica - ${patientName}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            html, body { padding: 0; margin: 0; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #1e293b;
              line-height: 1.45;
            }
            .container { padding: 16mm; }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10mm;
              margin-bottom: 8mm;
            }
            .clinic-info { text-align: right; }
            .clinic-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
            .clinic-details { font-size: 10px; color: #64748b; margin: 2px 0; text-transform: uppercase; letter-spacing: 0.4px; }

            .doc-patient-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 10mm;
            }
            .info-block { padding: 12px; background: #f8fafc; border-radius: 8px; }
            .label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
            .value { font-size: 14px; font-weight: 650; color: #0f172a; }

            .rx-symbol {
              font-size: 38px;
              font-weight: 700;
              color: #0f172a;
              margin: 4mm 0 4mm;
              font-family: serif;
            }

            .prescription-content {
              font-size: 15px;
              color: #334155;
              white-space: pre-wrap;
              line-height: 1.55;
            }

            .footer {
              margin-top: 12mm;
              padding-top: 8mm;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .signature-line { border-top: 1px solid #0f172a; width: 280px; margin: 0 auto 8px; }
            .doctor-signature { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
            .doctor-crm { font-size: 11px; color: #64748b; margin: 2px 0; }
            .print-date { font-size: 9px; color: #94a3b8; margin-top: 10mm; }

            /* Try hard to avoid awkward page breaks */
            .header, .doc-patient-info, .footer, .info-block { break-inside: avoid; page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                ${clinicLogo}
              </div>
              <div class="clinic-info">
                <p class="clinic-name">${clinicName}</p>
                <p class="clinic-details">${clinicCnpj}</p>
                <p class="clinic-details">${clinicAddress}</p>
                <p class="clinic-details">${clinicPhone}</p>
              </div>
            </div>

            <div class="doc-patient-info">
              <div class="info-block">
                <span class="label">Médico Responsável</span>
                <span class="value">Dr(a). ${doctorName}</span>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${doctorSpecialty} | ${doctorCRM}</div>
              </div>
              <div class="info-block">
                <span class="label">Paciente</span>
                <span class="value">${patientName}</span>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Data da Consulta: ${dateStr}</div>
              </div>
            </div>

            <div class="rx-symbol">℞</div>
            
            <div class="prescription-content">
              ${prescriptionContent || "Nenhum medicamento prescrito nesta consulta."}
            </div>

            <div class="footer">
              <div class="signature-line"></div>
              <p class="doctor-signature">Dr(a). ${doctorName}</p>
              <p class="doctor-crm">${doctorCRM}</p>
              <p class="print-date">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              try {
                const root = document.documentElement;
                const content = document.querySelector('.prescription-content');
                if (content) {
                  let fontSize = parseFloat(getComputedStyle(content).fontSize || '15');
                  let loops = 0;

                  const fitsOnePage = () => root.scrollHeight <= root.clientHeight + 2;

                  // If it overflows, gradually shrink text until it fits (down to 10px)
                  while (!fitsOnePage() && fontSize > 10 && loops < 40) {
                    fontSize -= 0.5;
                    content.style.fontSize = fontSize + 'px';
                    content.style.lineHeight = '1.35';
                    loops++;
                  }
                }
              } catch (e) { /* ignore */ }

              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const loadTemplate = () => {
    const template = localStorage.getItem("selected_template");
    if (template) {
      form.setValue("prescription", template);
      localStorage.removeItem("selected_template");
    }
  };

  const patientAge = differenceInYears(new Date(), new Date(appointment.patient.birthDate));

  // Modo de visualização (somente leitura) para prontuários já finalizados.
  // Exibe o prontuário e histórico/auditoria, sem permitir edição.
  const recordForThisAppointment = Array.isArray(patientRecords)
    ? (patientRecords as any[]).find((r) => r?.appointmentId === appointmentId)
    : undefined;

  const sortedRecords = Array.isArray(patientRecords)
    ? ([...(patientRecords as any[])].sort((a, b) => {
        const da = new Date(a?.createdAt || 0).getTime();
        const db = new Date(b?.createdAt || 0).getTime();
        return db - da;
      }))
    : [];

  const recordToView = recordForThisAppointment || sortedRecords[0];

  if (isViewMode) {
    // Se o usuário pediu diretamente a aba de histórico, mostramos primeiro o histórico.
    const showHistoryFirst = viewTab === "history";

    return (
      <LayoutShell>
        <div className="flex flex-col gap-6">
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-y-4">
              <div className="flex-1 min-w-[300px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary font-bold text-lg">{clinic?.name || "Clínica"}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-muted-foreground font-medium">Dr(a). {currentUser?.name || appointment.doctor.name}</span>
                  <Badge variant="outline" className="ml-2">Somente leitura</Badge>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{appointment.patient.name}</h1>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Idade</span>
                  <span className="font-semibold text-slate-900">{patientAge} anos</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Data</span>
                  <span className="font-semibold text-slate-900">{format(new Date(appointment.date), 'dd/MM/yyyy')}</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Horário</span>
                  <span className="font-semibold text-slate-900">{appointment.startTime}</span>
                </div>
              </div>

              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                  Voltar
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto w-full pb-20">
            {showHistoryFirst ? (
              <Card className="border-none shadow-sm" id="history-audit">
                <CardHeader>
                  <CardTitle className="text-xl">Histórico e Auditoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <MedicalRecordAuditLogs patientId={appointment.patient.id} />
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Prontuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!recordToView ? (
                  <p className="text-sm text-muted-foreground">Nenhum prontuário encontrado para este atendimento.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Queixa principal</span>
                        <div className="mt-1 whitespace-pre-wrap text-slate-900">{recordToView.chiefComplaint || "—"}</div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Diagnóstico</span>
                        <div className="mt-1 whitespace-pre-wrap text-slate-900">{recordToView.diagnosis || "—"}</div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase">Histórico / Anamnese</span>
                      <div className="mt-1 whitespace-pre-wrap text-slate-900">{recordToView.history || "—"}</div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <div className="text-[10px] uppercase font-bold text-slate-500">PA</div>
                        <div className="font-semibold">{recordToView.vitals?.bloodPressure || "—"}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <div className="text-[10px] uppercase font-bold text-slate-500">FC</div>
                        <div className="font-semibold">{recordToView.vitals?.heartRate || "—"}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Temp</div>
                        <div className="font-semibold">{recordToView.vitals?.temperature || "—"}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Peso</div>
                        <div className="font-semibold">{recordToView.vitals?.weight || "—"}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Altura</div>
                        <div className="font-semibold">{recordToView.vitals?.height || "—"}</div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Prescrição</span>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handlePrint(String(recordToView.prescription || ""))}>
                          <FileText className="w-4 h-4" />
                          Visualizar e Imprimir Receita
                        </Button>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap font-mono text-sm p-4 rounded-lg border bg-slate-50">
                        {recordToView.prescription || "—"}
                      </div>
                    </div>

                    {recordToView.notes ? (
                      <>
                        <Separator />
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase">Observações</span>
                          <div className="mt-1 whitespace-pre-wrap text-slate-900">{recordToView.notes}</div>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            {!showHistoryFirst ? (
              <Card className="border-none shadow-sm" id="history-audit">
                <CardHeader>
                  <CardTitle className="text-xl">Histórico e Auditoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <MedicalRecordAuditLogs patientId={appointment.patient.id} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        {/* Professional Clinical Header */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-y-4">
            <div className="flex-1 min-w-[300px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-primary font-bold text-lg">{clinic?.name || "Clínica"}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground font-medium">Dr(a). {currentUser?.name || appointment.doctor.name}</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {appointment.patient.name}
              </h1>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Idade</span>
                <span className="font-semibold text-slate-900">{patientAge} anos</span>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex flex-col">
                <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Data do Atendimento</span>
                <span className="font-semibold text-slate-900">{format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex flex-col">
                <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Horário</span>
                <span className="font-semibold text-slate-900">{appointment.startTime}</span>
              </div>
            </div>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                Voltar
              </Button>
              <Button 
                size="sm"
                onClick={form.handleSubmit(onSubmit)} 
                // Cor sólida para manter legibilidade ao lado do botão "Voltar"
                className="bg-emerald-600 text-white hover:bg-emerald-700" 
                disabled={!appointment || createRecord.isPending || signMutation.isPending}
              >
                {createRecord.isPending || signMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {signMutation.isSuccess ? "Assinado" : "Finalizar Prontuário"}
              </Button>
            </div>
          </div>
        </div>

        <Form {...form}>
          <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto w-full pb-20">
            
            {/* S - Subjective (Queixa / Anamnese) */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-lg font-bold bg-blue-600">S</Badge>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-blue-600" />
                  Queixa e Anamnese
                </h2>
              </div>
              <Card className="border-none shadow-sm bg-blue-50/30 overflow-hidden">
                <CardContent className="p-8 space-y-6">
                  <FormField
                    control={form.control}
                    name="chiefComplaint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold text-blue-900/70 uppercase tracking-wider">Queixa Principal</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="min-h-[100px] text-lg bg-white border-blue-100 focus-visible:ring-blue-200" placeholder="Relato principal do paciente..." />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="history"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold text-blue-900/70 uppercase tracking-wider">Histórico da Doença Atual (HDA)</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="min-h-[180px] bg-white border-blue-100 focus-visible:ring-blue-200" placeholder="Evolução cronológica e detalhes dos sintomas..." />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </section>

            {/* O - Objective (Sinais Vitais) */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-lg font-bold bg-emerald-600">O</Badge>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-600" />
                  Sinais Vitais e Exame Físico
                </h2>
              </div>
              <Card className="border-none shadow-sm bg-emerald-50/30">
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-widest">Pressão Arterial</span>
                      <Input {...form.register("vitals.bloodPressure")} className="bg-white border-emerald-100 text-lg font-bold text-emerald-900" placeholder="120/80" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-widest">Freq. Cardíaca</span>
                      <Input {...form.register("vitals.heartRate")} className="bg-white border-emerald-100 text-lg font-bold text-emerald-900" placeholder="72 bpm" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-widest">Temperatura</span>
                      <Input {...form.register("vitals.temperature")} className="bg-white border-emerald-100 text-lg font-bold text-emerald-900" placeholder="36.5 °C" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-widest">Peso (kg)</span>
                      <Input {...form.register("vitals.weight")} className="bg-white border-emerald-100 text-lg font-bold text-emerald-900" placeholder="70.5" />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold text-red-900/70 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          Alergias Conhecidas
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""} 
                            className="min-h-[80px] bg-red-50/50 border-red-100 text-red-900 placeholder:text-red-300 focus-visible:ring-red-200" 
                            placeholder="Descreva alergias ou 'Sem alergias conhecidas'..." 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </section>

            {/* A - Assessment (Diagnóstico) */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-lg font-bold bg-amber-600">A</Badge>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-6 h-6 text-amber-600" />
                  Diagnóstico e Avaliação
                </h2>
              </div>
              <Card className="border-none shadow-sm bg-amber-50/30">
                <CardContent className="p-8 space-y-6">
                  <FormField
                    control={form.control}
                    name="diagnosis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold text-amber-900/70 uppercase tracking-wider">Diagnóstico (Hipótese / CID-10)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="text-xl font-bold bg-white border-amber-100 focus-visible:ring-amber-200" placeholder="ex: J00 - Nasofaringite aguda" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold text-amber-900/70 uppercase tracking-wider">Notas de Evolução Clínica</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="min-h-[150px] bg-white border-amber-100 focus-visible:ring-amber-200" placeholder="Avaliação geral do quadro clínico..." />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </section>

            {/* P - Plan (Prescrição / Plano) */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-lg font-bold bg-indigo-600">P</Badge>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="w-6 h-6 text-indigo-600" />
                  Plano Terapêutico e Prescrição
                </h2>
              </div>
              <Card className="border-none shadow-sm bg-indigo-50/30">
                <CardContent className="p-8">
                  <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 shadow-inner mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-indigo-900/70 uppercase tracking-wider">Receituário Eletrônico</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={loadTemplate} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                          <FileText className="w-4 h-4 mr-1" /> Carregar Modelo
                        </Button>
                        {signMutation.isSuccess && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                            <ShieldCheck className="w-3 h-3" /> Assinado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="prescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              value={field.value || ""}
                              className="min-h-[300px] font-mono text-base leading-relaxed border-none focus-visible:ring-0 resize-none p-0" 
                              placeholder="Rx:&#10;&#10;1. Medicamento - Dose - Via - Frequência - Duração" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={handlePrint}>
                      <FileText className="w-4 h-4" />
                      Visualizar e Imprimir Receita
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Audit History (Optional toggle or scroll area) */}
            <Separator className="my-8" />
            <section className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico e Auditoria
              </h2>
              <div className="bg-slate-50 rounded-xl p-6 border">
                <MedicalRecordAuditLogs patientId={appointment.patient.id} />
              </div>
            </section>
          </div>
        </Form>
      </div>
    </LayoutShell>
  );
}