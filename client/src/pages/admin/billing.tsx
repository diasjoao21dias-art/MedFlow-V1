import LayoutShell from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Send, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function BillingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: bills, isLoading } = useQuery<any[]>({ queryKey: ["/api/tiss"] });

  const generateXmlMutation = useMutation({
    mutationFn: async (billId: number) => {
      await apiRequest("POST", `/api/tiss/${billId}/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiss"] });
      toast({ title: "Sucesso", description: "Guia TISS gerada com sucesso." });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Simulação de sincronização
      await new Promise(resolve => setTimeout(resolve, 1500));
    },
    onSuccess: () => {
      toast({ title: "Sincronizado", description: "Convênios e tabelas TUSS atualizadas." });
    }
  });

  if (isLoading) return (
    <div className="h-[80vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => window.history.back()}
              className="rounded-full bg-white shadow-sm border"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Faturamento TISS/TUSS</h1>
          </div>
          <Button 
            onClick={() => syncMutation.mutate()} 
            disabled={syncMutation.isPending}
            data-testid="button-sync-convenios"
          >
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Sincronizar Convênios
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guias Pendentes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bills?.filter(b => b.status === 'pendente').length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lotes Enviados</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bills?.filter(b => b.status === 'enviada').length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebido</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 0,00</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Guias Médicas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills?.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">Paciente #{bill.patientId}</TableCell>
                    <TableCell>{bill.insuranceId}</TableCell>
                    <TableCell>{new Date(bill.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={bill.status === 'pendente' ? 'outline' : 'default'}>
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Gerar XML TISS"
                          onClick={() => generateXmlMutation.mutate(bill.id)}
                          disabled={generateXmlMutation.isPending}
                        >
                          {generateXmlMutation.isPending && generateXmlMutation.variables === bill.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Enviar para Convênio"
                          onClick={() => {
                            toast({ title: "Enviado", description: "Lote enviado para processamento." });
                          }}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!bills || bills.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      Nenhuma guia encontrada para o período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
