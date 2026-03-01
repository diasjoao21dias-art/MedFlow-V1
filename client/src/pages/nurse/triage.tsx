import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import LayoutShell from "@/components/layout-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function NurseTriagePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/nurse/triage/:id");
  const appointmentId = parseInt(params?.id || "0");

  const { data: appointment, isLoading } = useQuery({
    queryKey: [api.appointments.list.path, appointmentId],
    queryFn: async () => {
      const res = await fetch(api.appointments.list.path);
      const list = await res.json();
      return list.find((a: any) => a.id === appointmentId);
    },
    enabled: !!appointmentId,
  });

  const triageForm = useForm({
    defaultValues: {
      bloodPressure: "",
      temperature: "",
      weight: "",
      height: "",
      heartRate: "",
      respiratoryRate: "",
      oxygenSaturation: "",
      notes: "",
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
        status: "presente",
        triageData: data
      });
      return res.json();
    },
    onSuccess: () => {
      // Garante que a fila da enfermagem (que usa queryKey com filtros) seja atualizada imediatamente
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path], exact: false });
      queryClient.refetchQueries({ queryKey: [api.appointments.list.path], exact: false });
      toast({ title: "Triagem Concluída", description: "Os dados foram enviados para o médico." });
      setLocation("/nurse/dashboard");
    }
  });

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (!appointment) return <div>Agendamento não encontrado</div>;

  // Evita re-triagem: se já foi concluída, não permitir abrir novamente pela enfermagem
  if (appointment.triageDone) {
    return (
      <LayoutShell>
        <div className="max-w-2xl mx-auto mt-16">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Triagem já finalizada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Este paciente já foi triado. Agora ele aguarda o atendimento médico.
              </p>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setLocation("/nurse/dashboard")}>
                  Voltar para o Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display">Realizar Triagem</h1>
            <p className="text-muted-foreground">Paciente: {appointment.patient.name}</p>
          </div>
        </div>

        <Form {...triageForm}>
          <form onSubmit={triageForm.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle>Sinais Vitais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    control={triageForm.control}
                    name="bloodPressure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pressão Arterial (mmHg)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 120/80" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={triageForm.control}
                    name="temperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperatura (°C)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 36.5" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={triageForm.control}
                    name="heartRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Freq. Cardíaca (bpm)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 80" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={triageForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (kg)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 75" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={triageForm.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura (cm)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 175" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={triageForm.control}
                    name="oxygenSaturation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saturação O2 (%)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 98" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="mt-6">
                  <FormField
                    control={triageForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações da Enfermagem</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Relate queixas, alergias ou observações relevantes..." {...field} className="min-h-[100px]" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Finalizar Triagem
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </LayoutShell>
  );
}
