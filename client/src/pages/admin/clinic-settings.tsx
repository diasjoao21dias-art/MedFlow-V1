import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

const clinicSchema = z.object({
  name: z.string().min(1, "O nome da clínica é obrigatório"),
  cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .pipe(z.string().length(14, "O CNPJ deve ter 14 dígitos")),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

export default function ClinicSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["/api/clinic/me"],
  });

  const form = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    values: {
      name: clinic?.name || "",
      cnpj: clinic?.cnpj || "",
    },
  });

  const updateClinicMutation = useMutation({
    mutationFn: async (values: ClinicFormValues) => {
      const res = await apiRequest("PUT", "/api/clinic/me", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/me"] });
      toast({
        title: "Sucesso",
        description: "Configurações da clínica atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A logo deve ter no máximo 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/clinic/me/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro no upload");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/clinic/me"] });
      toast({
        title: "Sucesso",
        description: "Logo atualizada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Configurações da Clínica</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Logo da Clínica</CardTitle>
            <CardDescription>
              Esta logo será exibida nos documentos e no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-slate-50 relative group">
              {clinic?.logoUrl ? (
                <img
                  src={clinic.logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="h-12 w-12 text-slate-300" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="w-full">
              <label htmlFor="logo-upload" className="w-full">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {clinic?.logoUrl ? "Alterar Logo" : "Enviar Logo"}
                  </span>
                </Button>
                <input
                  id="logo-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                updateClinicMutation.mutate(data)
              )}
            >
              <CardHeader>
                <CardTitle>Dados Gerais</CardTitle>
                <CardDescription>
                  Informações básicas de identificação da sua unidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Clínica</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Clínica Bem Estar"
                          data-testid="input-clinic-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0000-00"
                          data-testid="input-clinic-cnpj"
                          {...field}
                          value={formatCNPJ(field.value)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            field.onChange(val);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateClinicMutation.isPending}
                  data-testid="button-save-clinic"
                >
                  {updateClinicMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar Alterações
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
