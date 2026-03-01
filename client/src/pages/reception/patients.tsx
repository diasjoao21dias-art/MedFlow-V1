import LayoutShell from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments } from "@/hooks/use-appointments";
import {
  PatientsQuery,
  useArchivePatient,
  useCreatePatient,
  useHardDeletePatient,
  usePatients,
  useUpdatePatient,
} from "@/hooks/use-patients";
import { useToast } from "@/hooks/use-toast";
import { insertPatientSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Download,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Phone,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  Pencil,
  Clipboard,
  User,
  Mail,
  MapPin,
} from "lucide-react";

type PatientForm = z.infer<typeof insertPatientSchema>;

function formatCpf(v?: string | null) {
  return (v || "").trim();
}
function formatPhone(v?: string | null) {
  return (v || "").trim();
}

function calcAge(birthDate: string) {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function PatientsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const canWrite = user?.role === "admin" || user?.role === "operator";
  const canHardDelete = user?.role === "admin";

  // UI state
  const [viewMode, setViewMode] = useState<"table" | "cards">(
    (localStorage.getItem("patients:viewMode") as any) || "table",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<PatientsQuery["sortBy"]>("name");
  const [sortDir, setSortDir] = useState<PatientsQuery["sortDir"]>("asc");

  // Filters
  const [gender, setGender] = useState<string | undefined>(undefined);
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [hasToday, setHasToday] = useState<boolean>(false);
  const [missingPhone, setMissingPhone] = useState<boolean>(false);
  const [missingEmail, setMissingEmail] = useState<boolean>(false);
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [onlyArchived, setOnlyArchived] = useState<boolean>(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState<number | null>(null);
  const { data: appointmentsForDrawer } = useAppointments({ patientId: drawerPatientId || undefined });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    localStorage.setItem("patients:viewMode", viewMode);
  }, [viewMode]);

  // open create dialog via ?new=1
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setCreateOpen(true);
      params.delete("new");
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const queryParams: PatientsQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize,
      sortBy,
      sortDir,
      gender,
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      hasAppointmentToday: hasToday ? true : undefined,
      missingPhone: missingPhone ? true : undefined,
      missingEmail: missingEmail ? true : undefined,
      includeArchived: includeArchived ? true : undefined,
      onlyArchived: onlyArchived ? true : undefined,
    }),
    [
      search,
      page,
      pageSize,
      sortBy,
      sortDir,
      gender,
      ageMin,
      ageMax,
      hasToday,
      missingPhone,
      missingEmail,
      includeArchived,
      onlyArchived,
    ],
  );

  const { data, isLoading } = usePatients(queryParams);
  const patients = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize || pageSize)));

  // Mutations
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const archivePatient = useArchivePatient();
  const hardDelete = useHardDeletePatient();

  const createForm = useForm<PatientForm>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: "",
      cpf: "",
      birthDate: "",
      phone: "",
      email: "",
      gender: "",
      address: "",
      clinicId: 1,
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);
  const editForm = useForm<PatientForm>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: "",
      cpf: "",
      birthDate: "",
      phone: "",
      email: "",
      gender: "",
      address: "",
      clinicId: 1,
    },
  });

  useEffect(() => {
    if (!editOpen || !editPatientId) return;
    const p = patients.find(x => x.id === editPatientId);
    if (!p) return;
    editForm.reset({
      name: p.name,
      cpf: p.cpf || "",
      birthDate: p.birthDate,
      phone: p.phone || "",
      email: p.email || "",
      gender: p.gender || "",
      address: p.address || "",
      clinicId: p.clinicId,
    });
  }, [editOpen, editPatientId, patients, editForm]);

  const openDrawer = (id: number) => {
    setDrawerPatientId(id);
    setDrawerOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(patients.map(p => p.id)));
  };

  const doArchive = async (id: number, archived: boolean) => {
    await archivePatient.mutateAsync({ id, archived });
  };

  const doBulkArchive = async (archived: boolean) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await Promise.all(ids.map(id => doArchive(id, archived)));
    setSelectedIds(new Set());
  };

  const doHardDelete = async (id: number) => {
    await hardDelete.mutateAsync({ id });
    if (drawerPatientId === id) setDrawerOpen(false);
  };

  const copyContact = async (p: any) => {
    const txt = [p.name, p.cpf, p.phone, p.email].filter(Boolean).join(" | ");
    await navigator.clipboard.writeText(txt);
    toast({ title: "Copiado", description: "Contato/CPF copiado para a área de transferência." });
  };

  const exportCsv = () => {
    const qs = new URLSearchParams();
    if (queryParams.search) qs.set("search", queryParams.search);
    if (queryParams.gender) qs.set("gender", queryParams.gender);
    if (queryParams.ageMin !== undefined) qs.set("ageMin", String(queryParams.ageMin));
    if (queryParams.ageMax !== undefined) qs.set("ageMax", String(queryParams.ageMax));
    if (queryParams.hasAppointmentToday !== undefined) qs.set("hasAppointmentToday", String(queryParams.hasAppointmentToday));
    if (queryParams.missingPhone !== undefined) qs.set("missingPhone", String(queryParams.missingPhone));
    if (queryParams.missingEmail !== undefined) qs.set("missingEmail", String(queryParams.missingEmail));
    if (queryParams.includeArchived !== undefined) qs.set("includeArchived", String(queryParams.includeArchived));
    if (queryParams.onlyArchived !== undefined) qs.set("onlyArchived", String(queryParams.onlyArchived));
    window.open(`/api/patients/export?${qs.toString()}`, "_blank");
  };

  const nextAppointmentLabel = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, "dd/MM HH:mm", { locale: ptBR });
  };

  const drawerPatient = useMemo(() => patients.find(p => p.id === drawerPatientId) || null, [patients, drawerPatientId]);

  return (
    <LayoutShell>
      <div className="space-y-6">
        <PageHeader
          title="Pacientes"
          description="Cadastro, filtros e histórico do paciente"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              {canWrite && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Paciente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Registrar novo paciente</DialogTitle>
                      <DialogDescription>Preencha os dados essenciais. Você pode completar depois.</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                      <form
                        onSubmit={createForm.handleSubmit(async (values) => {
                          await createPatient.mutateAsync(values);
                          setCreateOpen(false);
                          createForm.reset();
                        })}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={createForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Nome completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Maria da Silva" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="cpf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CPF</FormLabel>
                                <FormControl>
                                  <Input placeholder="000.000.000-00" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="birthDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data de nascimento</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <Input placeholder="(00) 00000-0000" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="email@exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="gender"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Gênero</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Masculino">Masculino</SelectItem>
                                    <SelectItem value="Feminino">Feminino</SelectItem>
                                    <SelectItem value="Outro">Outro</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Endereço</FormLabel>
                                <FormControl>
                                  <Input placeholder="Rua, número, bairro..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={createPatient.isPending}>
                            {createPatient.isPending ? "Salvando..." : "Criar registro"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 flex items-center gap-2">
                <Input
                  placeholder="Buscar por nome, CPF, telefone ou email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      Filtros
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80" align="end">
                    <DropdownMenuLabel>Filtros avançados</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-3 space-y-3">
                      <div className="space-y-2">
                        <Label>Gênero</Label>
                        <Select value={gender || ""} onValueChange={(v) => setGender(v || undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todos</SelectItem>
                            <SelectItem value="Masculino">Masculino</SelectItem>
                            <SelectItem value="Feminino">Feminino</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Idade (mín)</Label>
                          <Input value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="ex: 18" />
                        </div>
                        <div className="space-y-2">
                          <Label>Idade (máx)</Label>
                          <Input value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="ex: 65" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Com consulta hoje</Label>
                        <Checkbox checked={hasToday} onCheckedChange={(v) => setHasToday(!!v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Sem telefone</Label>
                        <Checkbox checked={missingPhone} onCheckedChange={(v) => setMissingPhone(!!v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Sem email</Label>
                        <Checkbox checked={missingEmail} onCheckedChange={(v) => setMissingEmail(!!v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Incluir arquivados</Label>
                        <Checkbox checked={includeArchived} onCheckedChange={(v) => setIncludeArchived(!!v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Somente arquivados</Label>
                        <Checkbox checked={onlyArchived} onCheckedChange={(v) => setOnlyArchived(!!v)} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setGender(undefined);
                            setAgeMin("");
                            setAgeMax("");
                            setHasToday(false);
                            setMissingPhone(false);
                            setMissingEmail(false);
                            setIncludeArchived(false);
                            setOnlyArchived(false);
                            setPage(1);
                          }}
                        >
                          Limpar
                        </Button>
                        <Button onClick={() => setPage(1)}>Aplicar</Button>
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortBy || "name"} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Ordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome</SelectItem>
                    <SelectItem value="createdAt">Mais recentes</SelectItem>
                    <SelectItem value="birthDate">Nascimento</SelectItem>
                    <SelectItem value="nextAppointmentAt">Próxima consulta</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortDir || "asc"} onValueChange={(v: any) => setSortDir(v)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Asc</SelectItem>
                    <SelectItem value="desc">Desc</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
                  title="Alternar visualização"
                >
                  {viewMode === "table" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2">
                <div className="text-sm">
                  <strong>{selectedIds.size}</strong> selecionado(s)
                </div>
                <div className="flex items-center gap-2">
                  {canWrite && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => doBulkArchive(true)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Arquivar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => doBulkArchive(false)}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // export selected locally via clipboard as quick win
                      const rows = patients.filter(p => selectedIds.has(p.id));
                      const lines = rows.map(p => `${p.name},${p.cpf || ""},${p.phone || ""},${p.email || ""}`);
                      navigator.clipboard.writeText(lines.join("\n"));
                      toast({ title: "Copiado", description: "CSV dos selecionados copiado." });
                    }}
                  >
                    <Clipboard className="w-4 h-4 mr-2" />
                    Copiar CSV
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Limpar
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {viewMode === "table" ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]">
                        <Checkbox
                          checked={patients.length > 0 && selectedIds.size === patients.length}
                          onCheckedChange={(v) => selectAllOnPage(!!v)}
                        />
                      </TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : patients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          Nenhum paciente encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      patients.map((p: any) => (
                        <TableRow key={p.id} className="cursor-pointer" onClick={() => openDrawer(p.id)}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                {(p.name || "?").charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium leading-none">{p.name}</div>
                                <div className="text-xs text-muted-foreground">CPF: {formatCpf(p.cpf) || "—"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatPhone(p.phone) || "—"}</div>
                            <div className="text-xs text-muted-foreground">{p.email || "—"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{format(new Date(p.birthDate), "dd/MM/yyyy")}</div>
                            <div className="text-xs text-muted-foreground">{calcAge(p.birthDate) ?? "—"} anos</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.isArchived && <Badge variant="secondary">Arquivado</Badge>}
                              {p.hasAppointmentToday && <Badge>Consulta hoje</Badge>}
                              {!p.phone && <Badge variant="outline">Sem telefone</Badge>}
                              {!p.email && <Badge variant="outline">Sem email</Badge>}
                              {p.nextAppointmentAt && <Badge variant="outline">Próx: {nextAppointmentLabel(p.nextAppointmentAt)}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <ActionsMenu
                              patient={p}
                              canWrite={canWrite}
                              canHardDelete={canHardDelete}
                              onView={() => openDrawer(p.id)}
                              onCopy={() => copyContact(p)}
                              onSchedule={() => (window.location.href = `/reception/schedule?patientId=${p.id}`)}
                              onEdit={() => {
                                setEditPatientId(p.id);
                                setEditOpen(true);
                              }}
                              onArchive={() => doArchive(p.id, true)}
                              onRestore={() => doArchive(p.id, false)}
                              onHardDelete={() => doHardDelete(p.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <div className="col-span-full py-10 text-center text-muted-foreground">Carregando...</div>
                ) : patients.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-muted-foreground">Nenhum paciente encontrado.</div>
                ) : (
                  patients.map((p: any) => (
                    <Card key={p.id} className="hover:shadow-md transition cursor-pointer" onClick={() => openDrawer(p.id)}>
                      <CardContent className="pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                              {(p.name || "?").charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium leading-none">{p.name}</div>
                              <div className="text-xs text-muted-foreground">CPF: {formatCpf(p.cpf) || "—"}</div>
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <ActionsMenu
                              patient={p}
                              canWrite={canWrite}
                              canHardDelete={canHardDelete}
                              onView={() => openDrawer(p.id)}
                              onCopy={() => copyContact(p)}
                              onSchedule={() => (window.location.href = `/reception/schedule?patientId=${p.id}`)}
                              onEdit={() => {
                                setEditPatientId(p.id);
                                setEditOpen(true);
                              }}
                              onArchive={() => doArchive(p.id, true)}
                              onRestore={() => doArchive(p.id, false)}
                              onHardDelete={() => doHardDelete(p.id)}
                            />
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{formatPhone(p.phone) || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{p.email || "—"}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {p.isArchived && <Badge variant="secondary">Arquivado</Badge>}
                          {p.hasAppointmentToday && <Badge>Consulta hoje</Badge>}
                          {!p.phone && <Badge variant="outline">Sem telefone</Badge>}
                          {!p.email && <Badge variant="outline">Sem email</Badge>}
                          {p.nextAppointmentAt && <Badge variant="outline">Próx: {nextAppointmentLabel(p.nextAppointmentAt)}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Pagination */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {total > 0 ? (
                  <>
                    Mostrando <strong>{(page - 1) * pageSize + 1}</strong>–
                    <strong>{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong>
                  </>
                ) : (
                  <>0 resultados</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / pág</SelectItem>
                    <SelectItem value="20">20 / pág</SelectItem>
                    <SelectItem value="50">50 / pág</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <div className="text-sm">{page} / {totalPages}</div>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit dialog */}
        {canWrite && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar paciente</DialogTitle>
                <DialogDescription>Atualize as informações cadastrais.</DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                <form
                  onSubmit={editForm.handleSubmit(async (values) => {
                    if (!editPatientId) return;
                    await updatePatient.mutateAsync({ id: editPatientId, patient: values });
                    setEditOpen(false);
                    toast({ title: "Sucesso", description: "Paciente atualizado." });
                  })}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Nome completo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de nascimento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gênero</FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Masculino">Masculino</SelectItem>
                              <SelectItem value="Feminino">Feminino</SelectItem>
                              <SelectItem value="Outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={updatePatient.isPending}>
                      {updatePatient.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        {/* Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {drawerPatient?.name || "Paciente"}
              </SheetTitle>
              <SheetDescription>
                CPF: {formatCpf(drawerPatient?.cpf) || "—"} • Idade: {drawerPatient?.birthDate ? (calcAge(drawerPatient.birthDate) ?? "—") : "—"}
              </SheetDescription>
            </SheetHeader>

            {drawerPatient ? (
              <div className="mt-6 space-y-4">
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {drawerPatient.isArchived && <Badge variant="secondary">Arquivado</Badge>}
                      {(drawerPatient as any).hasAppointmentToday && <Badge>Consulta hoje</Badge>}
                      {!drawerPatient.phone && <Badge variant="outline">Sem telefone</Badge>}
                      {!drawerPatient.email && <Badge variant="outline">Sem email</Badge>}
                      {(drawerPatient as any).nextAppointmentAt && (
                        <Badge variant="outline">Próx: {nextAppointmentLabel((drawerPatient as any).nextAppointmentAt)}</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{formatPhone(drawerPatient.phone) || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{drawerPatient.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{drawerPatient.address || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Nascimento: {format(new Date(drawerPatient.birthDate), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" onClick={() => (window.location.href = `/reception/schedule?patientId=${drawerPatient.id}`)}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Agendar
                      </Button>
                      <Button variant="outline" onClick={() => copyContact(drawerPatient)}>
                        <Clipboard className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                      {canWrite && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditPatientId(drawerPatient.id);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Consultas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {appointmentsForDrawer && appointmentsForDrawer.length > 0 ? (
                      <div className="space-y-2">
                        {appointmentsForDrawer
                          .slice()
                          .sort((a: any, b: any) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
                          .slice(0, 8)
                          .map((apt: any) => (
                            <div key={apt.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                              <div>
                                <div className="font-medium">{format(new Date(apt.date), "dd/MM/yyyy")} • {apt.startTime}</div>
                                <div className="text-xs text-muted-foreground">{apt.type} • {apt.status}</div>
                              </div>
                              <Badge variant="outline">{apt.doctor?.name || "Médico"}</Badge>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhuma consulta encontrada.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="mt-10 text-center text-muted-foreground">Selecione um paciente.</div>
            )}

            <SheetFooter className="mt-6">
              <div className="w-full flex flex-wrap gap-2 justify-between">
                {drawerPatient && canWrite && (
                  <div className="flex items-center gap-2">
                    {drawerPatient.isArchived ? (
                      <Button variant="outline" onClick={() => doArchive(drawerPatient.id, false)}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => doArchive(drawerPatient.id, true)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Arquivar
                      </Button>
                    )}
                    {canHardDelete && (
                      <ConfirmHardDelete onConfirm={() => doHardDelete(drawerPatient.id)} />
                    )}
                  </div>
                )}
                <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Fechar
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </LayoutShell>
  );
}

function ConfirmHardDelete({ onConfirm }: { onConfirm: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"archive" | "delete">("archive");
  // This modal is only used for permanent delete; archive is on main UI.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir paciente</DialogTitle>
          <DialogDescription>
            Você pode <strong>arquivar</strong> (recomendado) ou excluir permanentemente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <Label>Escolha a ação</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archive">Arquivar (recomendado)</SelectItem>
                <SelectItem value="delete">Excluir permanentemente</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "archive"
                ? "Arquivamento mantém histórico e impede perdas de dados."
                : "Exclusão permanente só funciona se não houver consultas/prontuários vinculados."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "default"}
            onClick={async () => {
              if (mode === "delete") {
                await onConfirm();
              }
              setOpen(false);
            }}
          >
            {mode === "delete" ? "Excluir" : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionsMenu({
  patient,
  canWrite,
  canHardDelete,
  onView,
  onCopy,
  onSchedule,
  onEdit,
  onArchive,
  onRestore,
  onHardDelete,
}: {
  patient: any;
  canWrite: boolean;
  canHardDelete: boolean;
  onView: () => void;
  onCopy: () => void;
  onSchedule: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>Ver detalhes</DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy}>Copiar contato/CPF</DropdownMenuItem>
          <DropdownMenuItem onClick={onSchedule}>Agendar consulta</DropdownMenuItem>
          {canWrite && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar cadastro
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {patient.isArchived ? (
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="w-4 h-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
              )}
              {canHardDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir permanentemente
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir permanentemente?</DialogTitle>
            <DialogDescription>
              Essa ação é irreversível e só será permitida se não houver consultas/prontuários vinculados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onHardDelete();
                setConfirmOpen(false);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
