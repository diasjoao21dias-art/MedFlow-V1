import { useQuery, useMutation } from "@tanstack/react-query";
import { insertClinicSchema, type Clinic } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl,FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Building2 } from "lucide-react";

export default function SuperAdmin() {
  const { toast } = useToast();
  const { data: clinics, isLoading } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

  const form = useForm({
    resolver: zodResolver(insertClinicSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      subscriptionStatus: "active",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", "/api/clinics", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      toast({ title: "Clínica cadastrada com sucesso!" });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar clínica",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Super Admin - Gestão de Clínicas</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Nova Clínica</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Clínica</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Clínica Sorriso" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua Exemplo, 123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Cadastrar Clínica
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clínicas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clinics?.map((clinic) => (
                <div key={clinic.id} className="p-4 border rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{clinic.name}</p>
                    <p className="text-sm text-muted-foreground">{clinic.address}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full uppercase">
                      {clinic.subscriptionStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
