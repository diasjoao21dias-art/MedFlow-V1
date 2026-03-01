import LayoutShell from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PrescriptionsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [templates, setTemplates] = useState([
    { title: "Receituário Simples", description: "Modelo padrão para medicamentos comuns.", content: "Rx:\n\n1. [Medicamento] [Dose]\nTomar 1 comprimido VO a cada [Horas]h por [Dias] dias." },
    { title: "Controle Especial", description: "Para medicamentos de tarja preta ou controlados.", content: "RECEITA DE CONTROLE ESPECIAL\n\nRx:\n\n1. [Medicamento Controlado] [Dose]\nTomar conforme orientação médica." },
    { title: "Atestado Médico", description: "Modelo para emissão de atestados de afastamento.", content: "ATESTADO MÉDICO\n\nAtesto para os devidos fins que o(a) Sr(a). [Nome] necessita de [Dias] dias de afastamento das atividades laborais por motivo de doença." },
  ]);

  const handleUseTemplate = (content: string) => {
    localStorage.setItem("selected_template", content);
    alert("Modelo selecionado! Vá para o atendimento do paciente e clique em 'Carregar Modelo' na aba de Receituário.");
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const newTemplate = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      content: formData.get("content") as string,
    };
    setTemplates([...templates, newTemplate]);
    setIsCreateOpen(false);
  };

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Prescrição Eletrônica</h1>
          <p className="text-muted-foreground mt-1">Gerencie modelos de prescrição e emita receitas digitais para seus pacientes.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar modelos..." className="pl-10" />
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo Modelo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, i) => (
            <Card key={i} className="hover-elevate cursor-pointer group">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  {template.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground min-h-[40px]">{template.description}</p>
                <div className="mt-4 p-3 bg-slate-50 rounded text-[10px] font-mono text-slate-500 overflow-hidden h-20">
                  {template.content}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 text-primary font-bold group-hover:bg-primary group-hover:text-white"
                  onClick={() => handleUseTemplate(template.content)}
                >
                  Usar Modelo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Novo Modelo de Prescrição</DialogTitle>
            <DialogDescription>
              Crie e salve um modelo para reutilizar em futuras consultas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveModel} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título do Modelo</Label>
              <Input id="title" name="title" required placeholder="Ex: Receita Hipertensão" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição Curta</Label>
              <Input id="description" name="description" required placeholder="Ex: Padronização para pacientes hipertensos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo da Prescrição</Label>
              <div className="relative">
                <Textarea 
                  id="content" 
                  name="content" 
                  required 
                  className="min-h-[300px] font-mono text-sm p-4" 
                  placeholder="Rx:&#10;&#10;1. Medicamento...&#10;Tomar..." 
                />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const el = document.getElementById('content') as HTMLTextAreaElement;
                    el.value += "\n\nATESTADO MÉDICO\n\nAtesto que o(a) Sr(a). [Nome]...";
                  }}>+ Atestado</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const el = document.getElementById('content') as HTMLTextAreaElement;
                    el.value += "\n\nRx:\n1. [Medicamento]\nTomar...";
                  }}>+ Receita</Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Dica: Use colchetes como [Nome] ou [Dose] para identificar campos que você preencherá depois.</p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-primary text-white">Salvar Modelo</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}
