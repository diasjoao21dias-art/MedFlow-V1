import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertMedicalRecord } from "@shared/schema";

export function useMedicalRecords(patientId: number) {
  return useQuery({
    queryKey: [api.medicalRecords.listByPatient.path, patientId],
    queryFn: async () => {
      const url = buildUrl(api.medicalRecords.listByPatient.path, { patientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch records");
      return api.medicalRecords.listByPatient.responses[200].parse(await res.json());
    },
    enabled: !!patientId,
  });
}

export function useCreateMedicalRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMedicalRecord) => {
      const res = await fetch(api.medicalRecords.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to save medical record");
      return api.medicalRecords.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [api.medicalRecords.listByPatient.path, variables.patientId] 
      });
      toast({ title: "Saved", description: "Medical record updated successfully" });
    },
  });
}
