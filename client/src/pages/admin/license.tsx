import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, KeyRound, ExternalLink, AlertTriangle } from "lucide-react";

type LicenseStatus = {
  active: boolean;
  expiresAt: number | null;
  issuedAt: number | null;
  daysRemaining: number | null;
  keyHint: string | null;
};

function formatDateTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

export default function LicensePage() {
  const { toast } = useToast();
  const [key, setKey] = React.useState("");

  const { data, isLoading } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/license/activate", { key });
      return (await res.json()) as { daysRemaining: number };
    },
    onSuccess: (payload) => {
      toast({
        title: "Licença ativada",
        description: `Tudo certo! Dias restantes: ${payload.daysRemaining}`,
      });
      setKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "Erro ao ativar licença");
      toast({
        title: "Não foi possível ativar",
        description: msg.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const status = data;
  const days = status?.daysRemaining ?? null;
  const progress = React.useMemo(() => {
    // Simple visual gauge: cap at 30 days
    if (days == null) return 0;
    return Math.max(0, Math.min(100, Math.round((days / 30) * 100)));
  }, [days]);

  const renewUrl = React.useMemo(() => {
    const text = encodeURIComponent(
      "Olá! Quero renovar a licença do MedFlow. Pode me ajudar?"
    );
    return `https://wa.me/553498250458?text=${text}`;
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Licença</h1>
            <p className="text-muted-foreground mt-1">Gerencie a chave de ativação e acompanhe o tempo restante.</p>
          </div>

          <div className="flex items-center gap-2">
            {status?.active ? (
              <Badge className="gap-2" variant="default">
                <CheckCircle2 className="w-4 h-4" /> Ativa
              </Badge>
            ) : (
              <Badge className="gap-2" variant="destructive">
                <AlertTriangle className="w-4 h-4" /> Inativa
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Ativar / Trocar licença
            </CardTitle>
            <CardDescription>
              Cole a sua chave de licença para ativar ou renovar o acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Cole a chave aqui"
                className="font-mono"
                type="password"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => activateMutation.mutate()}
                  disabled={!key.trim() || activateMutation.isPending}
                  className="sm:w-auto"
                >
                  {activateMutation.isPending ? "Ativando…" : "Ativar licença"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(renewUrl, "_blank")}
                  className="sm:w-auto"
                >
                  Renovar pelo WhatsApp <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>

              <Separator className="my-2" />

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Tempo restante</div>
                      <div className="text-xl font-semibold">
                        {isLoading ? "…" : days == null ? "—" : `${days} dia(s)`}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[220px] flex-1">
                    <Progress value={progress} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>0</span>
                      <span>30d+</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-muted-foreground">Expira em</div>
                    <div className="font-medium mt-1">
                      {status?.expiresAt ? formatDateTime(status.expiresAt) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-muted-foreground">Emitida em</div>
                    <div className="font-medium mt-1">
                      {status?.issuedAt ? formatDateTime(status.issuedAt) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-muted-foreground">Chave ativa (hash)</div>
                    <div className="font-mono text-xs mt-2 break-all">
                      {status?.keyHint ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
