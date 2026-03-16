import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Stethoscope, Activity, ShieldCheck, User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export default function LoginPage() {
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === "admin") setLocation("/admin/dashboard");
      else if (user.role === "doctor") setLocation("/doctor/dashboard");
      else if (user.role === "nurse") setLocation("/nurse/dashboard");
      else setLocation("/reception/dashboard");
    }
  }, [user, setLocation]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login(values);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0 }}
      className="flex bg-white overflow-hidden"
    >
      {/* ── Coluna esquerda (hero) ── */}
      <div className="relative hidden lg:flex flex-col justify-center flex-1 overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-slate-900 z-10" />
        <div
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay opacity-40 scale-105"
          aria-hidden="true"
        />
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 opacity-20">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/30 blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-20 w-full max-w-lg mx-auto px-10 xl:px-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-5">
            <Activity className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">Plataforma Médica Inteligente</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
              <Stethoscope className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl xl:text-4xl font-display font-bold tracking-tight leading-none">MediFlow</h1>
              <p className="text-blue-200 font-medium text-xs mt-0.5">Gestão Clínica 360°</p>
            </div>
          </div>

          <p className="text-base xl:text-lg font-medium text-blue-50 leading-relaxed mb-6 opacity-90">
            Otimize sua prática médica com inteligência e segurança em cada atendimento.
          </p>

          <div className="space-y-4">
            {[
              { icon: Activity, label: "Agenda & Fluxo de Pacientes", desc: "Controle total de horários e salas" },
              { icon: ShieldCheck, label: "Prontuário Eletrônico Seguro", desc: "Dados protegidos com criptografia" },
              { icon: Activity, label: "Faturamento & Estoque", desc: "Gestão financeira integrada" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 group cursor-default">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:border-primary">
                  <item.icon className="w-4 h-4 text-blue-200" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white leading-none">{item.label}</p>
                  <p className="text-[11px] text-blue-200/70 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Coluna direita (formulário) ── */}
      <div
        className="relative flex flex-col justify-center bg-white overflow-hidden shrink-0"
        style={{ width: "100%", maxWidth: "480px" }}
      >
        {/* Decorações de fundo */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-50 rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative w-full px-8 sm:px-12 flex flex-col gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/25">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-display font-bold text-slate-800 tracking-tight">MediFlow</span>
          </div>

          {/* Título */}
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight leading-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-slate-500 mt-1 text-sm">Insira suas credenciais para acessar o painel.</p>
          </div>

          {/* Formulário */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="gap-1.5">
                    <FormLabel className="text-slate-700 font-semibold text-sm">Usuário</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <Input
                          placeholder="nome.sobrenome"
                          data-testid="input-username"
                          {...field}
                          className="h-10 pl-9 pr-4 bg-slate-50 border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/30 focus-visible:border-primary/60 focus-visible:bg-white transition-all"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="gap-1.5">
                    <FormLabel className="text-slate-700 font-semibold text-sm">Senha</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                          <Lock className="w-4 h-4" />
                        </div>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          data-testid="input-password"
                          {...field}
                          className="h-10 pl-9 pr-10 bg-slate-50 border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/30 focus-visible:border-primary/60 focus-visible:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                data-testid="button-login"
                className="w-full h-10 text-sm font-bold rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Painel</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Sinais de confiança */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium">Conexão segura</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium">Dados criptografados</span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-slate-400">
          © 2026 MediFlow Solutions. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
