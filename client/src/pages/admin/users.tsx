import LayoutShell from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@shared/routes";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Shield, User as UserIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  UserMinus, 
  UserCheck,
  AlertTriangle 
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  operator: "Recepção",
  doctor: "Médico",
  nurse: "Enfermagem",
};

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const userFormSchema = insertUserSchema.extend({
  name: z.string().min(1, "Nome é obrigatório"),
  username: z.string()
    .min(3, "Usuário deve ter no mínimo 3 caracteres")
    .regex(/^\S+$/, "Usuário não pode conter espaços")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
  role: z.string().min(1, "Função é obrigatória"),
  professionalCouncilType: z.string().optional().nullable(),
  professionalCouncilNumber: z.string().optional().nullable(),
  professionalCouncilState: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.role === "doctor" || data.role === "nurse") {
    if (!data.professionalCouncilNumber || data.professionalCouncilNumber.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Número do conselho deve ter no mínimo 3 caracteres",
        path: ["professionalCouncilNumber"],
      });
    }
    if (!data.professionalCouncilState || data.professionalCouncilState.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "UF do conselho é obrigatória (2 letras)",
        path: ["professionalCouncilState"],
      });
    }
  }
});

export default function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users", { includeInactive: showInactive }],
    enabled: !!user && (user.role === "admin" || user.role === "manager"),
    queryFn: async () => {
      const res = await fetch(`/api/users${showInactive ? "?includeInactive=true" : ""}`);
      if (!res.ok) throw new Error("Falha ao carregar usuários");
      return res.json();
    }
  });

  const form = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      role: "operator",
      specialty: "",
      professionalCouncilType: "",
      professionalCouncilNumber: "",
      professionalCouncilState: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.password || data.password.length < 6) {
        throw new Error("Senha obrigatória (mín. 6 caracteres) para novos usuários");
      }
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      try {
        setIsDialogOpen(false);
        setEditingUser(null);
        form.reset();

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["doctors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

        toast({ title: "Sucesso", description: "Membro da equipe criado com sucesso." });
      } catch (err) {
        console.error("Erro no onSuccess do createMutation:", err);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao criar usuário", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; values: any }) => {
      // Remove empty password on update to not overwrite
      const values = { ...data.values };
      if (!values.password) delete values.password;
      
      const res = await apiRequest("PUT", `/api/users/${data.id}`, values);
      return res.json();
    },
    onSuccess: () => {
      try {
        setIsDialogOpen(false);
        setEditingUser(null);
        form.reset();

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["doctors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

        toast({ title: "Sucesso", description: "Membro da equipe atualizado com sucesso." });
      } catch (err) {
        console.error("Erro no onSuccess do updateMutation:", err);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao atualizar usuário", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      try {
        setIsDialogOpen(false);
        setEditingUser(null);
        form.reset();

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["doctors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

        toast({ title: "Sucesso", description: "Status do membro alterado com sucesso." });
      } catch (err) {
        console.error("Erro no onSuccess do deleteMutation:", err);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao alterar status do usuário", 
        variant: "destructive" 
      });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}/hard`);
      if (res.status === 204) return null;
      return res.json();
    },
    onSuccess: () => {
      try {
        setHardDeleteId(null);
        setConfirmText("");

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["doctors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });

        toast({ title: "Sucesso", description: "Membro da equipe excluído permanentemente." });
      } catch (err) {
        console.error("Erro no onSuccess do hardDeleteMutation:", err);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao excluir usuário", 
        variant: "destructive" 
      });
    },
  });

  const [hardDeleteId, setHardDeleteId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const onSubmit = (values: any) => {
    const payload = { ...values };
    
    // Ensure council fields are not sent for non-medical roles to avoid backend validation error
    if (payload.role !== "doctor" && payload.role !== "nurse") {
      payload.professionalCouncilType = null;
      payload.professionalCouncilNumber = null;
      payload.professionalCouncilState = null;
    } else {
      // Set correct council type based on role
      payload.professionalCouncilType = payload.role === "doctor" ? "CRM" : "COREN";
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, values: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      password: "", 
      name: user.name,
      role: user.role as any,
      specialty: user.specialty || "",
      professionalCouncilType: user.professionalCouncilType || "",
      professionalCouncilNumber: user.professionalCouncilNumber || "",
      professionalCouncilState: user.professionalCouncilState || "",
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const hasDoctors = users?.some(u => u.role === 'doctor');

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <PageHeader title="Usuários" description="Gerencie acessos e permissões" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch 
                id="show-inactive" 
                checked={showInactive} 
                onCheckedChange={setShowInactive} 
              />
              <Label htmlFor="show-inactive" className="text-sm font-medium text-slate-600 cursor-pointer">
                Mostrar inativos
              </Label>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingUser(null); form.reset(); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Novo Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar Membro" : "Novo Membro"}</DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Atualize as informações e permissões do membro da equipe."
                    : "Cadastre um novo membro e defina seu papel no sistema."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Dr. Silva ou Maria Souza" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled={!!editingUser} 
                              readOnly={!!editingUser}
                              placeholder="sem_espacos" 
                              onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/\s/g, ''))}
                            />
                          </FormControl>
                          {editingUser && (
                            <p className="text-[0.8rem] text-slate-600">
                              O usuário não pode ser alterado após criação.
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{editingUser ? "Nova Senha (opcional)" : "Senha"}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} placeholder="Mín. 6 caracteres" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Novos campos para correção de erro humano */}
                  {editingUser && (form.watch("role") === "doctor" || form.watch("role") === "nurse") && (
                    <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">Dados Profissionais</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="professionalCouncilNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Número do Registro</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} className="h-8 text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="professionalCouncilState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">UF</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="UF" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BRAZIL_STATES.map((uf) => (
                                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {form.watch("role") === "doctor" && (
                        <FormField
                          control={form.control}
                          name="specialty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Especialidade</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} className="h-8 text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Função</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (val !== "doctor" && val !== "nurse") {
                              form.setValue("professionalCouncilType", "");
                              form.setValue("professionalCouncilNumber", "");
                              form.setValue("professionalCouncilState", "");
                              form.setValue("specialty", "");
                            } else {
                              form.setValue("professionalCouncilType", val === "doctor" ? "CRM" : "COREN");
                            }
                          }} 
                          defaultValue={field.value} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma função" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="operator">Recepção</SelectItem>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Equipe Assistencial</SelectLabel>
                              <SelectItem value="nurse">Enfermagem</SelectItem>
                              <SelectItem value="doctor">Médico</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("role") === "doctor" && (
                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Especialidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Cardiologia" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {(form.watch("role") === "doctor" || form.watch("role") === "nurse") && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormItem>
                          <FormLabel>Conselho</FormLabel>
                          <FormControl>
                            <Input 
                              value={form.watch("role") === "doctor" ? "CRM" : "COREN"} 
                              disabled 
                              className="bg-slate-50"
                            />
                          </FormControl>
                        </FormItem>
                        <FormField
                          control={form.control}
                          name="professionalCouncilState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UF do Conselho</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="UF" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BRAZIL_STATES.map((uf) => (
                                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="professionalCouncilNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número do Conselho</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: 123456" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createMutation.isPending || updateMutation.isPending || !form.formState.isValid}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingUser ? "Salvar Alterações" : "Criar Membro"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Membros da Equipe</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Função</TableHead>
                  {hasDoctors && <TableHead>Especialidade</TableHead>}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                        {!user.isActive && (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {hasDoctors && (
                      <TableCell>{user.role === 'doctor' ? (user.specialty || "Clínico Geral") : ""}</TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-8 w-8 p-0 ${user.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                          onClick={() => deleteMutation.mutate(user.id)}
                          title={user.isActive ? "Desativar" : "Reativar"}
                          disabled={deleteMutation.isPending}
                        >
                          {user.isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setHardDeleteId(user.id)}
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={hardDeleteId !== null} onOpenChange={(open) => { if(!open) setHardDeleteId(null); setConfirmText(""); }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Excluir Permanentemente
              </DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário e todos os seus dados vinculados.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm font-medium">
                Digite <span className="font-bold">EXCLUIR</span> para confirmar:
              </p>
              <Input 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="uppercase"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHardDeleteId(null)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                disabled={confirmText !== "EXCLUIR" || hardDeleteMutation.isPending}
                onClick={() => hardDeleteId && hardDeleteMutation.mutate(hardDeleteId)}
              >
                {hardDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Excluir Definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </LayoutShell>
  );
}
