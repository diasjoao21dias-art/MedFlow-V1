import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertAppointment } from "@shared/schema";
import { format } from "date-fns";

interface AppointmentFilters {
  date?: string | Date;
  startDate?: string | Date;
  endDate?: string | Date;
  doctorId?: number;
  patientId?: number;
  status?: string;
}

export function useAppointments(filters?: AppointmentFilters) {
  return useQuery({
    queryKey: [api.appointments.list.path, filters],
    queryFn: async () => {
      let url = api.appointments.list.path;
      if (filters) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
          if (value != null && value !== "") {
            const v = value instanceof Date ? format(value, "yyyy-MM-dd") : String(value);
            params.set(key, v);
          }
        }
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return api.appointments.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const res = await fetch(api.appointments.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to schedule appointment");
      }
      return api.appointments.create.responses[201].parse(await res.json());
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      await queryClient.refetchQueries({ queryKey: [api.appointments.list.path], type: 'active' });
      toast({ title: "Success", description: "Appointment scheduled" });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      paymentMethod, 
      paymentStatus,
      price,
      type,
      examType
    }: { 
      id: number, 
      status: string,
      paymentMethod?: string,
      paymentStatus?: string,
      price?: number,
      type?: string,
      examType?: string
    }) => {
      const url = buildUrl(api.appointments.updateStatus.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paymentMethod, paymentStatus, price, type, examType }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to update status");
      return api.appointments.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
    },
  });
}
