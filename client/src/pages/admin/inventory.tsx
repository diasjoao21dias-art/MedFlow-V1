import LayoutShell from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, Plus, ArrowUpRight, ArrowDownRight, 
  AlertTriangle, Loader2, Search, Filter, 
  MoreVertical, Calendar, Truck, MapPin, 
  History, Download, Edit2, Trash2, ArrowLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

export default function InventoryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"entrada" | "saida">("entrada");

  const { data: items, isLoading } = useQuery<any[]>({ queryKey: ["/api/inventory"] });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, categoryFilter]);

  const lowStockItems = useMemo(() => {
    return items?.filter(item => item.quantity <= item.minQuantity) || [];
  }, [items]);

  const addItemMutation = useMutation({
    mutationFn: async (newItem: any) => {
      await apiRequest("POST", "/api/inventory", newItem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Sucesso", description: "Item adicionado ao estoque." });
      setIsAddItemOpen(false);
    },
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (tx: any) => {
      await apiRequest("POST", "/api/inventory/transaction", tx);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Sucesso", description: "Movimentação registrada com sucesso." });
      setIsTransactionOpen(false);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Sucesso", description: "Item removido do estoque." });
    },
  });

  if (isLoading) return (
    <div className="h-[80vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const stats = [
    { label: "Total de Itens", value: items?.length || 0, icon: Package, color: "text-blue-600" },
    { label: "Alerta de Estoque", value: lowStockItems.length, icon: AlertTriangle, color: "text-amber-600" },
    { label: "Categorias", value: new Set(items?.map(i => i.category)).size, icon: Filter, color: "text-purple-600" },
    { label: "Valor Total Est.", value: `R$ ${((items?.reduce((acc, curr) => acc + (curr.quantity * curr.pricePerUnit), 0) || 0) / 100).toFixed(2)}`, icon: ArrowUpRight, color: "text-green-600" },
  ];

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => window.history.back()}
              className="rounded-full bg-white shadow-sm border"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Estoque</h1>
              <p className="text-slate-500">Controle de insumos, medicamentos e materiais da clínica.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="hidden md:flex">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={() => setIsAddItemOpen(true)} data-testid="button-add-item" className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Card key={i} className="hover-elevate transition-all border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nome ou fornecedor..." 
              className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="medicamento">Medicamento</SelectItem>
                <SelectItem value="equipamento">Equipamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="grid" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-white border shadow-sm p-1">
              <TabsTrigger value="grid">Visualização em Cards</TabsTrigger>
              <TabsTrigger value="list">Lista Detalhada</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="grid" className="mt-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className={`group hover-elevate transition-all border-none shadow-sm overflow-hidden ${item.quantity <= item.minQuantity ? "ring-1 ring-destructive/20 bg-destructive/5" : "bg-white"}`}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold leading-none group-hover:text-primary transition-colors">
                        {item.name}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                          {item.category}
                        </Badge>
                        {item.location && (
                          <span className="flex items-center gap-0.5 text-slate-400">
                            <MapPin className="w-3 h-3" /> {item.location}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer">
                          <Edit2 className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <div className="text-3xl font-bold tracking-tight">
                        {item.quantity}
                        <span className="text-sm font-normal text-slate-500 ml-1.5">{item.unit}s</span>
                      </div>
                      {item.quantity <= item.minQuantity && (
                        <Badge variant="destructive" className="animate-pulse shadow-sm">
                          Baixo Estoque
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-400 uppercase">Fornecedor</span>
                        <span className="truncate">{item.supplier || "N/A"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-400 uppercase">Validade</span>
                        <span className={item.expiryDate && new Date(item.expiryDate) < new Date() ? "text-destructive font-bold" : ""}>
                          {item.expiryDate ? format(new Date(item.expiryDate), "dd/MM/yyyy") : "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-9 border-slate-200 hover:bg-slate-50 hover:text-green-600 hover:border-green-200 transition-all"
                        onClick={() => {
                          setSelectedItem(item);
                          setTransactionType("entrada");
                          setIsTransactionOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Entrada
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-9 border-slate-200 hover:bg-slate-50 hover:text-amber-600 hover:border-amber-200 transition-all"
                        onClick={() => {
                          setSelectedItem(item);
                          setTransactionType("saida");
                          setIsTransactionOpen(true);
                        }}
                      >
                        <ArrowDownRight className="w-3.5 h-3.5 mr-1.5" /> Saída
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <Card className="border-none shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[300px]">Item / Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Qtd. Atual</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <span className="text-xs text-slate-400">{item.batchNumber ? `Lote: ${item.batchNumber}` : ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize font-normal">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-slate-500">{item.supplier || "-"}</TableCell>
                      <TableCell className="text-slate-400">{item.minQuantity} {item.unit}</TableCell>
                      <TableCell>
                        {item.quantity <= item.minQuantity ? (
                          <Badge variant="destructive" className="font-normal">Reposição Urgente</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600 font-normal">Adequado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Adicionar Item */}
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Item no Estoque</DialogTitle>
              <DialogDescription>Insira as informações básicas e de controle para o novo insumo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addItemMutation.mutate({
                name: formData.get("name"),
                category: formData.get("category"),
                unit: formData.get("unit"),
                quantity: parseInt(formData.get("quantity") as string),
                minQuantity: parseInt(formData.get("minQuantity") as string),
                pricePerUnit: Math.round(parseFloat(formData.get("price") as string) * 100),
                supplier: formData.get("supplier"),
                location: formData.get("location"),
                batchNumber: formData.get("batchNumber"),
                expiryDate: formData.get("expiryDate"),
              });
            }} className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Nome do Item</Label>
                  <Input id="name" name="name" placeholder="Ex: Seringa 5ml, Luvas G, Dipirona..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select name="category" defaultValue="material">
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                      <SelectItem value="equipamento">Equipamento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade de Medida</Label>
                  <Input id="unit" name="unit" placeholder="unidade, caixa, frasco..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade Inicial</Label>
                  <Input id="quantity" name="quantity" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minQuantity">Quantidade de Alerta (Mín)</Label>
                  <Input id="minQuantity" name="minQuantity" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Custo Unitário (R$)</Label>
                  <Input id="price" name="price" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Data de Validade</Label>
                  <Input id="expiryDate" name="expiryDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Fornecedor</Label>
                  <Input id="supplier" name="supplier" placeholder="Distribuidora X..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Localização Física</Label>
                  <Input id="location" name="location" placeholder="Prateleira A2, Gaveta 3..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsAddItemOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={addItemMutation.isPending}>
                  {addItemMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cadastrar Item
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Transação (Entrada/Saída) */}
        <Dialog open={isTransactionOpen} onOpenChange={setIsTransactionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar {transactionType === "entrada" ? "Entrada" : "Saída"}</DialogTitle>
              <DialogDescription>
                {selectedItem?.name} - Saldo Atual: {selectedItem?.quantity} {selectedItem?.unit}s
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addTransactionMutation.mutate({
                inventoryId: selectedItem.id,
                type: transactionType,
                quantity: parseInt(formData.get("quantity") as string),
                notes: formData.get("notes"),
              });
            }} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="tx-quantity">Quantidade</Label>
                <Input id="tx-quantity" name="quantity" type="number" required min="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-notes">Observações</Label>
                <Input id="tx-notes" name="notes" placeholder="Motivo da movimentação..." />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addTransactionMutation.isPending} className={transactionType === "entrada" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}>
                  {addTransactionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar {transactionType === "entrada" ? "Entrada" : "Saída"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </LayoutShell>
  );
}
