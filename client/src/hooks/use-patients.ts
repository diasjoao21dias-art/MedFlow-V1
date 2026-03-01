import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertPatient } from "@shared/schema";

export type PatientsQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'createdAt' | 'birthDate' | 'nextAppointmentAt';
  sortDir?: 'asc' | 'desc';
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  hasAppointmentToday?: boolean;
  missingPhone?: boolean;
  missingEmail?: boolean;
  includeArchived?: boolean;
  onlyArchived?: boolean;
};

export function usePatients(params?: PatientsQuery) {
  return useQuery({
    queryKey: [api.patients.list.path, params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
      if (params?.sortBy) qs.set('sortBy', params.sortBy);
      if (params?.sortDir) qs.set('sortDir', params.sortDir);
      if (params?.gender) qs.set('gender', params.gender);
      if (params?.ageMin !== undefined) qs.set('ageMin', String(params.ageMin));
      if (params?.ageMax !== undefined) qs.set('ageMax', String(params.ageMax));
      if (params?.hasAppointmentToday !== undefined) qs.set('hasAppointmentToday', String(params.hasAppointmentToday));
      if (params?.missingPhone !== undefined) qs.set('missingPhone', String(params.missingPhone));
      if (params?.missingEmail !== undefined) qs.set('missingEmail', String(params.missingEmail));
      if (params?.includeArchived !== undefined) qs.set('includeArchived', String(params.includeArchived));
      if (params?.onlyArchived !== undefined) qs.set('onlyArchived', String(params.onlyArchived));

      const url = qs.toString() ? `${api.patients.list.path}?${qs.toString()}` : api.patients.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patients");
      return api.patients.list.responses[200].parse(await res.json());
    },
  });
}

export function usePatient(id: number) {
  return useQuery({
    queryKey: [api.patients.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.patients.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patient");
      return api.patients.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertPatient) => {
      const res = await fetch(api.patients.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create patient");
      }
      return api.patients.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
      toast({ title: "Success", description: "Patient registered successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, patient }: { id: number; patient: Partial<InsertPatient> }) => {
      const url = buildUrl(api.patients.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update patient");
      }
      return api.patients.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.patients.get.path, variables.id] });
    },
  });
}

export function useArchivePatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const url = buildUrl(api.patients.archive.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erro" }));
        throw new Error(error.message || "Falha ao arquivar paciente");
      }
      return api.patients.archive.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
      toast({ title: "Sucesso", description: "Paciente atualizado." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useHardDeletePatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const url = buildUrl(api.patients.hardDelete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erro" }));
        throw new Error(error.message || "Falha ao excluir paciente");
      }
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
      toast({ title: "Sucesso", description: "Paciente excluído." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}
