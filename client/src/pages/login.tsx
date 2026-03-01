import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Stethoscope, Activity, ShieldCheck, User, Lock, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export default function LoginPage() {
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') setLocation('/admin/dashboard');
      else if (user.role === 'doctor') setLocation('/doctor/dashboard');
      else if (user.role === 'nurse') setLocation('/nurse/dashboard');
      else setLocation('/reception/dashboard');
    }
  }, [user, setLocation]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login(values);
  }

  const fillCredentials = (role: string) => {
    if (role === 'nurse') {
      form.setValue("username", "clara.santos");
    } else {
      form.setValue("username", role);
    }
    form.setValue("password", "password123");
  };

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1fr_480px] bg-white overflow-hidden">
      {/* Left Side - Hero */}
      <div className="relative flex flex-col justify-center items-center p-8 lg:p-16 text-white overflow-hidden bg-slate-900 order-2 lg:order-1 flex-1 lg:flex-none">
        {/* Background Gradient & Image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-slate-900 z-10" />
        <div 
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay opacity-40 scale-105" 
          aria-hidden="true"
        />
        
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-10 opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/30 blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-20 max-w-lg w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Activity className="w-4 h-4 text-blue-300" />
            <span className="text-xs font-semibold tracking-wider uppercase">Plataforma Médica Inteligente</span>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
              <Stethoscope className="w-9 h-9 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-display font-bold tracking-tight">MediFlow</h1>
              <p className="text-blue-200 font-medium">Gestão Clínica 360°</p>
            </div>
          </div>

          <h2 className="text-xl lg:text-2xl font-medium text-blue-50 leading-relaxed mb-10 opacity-90">
            Otimize sua prática médica com inteligência e segurança em cada atendimento.
          </h2>
          
          <div className="space-y-6">
            {[
              { icon: Activity, label: "Agenda & Fluxo de Pacientes", desc: "Controle total de horários e salas" },
              { icon: ShieldCheck, label: "Prontuário Eletrônico Seguro", desc: "Dados protegidos com criptografia" },
              { icon: Activity, label: "Faturamento & Estoque", desc: "Gestão financeira integrada" }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 group cursor-default">
                <div className="mt-1 w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:border-primary">
                  <item.icon className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{item.label}</h3>
                  <p className="text-sm text-blue-200/70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col justify-center bg-slate-50/50 p-6 sm:p-12 lg:p-16 order-1 lg:order-2 z-20 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Bem-vindo</h2>
            <p className="text-slate-500 font-medium">Acesse sua conta para continuar</p>
          </div>

          <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-[24px] bg-white overflow-hidden">
            <CardContent className="p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-slate-700 font-semibold text-sm ml-1">Usuário</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors text-slate-400 group-focus-within:text-primary">
                              <User className="w-5 h-5" />
                            </div>
                            <Input 
                              placeholder="nome.sobrenome" 
                              {...field} 
                              className="h-12 pl-12 bg-slate-50 border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all" 
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
                      <FormItem className="space-y-2">
                        <FormLabel className="text-slate-700 font-semibold text-sm ml-1">Senha</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors text-slate-400 group-focus-within:text-primary">
                              <Lock className="w-5 h-5" />
                            </div>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field} 
                              className="h-12 pl-12 bg-slate-50 border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group" 
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Acessar Painel</span>
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <div className="h-px bg-slate-200 flex-1" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Acesso Rápido</p>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'admin', label: 'Admin', color: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { id: 'doctor', label: 'Médico', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
                { id: 'operator', label: 'Recepção', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
                { id: 'nurse', label: 'Enfermagem', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' }
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => fillCredentials(role.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-slate-200 text-center active:scale-[0.95]",
                    role.color
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-auto pt-8 text-center">
          <p className="text-xs text-slate-400 font-medium italic">
            © 2026 MediFlow Solutions. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

