import { useAuth } from "@/hooks/use-auth";
import LayoutShell from "@/components/layout-shell";
import { Calendar, Users, Clock, AlertCircle, Plus, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight, MoreVertical, CheckCircle, Play, CheckCircle2, DollarSign as DollarIcon, XCircle } from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";
import { format, addMinutes, parseISO, addDays, subDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertAppointmentSchema, type User, type AppointmentWithDetails } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatients } from "@/hooks/use-patients";
import { useCreateAppointment } from "@/hooks/use-appointments";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/stat-card";
import { apiRequest, queryClient } from "@/lib/queryClient";

import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import { DateRangePicker } from "@/components/ui/date-range-picker";
import { eachDayOfInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import StatusBadge from "@/components/status-badge";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ptBR } from 'date-fns/locale';
import { Copy, User as UserIcon, Phone, FileText, Calendar as CalendarIcon, DollarSign, Stethoscope, LayoutList } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { TOOLTIP } from "@/constants/tooltips";

export default function AgendaPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === "nurse";
  const normalizeStatus = (s: any) => String(s ?? "").toLowerCase().trim();
  const [, setLocation] = useLocation();
  const calendarRef = useRef<FullCalendar>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [viewRange, setViewRange] = useState({ 
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState<AppointmentWithDetails | null>(null);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"resumo" | "pagamento" | "triagem" | "historico" | "timeline">("resumo");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeDetailsButtonRef = useRef<HTMLButtonElement>(null);

  const timelineEvents = useMemo(() => {
    if (!selectedAppointmentDetails) return [];
    
    const events: { title: string; subtitle?: string; timestamp?: string; icon: any; color: string }[] = [];
    
    // 1. Agendamento criado
    if (selectedAppointmentDetails?.createdAt) {
      events.push({
        title: "Agendamento criado",
        timestamp: format(new Date(selectedAppointmentDetails.createdAt), "dd/MM/yyyy HH:mm"),
        icon: Plus,
        color: "bg-blue-500"
      });
    }

    // 2. Parsing de notes para Cancelado/Remarcado
    if (selectedAppointmentDetails?.notes) {
      const lines = selectedAppointmentDetails.notes.split('\n');
      lines.forEach(line => {
        // Cancelado em YYYY-MM-DD HH:mm: motivo
        const cancelMatch = line.match(/Cancelado em (\d{4}-\d{2}-\d{2} \d{2}:\d{2}):?\s*(.*)/i);
        if (cancelMatch) {
          try {
            events.push({
              title: "Cancelado",
              timestamp: format(parseISO(cancelMatch[1].replace(' ', 'T')), "dd/MM/yyyy HH:mm"),
              subtitle: cancelMatch[2] || undefined,
              icon: XCircle,
              color: "bg-red-500"
            });
          } catch (e) {
            console.error("Erro ao formatar data de cancelamento:", e);
          }
        }
        
        // Remarcado em YYYY-MM-DD HH:mm
        const rescheduleMatch = line.match(/Remarcado em (\d{4}-\d{2}-\d{2} \d{2}:\d{2}):?\s*(.*)/i);
        if (rescheduleMatch) {
          try {
            events.push({
              title: "Remarcado",
              timestamp: format(parseISO(rescheduleMatch[1].replace(' ', 'T')), "dd/MM/yyyy HH:mm"),
              subtitle: rescheduleMatch[2] || undefined,
              icon: Calendar,
              color: "bg-amber-500"
            });
          } catch (e) {
            console.error("Erro ao formatar data de reagendamento:", e);
          }
        }
      });
    }

    // 3. Status atual se não capturado por notes
    if (selectedAppointmentDetails?.status === 'cancelado' && !events.find(e => e.title === "Cancelado")) {
      events.push({
        title: "Cancelado",
        subtitle: "Status atualizado para cancelado",
        icon: XCircle,
        color: "bg-red-500"
      });
    }

    if (selectedAppointmentDetails?.paymentStatus === 'pago') {
      events.push({
        title: "Pagamento confirmado",
        subtitle: `Método: ${selectedAppointmentDetails.paymentMethod || 'Não informado'}`,
        timestamp: selectedAppointmentDetails.createdAt ? `${format(new Date(selectedAppointmentDetails.createdAt), "dd/MM/yyyy")} (horário não disponível)` : undefined,
        icon: CheckCircle2,
        color: "bg-green-500"
      });
    }

    if (selectedAppointmentDetails?.status === 'em_atendimento') {
      events.push({
        title: "Em atendimento",
        subtitle: "Paciente entrou para consulta",
        icon: Play,
        color: "bg-purple-500"
      });
    }

    if (selectedAppointmentDetails?.status === 'finalizado') {
      events.push({
        title: "Finalizado",
        subtitle: "Atendimento concluído",
        icon: CheckCircle,
        color: "bg-green-600"
      });
    }

    // Ordenação: mais antigo para mais recente (se tiver timestamp), sem timestamp por último
    return events.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp.localeCompare(b.timestamp);
      }
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      return 0;
    });
  }, [selectedAppointmentDetails]);


  // Helper to check if user is typing in an input
  const isTyping = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    const isContentEditable = activeElement.hasAttribute('contenteditable') && activeElement.getAttribute('contenteditable') !== 'false';
    
    return isInput || isContentEditable;
  };


  useEffect(() => {
    if (isDetailsSheetOpen) {
      // Small delay to ensure the Sheet has rendered
      const timer = setTimeout(() => {
        closeDetailsButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDetailsSheetOpen]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(date);
    }
  };

  const handlePrevDay = () => handleDateChange(subDays(currentDate, 1));
  const handleNextDay = () => handleDateChange(addDays(currentDate, 1));
  const handleToday = () => handleDateChange(new Date());

  const WORK_START = 7;
  const WORK_END = 19;

  const toMinutes = (timeStr: string) => {
    const [hh, mm] = timeStr.split(":").map(Number);
    return hh * 60 + mm;
  };

  const formatMinutes = (min: number) => {
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${min}m`;
  };

  const handleGoToNow = () => {
    if (viewMode === "calendar" && calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.gotoDate(new Date());
      
      // Scroll to current time if in timeGrid view
      const view = api.view;
      if (view.type.includes('timeGrid')) {
        const now = new Date();
        const timeStr = format(now, "HH:mm:ss");
        api.scrollToTime(timeStr);
      }
    }
  };

  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>();
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithDetails | null>(null);
  const [isAptDialogOpen, setIsAptDialogOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [availabilityDateRange, setAvailabilityDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  // Keyboard Shortcuts Effect (Moved here to avoid TDZ)
  
  const { data: allAppointments, isLoading: isLoadingAppointments } = useAppointments({ 
    startDate: viewRange.start, 
    endDate: viewRange.end 
  });

  useEffect(() => {
    if (!selectedAppointmentDetails) return;
    if (!allAppointments) return;

    const fresh = allAppointments.find(
      (a) => a.id === selectedAppointmentDetails.id
    );

    if (fresh) {
      setSelectedAppointmentDetails(fresh);
    }
  }, [allAppointments, selectedAppointmentDetails?.id]);
  
  const getUnavailableTimes = (date: string, doctorId: number) => {
    if (!allAppointments) return [];
    return allAppointments
      .filter(apt => apt.date === date && apt.doctorId === doctorId && apt.status !== 'cancelado')
      .map(apt => apt.startTime);
  };

  const isTimeSlotOccupied = (time: string, date: string, doctorId: number) => {
    const unavailable = getUnavailableTimes(date, doctorId);
    return unavailable.includes(time);
  };
  const { data: patientsData } = usePatients({ page: 1, pageSize: 100000, includeArchived: false });
  const patients = patientsData?.items;
  const { data: doctors } = useQuery<User[]>({ 
    queryKey: ["doctors"],
    queryFn: async () => {
      const res = await fetch("/api/doctors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
    enabled: !!user && (user.role === "admin" || user.role === "manager" || user.role === "receptionist" || user.role === "operator")
  });

  const { data: availabilityExceptions } = useQuery<any[]>({
    queryKey: ["/api/availability-exceptions", selectedDoctorId],
    queryFn: async () => {
      const url = selectedDoctorId 
        ? `/api/availability-exceptions?doctorId=${selectedDoctorId}`
        : "/api/availability-exceptions";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    }
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ doctorId, dates, isAvailable }: any) => {
      if (isAvailable) {
        // If we are making it available, we delete existing exceptions
        await apiRequest("POST", "/api/availability-exceptions/bulk-delete", { doctorId, dates });
      } else {
        // Blocking it
        await apiRequest("POST", "/api/availability-exceptions", { doctorId, dates, isAvailable: false });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability-exceptions"] });
      toast({ title: "Agenda atualizada", description: "Disponibilidade alterada com sucesso." });
      setIsAvailabilityDialogOpen(false);
    }
  });

  const { toast } = useToast();
  const createAppointment = useCreateAppointment();

  // Helper to find conflict
  const findConflict = (date: string, startTime: string, doctorId: number, excludeId?: number) => {
    if (!allAppointments) return null;
    return allAppointments.find(apt => 
      apt.date === date && 
      apt.doctorId === doctorId && 
      apt.startTime === startTime && 
      apt.status !== 'cancelado' &&
      apt.id !== excludeId
    );
  };

  const getSuggestions = (date: string, doctorId: number, preferredTime: string) => {
    if (!allAppointments) return [];
    const suggestions: string[] = [];
    let [hours, minutes] = preferredTime.split(':').map(Number);
    let currentTotal = hours * 60 + minutes;

    // Look for next 3 available slots (30 min interval)
    for (let i = 1; i <= 10 && suggestions.length < 3; i++) {
      currentTotal += 30;
      if (currentTotal >= 20 * 60) break; // End of day limit 20:00
      
      const h = Math.floor(currentTotal / 60).toString().padStart(2, '0');
      const m = (currentTotal % 60).toString().padStart(2, '0');
      const timeStr = `${h}:${m}`;
      
      if (!findConflict(date, timeStr, doctorId)) {
        suggestions.push(timeStr);
      }
    }
    return suggestions;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentMethod, paymentStatus }: any) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}/status`, { 
        status, 
        paymentMethod, 
        paymentStatus 
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      const updatedFromServer = data?.appointment ?? data ?? null;

      if (selectedAppointmentDetails?.id === variables?.id) {
        setSelectedAppointmentDetails((prev) => {
          if (!prev) return prev;

          // Preferir o que veio do servidor; se não vier, cair para variables
          const nextPaymentStatus =
            updatedFromServer?.paymentStatus ?? variables?.paymentStatus ?? prev.paymentStatus;

          const nextPaymentMethod =
            updatedFromServer?.paymentMethod ?? variables?.paymentMethod ?? prev.paymentMethod;

          const nextStatus =
            updatedFromServer?.status ?? variables?.status ?? prev.status;

          return {
            ...prev,
            paymentStatus: nextPaymentStatus,
            paymentMethod: nextPaymentMethod,
            status: nextStatus,
          };
        });
      }

      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.refetchQueries({ queryKey: [api.appointments.list.path], type: 'active' });
      toast({ title: "Sucesso", description: "Status do agendamento atualizado" });
      setIsCheckinDialogOpen(false);
      setSelectedAppointmentForCheckin(null);
    }
  });

  const checkinForm = useForm({
    defaultValues: {
      paymentMethod: "dinheiro",
      paymentStatus: "pendente",
      confirmData: false
    }
  });

  const onCheckinSubmit = (data: any) => {
    if (!selectedAppointmentForCheckin) return;
    updateStatusMutation.mutate({
      id: selectedAppointmentForCheckin.id,
      status: "presente",
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus
    });
  };

  const updateAppointment = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/appointments/${editingAppointment?.id}`, data);
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      await queryClient.refetchQueries({ queryKey: [api.appointments.list.path], type: 'active' });
      toast({ title: "Sucesso", description: "Agendamento atualizado" });
      setIsAptDialogOpen(false);
      setEditingAppointment(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Conflito de Horário", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      await queryClient.refetchQueries({ queryKey: [api.appointments.list.path], type: 'active' });
      toast({ title: "Sucesso", description: "Agendamento excluído" });
      setIsAptDialogOpen(false);
      setEditingAppointment(null);
    }
  });

  const aptForm = useForm({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      patientId: 0,
      doctorId: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: "09:00",
      duration: 30,
      status: "agendado",
      notes: "",
      clinicId: 1,
      price: 150,
      type: "consulta",
      examType: "",
      procedure: "",
      insurance: "",
      isPrivate: false
    }
  });

  // Check-in -> Agenda: abrir modal de novo agendamento já com patientId via querystring
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("patientId");
    if (!pid) return;

    const patientId = Number(pid);
    if (!Number.isFinite(patientId) || patientId <= 0) return;

    setEditingAppointment(null);
    setIsAptDialogOpen(true);
    aptForm.setValue("patientId", patientId);

    // limpa a URL
    params.delete("patientId");
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState({}, "", newUrl);
  }, [aptForm]);

  useEffect(() => {
    if (editingAppointment) {
      aptForm.reset({
        patientId: editingAppointment.patientId,
        doctorId: editingAppointment.doctorId,
        date: editingAppointment.date,
        startTime: editingAppointment.startTime,
        duration: editingAppointment.duration,
        status: editingAppointment.status,
        notes: editingAppointment.notes || "",
        clinicId: editingAppointment.clinicId,
        price: editingAppointment.price / 100,
        type: (editingAppointment as any).type || "consulta",
        examType: (editingAppointment as any).examType || "",
        procedure: (editingAppointment as any).procedure || "",
        insurance: (editingAppointment as any).insurance || "",
        isPrivate: (editingAppointment as any).isPrivate || false
      });
    } else {
      aptForm.reset({
        patientId: 0,
        doctorId: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: "09:00",
        duration: 30,
        status: "agendado",
        notes: "",
        clinicId: 1,
        price: 150,
        type: "consulta",
        examType: "",
        procedure: "",
        insurance: "",
        isPrivate: false
      });
    }
  }, [editingAppointment]);

  const onAptSubmit = async (data: any) => {
    try {
      const conflict = findConflict(data.date, data.startTime, data.doctorId, editingAppointment?.id);
      if (conflict) {
        toast({
          title: "Horário indisponível",
          description: `Dr(a). ${conflict?.doctor?.name || "Médico"} já tem consulta em ${format(parseISO(data.date), "dd/MM")} às ${data.startTime}. Escolha outro horário.`,
          variant: "destructive"
        });
        return;
      }

      const warnings = getWarnings({ date: data.date, startTime: data.startTime, duration: data.duration });
      if (warnings.length > 0) {
        const confirmMsg = `Atenção:\n${warnings.map(w => `- ${w}`).join("\n")}\n\nDeseja continuar?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      const formattedData = {
        ...data,
        price: Math.round(data.price * 100)
      };
      if (editingAppointment) {
        await updateAppointment.mutateAsync(formattedData);
      } else {
        const result = await createAppointment.mutateAsync(formattedData);
        if (result && result.date) {
          handleDateChange(parseISO(result.date));
        }
        setIsAptDialogOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      await queryClient.refetchQueries({ queryKey: [api.appointments.list.path], type: 'active' });
      aptForm.reset();
    } catch (error: any) {
      // Error handled by mutation onError
    }
  };

  const [statusFilters, setStatusFilters] = useState<string[]>(["agendado", "confirmado", "presente", "em_atendimento"]);
  const [showFinished, setShowFinished] = useState(false);
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [showOnlyLate, setShowOnlyLate] = useState(false);

  const buildDateTime = (dateStr: string, timeStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm);
  };

  const dayAppointments = useMemo(() => {
    if (!allAppointments) return [];
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return allAppointments
      .filter(apt => apt.date === dateStr && (!selectedDoctorId || apt.doctorId === selectedDoctorId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allAppointments, currentDate, selectedDoctorId]);

  const dayOccupationMetrics = useMemo(() => {
    const totalWorkMinutes = (WORK_END - WORK_START) * 60;
    if (!dayAppointments || dayAppointments.length === 0) {
      return {
        totalWorkMinutes,
        totalBookedMinutes: 0,
        totalFreeMinutes: totalWorkMinutes,
        biggestGapMinutes: totalWorkMinutes,
        occupiedPercent: 0
      };
    }

    const sortedApts = [...dayAppointments].sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    let totalBookedMinutes = 0;
    let totalFreeMinutes = 0;
    let biggestGapMinutes = 0;

    const startWorkMinutes = WORK_START * 60;
    const endWorkMinutes = WORK_END * 60;

    let lastEndMinutes = startWorkMinutes;

    sortedApts.forEach((apt) => {
      const aptStart = toMinutes(apt.startTime);
      const duration = apt.duration || 30;
      const aptEnd = aptStart + duration;

      if (aptStart > lastEndMinutes) {
        const gap = aptStart - lastEndMinutes;
        totalFreeMinutes += gap;
        if (gap > biggestGapMinutes) biggestGapMinutes = gap;
      }

      totalBookedMinutes += duration;
      lastEndMinutes = Math.max(lastEndMinutes, aptEnd);
    });

    if (endWorkMinutes > lastEndMinutes) {
      const gap = endWorkMinutes - lastEndMinutes;
      totalFreeMinutes += gap;
      if (gap > biggestGapMinutes) biggestGapMinutes = gap;
    }

    const occupiedPercent = Math.max(0, Math.min(100, Math.round((totalBookedMinutes / totalWorkMinutes) * 100)));

    return {
      totalWorkMinutes,
      totalBookedMinutes,
      totalFreeMinutes,
      biggestGapMinutes,
      occupiedPercent
    };
  }, [dayAppointments]);

  const lateAppointments = useMemo(() => {
    const now = new Date();
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const isToday = dateStr === format(now, 'yyyy-MM-dd');
    
    return dayAppointments.filter(apt => {
      if (!isToday) return false;
      const aptTime = buildDateTime(apt.date, apt.startTime);
      return aptTime < now && ['agendado', 'confirmado', 'aguardando', 'em_atendimento'].includes(apt.status);
    });
  }, [dayAppointments, currentDate]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const isToday = dateStr === format(now, 'yyyy-MM-dd');
    
    return dayAppointments.find(apt => {
      if (!isToday) return apt.status !== 'cancelado';
      const aptTime = buildDateTime(apt.date, apt.startTime);
      return aptTime >= now && apt.status !== 'cancelado';
    });
  }, [dayAppointments, currentDate]);

  const productivityData = useMemo(() => {
    if (!allAppointments) return { next: null, overdueCount: 0, freeMinutesUntilNext: null, totalDay: 0 };
    
    const now = new Date();
    const sorted = dayAppointments.filter(apt => apt.status !== 'cancelado' && apt.status !== 'finalizado');
    
    const overdue = lateAppointments;
    const next = nextAppointment;

    let freeMinutesUntilNext = null;
    if (next) {
      const nextTime = buildDateTime(next.date, next.startTime);
      freeMinutesUntilNext = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / (1000 * 60)));
    }

    return {
      next,
      overdueCount: overdue.length,
      freeMinutesUntilNext,
      totalDay: dayAppointments.length
    };
  }, [dayAppointments, lateAppointments, nextAppointment]);

  const getWarnings = ({ date, startTime, duration }: { date: string, startTime: string, duration: number }) => {
    const warnings: string[] = [];
    const appointmentDate = buildDateTime(date, startTime);
    const now = new Date();

    if (appointmentDate < now) {
      warnings.push("Você está agendando no passado.");
    }

    const diffMinutes = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes > 0 && diffMinutes < 15) {
      warnings.push("Este atendimento começa em menos de 15 minutos.");
    }

    if (duration > 60) {
      warnings.push("Duração acima de 60 minutos.");
    }

    const [hours] = startTime.split(":").map(Number);
    if (hours < 7 || hours >= 19) {
      warnings.push("Fora do horário padrão (07:00–19:00).");
    }

    return warnings;
  };

  const canAction = (appointment: AppointmentWithDetails, action: "start" | "finish" | "cancel" | "reschedule" | "markPaid") => {
    const status = normalizeStatus(appointment.status);
    const paymentStatus = appointment.paymentStatus ? normalizeStatus(appointment.paymentStatus) : "pendente";

    switch (action) {
      case "start":
        if (["agendado", "confirmado", "aguardando", "presente"].includes(status)) return { ok: true };
        if (["em_atendimento", "finalizado", "cancelado"].includes(status)) {
          return { ok: false, reason: `Não é possível iniciar: o atendimento já está ${status.replace("_", " ")}.` };
        }
        return { ok: false, reason: "Status inválido para iniciar atendimento." };
      case "finish":
        if (status === "em_atendimento") return { ok: true };
        return { ok: false, reason: "Para finalizar, primeiro inicie o atendimento." };
      case "cancel":
        if (status === "finalizado") return { ok: false, reason: "Não é possível cancelar um atendimento finalizado." };
        if (status === "cancelado") return { ok: false, reason: "Este agendamento já está cancelado." };
        return { ok: true };
      case "reschedule":
        if (["finalizado", "cancelado"].includes(status)) {
          return { ok: false, reason: `Não é possível remarcar um atendimento ${status}.` };
        }
        return { ok: true };
      case "markPaid":
        if (status === "cancelado") return { ok: false, reason: "Não é possível registrar pagamento de um agendamento cancelado." };
        if (paymentStatus === "pago") return { ok: false, reason: "Este agendamento já está pago." };
        return { ok: true };
      default:
        return { ok: true };
    }
  };

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    finalizado: false,
    agendado: true,
    confirmado: true,
    presente: true,
    em_atendimento: true,
    cancelado: true,
  });

  const toggleSection = (status: string) => {
    setExpandedSections(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const handleKpiClick = (kpi: string) => {
    if (activeKpiFilter === kpi) {
      setActiveKpiFilter(null);
      setStatusFilters(["agendado", "em_atendimento"]);
      setShowFinished(false);
    } else {
      setActiveKpiFilter(kpi);
      if (kpi === "agendado") {
        setStatusFilters(["agendado"]);
        setShowFinished(false);
      } else if (kpi === "em_atendimento") {
        setStatusFilters(["em_atendimento"]);
        setShowFinished(false);
      } else if (kpi === "finalizado") {
        setStatusFilters(["finalizado"]);
        setShowFinished(true);
      } else if (kpi === "cancelado") {
        setStatusFilters(["cancelado"]);
        setShowFinished(false);
      } else if (kpi === "pendencias") {
        setStatusFilters(["agendado", "confirmado", "presente", "em_atendimento"]);
        setShowFinished(false);
      }
    }
  };

  const toggleStatusFilter = (status: string) => {
    setActiveKpiFilter(null);
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const calendarEvents = allAppointments?.map(apt => {
    const startStr = `${apt.date}T${apt.startTime}`;
    const startDate = parseISO(startStr);
    const endDate = addMinutes(startDate, apt.duration);
    
    // Status color mapping for premium look
    const statusConfig: Record<string, { bg: string, border: string, text: string }> = {
      finalizado: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700' },
      presente: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700' },
      cancelado: { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700' },
      em_atendimento: { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700' },
      confirmado: { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700' },
      agendado: { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-700' },
    };

    const config = statusConfig[apt.status] || statusConfig.agendado;
    
    return {
      id: apt.id.toString(),
      title: apt.patient.name,
      start: startStr,
      end: format(endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      extendedProps: { 
        appointment: apt,
        config
      },
      editable: !['finalizado', 'cancelado'].includes(apt.status)
    };
  }) || [];

  const backgroundEvents = useMemo(() => {
    if (!selectedDoctorId || !allAppointments) return [];
    
    return allAppointments
      .filter(apt => apt.doctorId === selectedDoctorId && apt.status !== 'cancelado')
      .map(apt => {
        const startStr = `${apt.date}T${apt.startTime}`;
        const startDate = parseISO(startStr);
        const endDate = addMinutes(startDate, apt.duration || 30);
        const endStr = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");
        
        return {
          id: `bg-${apt.id}`,
          start: startStr,
          end: endStr,
          display: 'background' as const,
          color: 'rgba(148, 163, 184, 0.1)', // Slate-400 with very low opacity
          title: `Ocupado: ${apt.patient.name} • ${apt.startTime}–${format(endDate, 'HH:mm')}`,
        };
      });
  }, [allAppointments, selectedDoctorId]);

  const handleEventDrop = async (info: any) => {
    const appointment = info.event.extendedProps.appointment;
    const check = canAction(appointment, "reschedule");
    
    if (!check.ok) {
      toast({
        title: "Não permitido",
        description: check.reason,
        variant: "destructive"
      });
      info.revert();
      return;
    }

    const newStart = info.event.start;
    if (!newStart) {
      info.revert();
      return;
    }

    const newDate = format(newStart, 'yyyy-MM-dd');
    const newStartTime = format(newStart, 'HH:mm');

    // Check conflict before drop
    const conflict = findConflict(newDate, newStartTime, appointment.doctorId, appointment.id);
    if (conflict) {
      toast({
        title: "Horário indisponível",
        description: `Dr(a). ${conflict.doctor.name} já tem consulta em ${format(parseISO(newDate), "dd/MM")} às ${newStartTime}. Escolha outro horário.`,
        variant: "destructive"
      });
      info.revert();
      return;
    }

    const warnings = getWarnings({ date: newDate, startTime: newStartTime, duration: appointment.duration });
    if (warnings.length > 0) {
      const confirmMsg = `Atenção:\n${warnings.map(w => `- ${w}`).join("\n")}\n\nDeseja continuar?`;
      if (!window.confirm(confirmMsg)) {
        info.revert();
        return;
      }
    }

    toast({
      title: "Reagendando...",
      description: `Alterando para ${format(newStart, 'dd/MM/yyyy')} às ${newStartTime}`,
    });

    try {
      await updateAppointment.mutateAsync({
        ...appointment,
        date: newDate,
        startTime: newStartTime,
        price: appointment.price / 100 // Manter consistência com a lógica do formulário
      });
    } catch (error) {
      info.revert();
    }
  };

  const filteredEvents = calendarEvents.filter(e => {
    const apt = e.extendedProps.appointment;
    const matchesDoctor = !selectedDoctorId || apt.doctorId === selectedDoctorId;
    
    // Filtro de atrasados
    if (showOnlyLate) {
      const isLate = lateAppointments.some(late => late.id === apt.id);
      if (!isLate) return false;
    }

    // Status filter logic
    const isStatusSelected = statusFilters.includes(apt.status);

    // KPI Filter Logic
    if (activeKpiFilter === "pendencias") {
      const isPending = apt.paymentStatus !== 'pago' || (apt as any).triageDone === false;
      return matchesDoctor && isPending && apt.status !== 'cancelado';
    }
    
    // Logic for showing/hiding finished appointments
    if (apt.status === 'finalizado') {
      return matchesDoctor && (showFinished || isStatusSelected);
    }
    
    return matchesDoctor && isStatusSelected;
  });

  const listAppointments = useMemo(() => {
    if (!allAppointments) return [];
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    return allAppointments
      .filter(apt => {
        const matchesDate = apt.date === dateStr;
        const matchesDoctor = !selectedDoctorId || apt.doctorId === selectedDoctorId;
        const matchesSearch = !searchQuery || 
          apt.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.patient.cpf?.includes(searchQuery) ||
          apt.patient.phone?.includes(searchQuery);
        
        const isStatusSelected = statusFilters.includes(apt.status);
        
        // Filtro de atrasados
        if (showOnlyLate) {
          const isLate = lateAppointments.some(late => late.id === apt.id);
          if (!isLate) return false;
        }

        if (activeKpiFilter === "pendencias") {
          const isPending = apt.paymentStatus !== 'pago' || (apt as any).triageDone === false;
          return matchesDate && matchesDoctor && matchesSearch && isPending && apt.status !== 'cancelado';
        }

        if (apt.status === 'finalizado') {
          return matchesDate && matchesDoctor && matchesSearch && (showFinished || isStatusSelected);
        }
        return matchesDate && matchesDoctor && matchesSearch && isStatusSelected;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allAppointments, currentDate, selectedDoctorId, statusFilters, showFinished, activeKpiFilter, searchQuery]);

  const groupedAppointments = useMemo(() => {
    const order = ["agendado", "confirmado", "presente", "em_atendimento", "cancelado", "finalizado"];
    const groups: Record<string, AppointmentWithDetails[]> = {};
    
    order.forEach(status => {
      groups[status] = listAppointments.filter(apt => apt.status === status);
    });
    
    return groups;
  }, [listAppointments]);

  const pendingPayments = useMemo(() => {
    if (!allAppointments) return [];
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return allAppointments
      .filter(apt => apt.date === dateStr && apt.paymentStatus !== 'pago' && apt.status !== 'cancelado')
      .slice(0, 5);
  }, [allAppointments, currentDate]);

  const pendingTriage = useMemo(() => {
    if (!allAppointments) return [];
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return allAppointments
      .filter(apt => apt.date === dateStr && (apt as any).triageDone === false && apt.status !== 'cancelado')
      .slice(0, 5);
  }, [allAppointments, currentDate]);

  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [selectedAppointmentForCheckin, setSelectedAppointmentForCheckin] = useState<AppointmentWithDetails | null>(null);
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [appointmentToCancel, setAppointmentToCancel] = useState<AppointmentWithDetails | null>(null);

  // Keyboard Shortcuts Effect (Moved here to avoid TDZ)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close drawer/modals
      if (e.key === "Escape") {
        if (isDetailsSheetOpen) setIsDetailsSheetOpen(false);
        if (isAptDialogOpen) setIsAptDialogOpen(false);
        if (isCheckinDialogOpen) setIsCheckinDialogOpen(false);
        if (isCancelDialogOpen) setIsCancelDialogOpen(false);
        if (isRescheduleDialogOpen) setIsRescheduleDialogOpen(false);
        if (isAvailabilityDialogOpen) setIsAvailabilityDialogOpen(false);
      }

      // Shortcuts that should only trigger if NOT typing
      if (!isTyping()) {
        // "/" to focus search
        if (e.key === "/") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }

        // "n" for new appointment
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          setEditingAppointment(null);
          setIsAptDialogOpen(true);
        }

        // "t" for today
        if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          handleToday();
        }

        // Status Filter Shortcuts (0-6)
        const statusMap: Record<string, string> = {
          "1": "agendado",
          "2": "confirmado",
          "3": "presente", // "Aguardando" in UI usually maps to "presente" status
          "4": "em_atendimento",
          "5": "finalizado",
          "6": "cancelado"
        };

        if (e.key === "0") {
          e.preventDefault();
          setStatusFilters(["agendado", "confirmado", "presente", "em_atendimento", "finalizado", "cancelado"]);
          setShowFinished(true);
          setActiveKpiFilter(null);
        } else if (statusMap[e.key]) {
          e.preventDefault();
          const status = statusMap[e.key];
          // Set only this filter
          setStatusFilters([status]);
          if (status === "finalizado") setShowFinished(true);
          setActiveKpiFilter(null);
        }
      }

      // Ctrl/Cmd + K to focus search (always available)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailsSheetOpen, isAptDialogOpen, isCheckinDialogOpen, isCancelDialogOpen, isRescheduleDialogOpen, isAvailabilityDialogOpen, editingAppointment, handleToday, setStatusFilters, setShowFinished, setActiveKpiFilter]);
  const rescheduleForm = useForm({
    defaultValues: {
      date: "",
      startTime: "",
      duration: 30
    }
  });

  useEffect(() => {
    if (selectedAppointmentDetails && isRescheduleDialogOpen) {
      rescheduleForm.reset({
        date: selectedAppointmentDetails.date,
        startTime: selectedAppointmentDetails.startTime,
        duration: selectedAppointmentDetails.duration
      });
    }
  }, [selectedAppointmentDetails, isRescheduleDialogOpen]);

  const onRescheduleSubmit = async (data: any) => {
    if (!selectedAppointmentDetails) return;
    try {
      const warnings = getWarnings({ date: data.date, startTime: data.startTime, duration: data.duration });
      if (warnings.length > 0) {
        const confirmMsg = `Atenção:\n${warnings.map(w => `- ${w}`).join("\n")}\n\nDeseja continuar?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      await updateAppointment.mutateAsync({
        ...selectedAppointmentDetails,
        ...data,
        price: selectedAppointmentDetails.price / 100 // Convert back to display units for onAptSubmit logic if needed, but updateAppointment uses formattedData
      });
      setIsRescheduleDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const AppointmentActionsMenu = ({ appointment, className }: { appointment: AppointmentWithDetails, className?: string }) => {
    const isPaid = (apt: AppointmentWithDetails) => apt.paymentStatus === 'pago';
    if (isReadOnly) return null;

    const handleAction = async (e: React.MouseEvent, action: string) => {
      e.stopPropagation();
      
      let updateData: any = { id: appointment.id };
      
      switch (action) {
        case 'checkin':
          updateData.status = 'presente';
          break;
        case 'start':
          const startCheck = canAction(appointment, "start");
          if (!startCheck.ok) {
            toast({ title: "Ação não permitida", description: startCheck.reason, variant: "destructive" });
            return;
          }
          updateData.status = 'em_atendimento';
          break;
        case 'finish':
          const finishCheck = canAction(appointment, "finish");
          if (!finishCheck.ok) {
            toast({ title: "Ação não permitida", description: finishCheck.reason, variant: "destructive" });
            return;
          }
          updateData.status = 'finalizado';
          break;
      case 'pay':
        const payCheck = canAction(appointment, "markPaid");
        if (!payCheck.ok) {
          toast({ title: "Ação não permitida", description: payCheck.reason, variant: "destructive" });
          return;
        }
        updateData.paymentStatus = 'pago';
        updateData.status = appointment.status; // manter status atual
        break;
      case 'cancel':
        const cancelCheck = canAction(appointment, "cancel");
        if (!cancelCheck.ok) {
          toast({ title: "Ação não permitida", description: cancelCheck.reason, variant: "destructive" });
          return;
        }
        setAppointmentToCancel(appointment);
        setCancelReason("");
        setIsCancelDialogOpen(true);
        return;
        default:
          return;
      }

      updateStatusMutation.mutate(updateData);
    };

    const status = normalizeStatus(appointment.status);
    const paid = isPaid(appointment);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className={className}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Ações de Status */}
          {status !== 'cancelado' && status !== 'finalizado' && (
            <>
              {(status === 'agendado' || status === 'confirmado') && (
                <DropdownMenuItem onClick={(e) => handleAction(e, 'checkin')}>
                  <CheckCircle className="mr-2 h-4 w-4 text-amber-500" />
                  Check-in / Presente
                </DropdownMenuItem>
              )}
              
              {canAction(appointment, 'start').ok && (
                <DropdownMenuItem onClick={(e) => handleAction(e, 'start')}>
                  <Play className="mr-2 h-4 w-4 text-purple-500" />
                  Iniciar atendimento
                </DropdownMenuItem>
              )}

              {canAction(appointment, 'finish').ok && (
                <DropdownMenuItem onClick={(e) => handleAction(e, 'finish')}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Finalizar atendimento
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
            </>
          )}

          {/* Ações de Pagamento */}
          {canAction(appointment, 'markPaid').ok && (
            <DropdownMenuItem onClick={(e) => handleAction(e, 'pay')}>
              <DollarIcon className="mr-2 h-4 w-4 text-emerald-600" />
              Marcar como Pago
            </DropdownMenuItem>
          )}

          {/* Ações de Cancelamento */}
          {canAction(appointment, 'cancel').ok && (
            <>
              {paid && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={(e) => handleAction(e, 'cancel')} className="text-red-600">
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}

          {/* Se estiver cancelado ou finalizado e já estiver pago, mostrar apenas info básica ou nada (como solicitado) */}
          {(status === 'cancelado' || status === 'finalizado') && paid && (
            <DropdownMenuItem disabled className="text-xs italic">
              Nenhuma ação pendente
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const watchDoctorId = aptForm.watch("doctorId");
  const watchDate = aptForm.watch("date");
  const watchStartTime = aptForm.watch("startTime");

  const currentConflict = useMemo(() => {
    if (!watchDoctorId || !watchDate || !watchStartTime) return null;
    return findConflict(watchDate, watchStartTime, watchDoctorId, editingAppointment?.id);
  }, [watchDoctorId, watchDate, watchStartTime, allAppointments, editingAppointment]);

  const timeSuggestions = useMemo(() => {
    if (!currentConflict) return [];
    return getSuggestions(watchDate, watchDoctorId, watchStartTime);
  }, [currentConflict, watchDate, watchDoctorId, watchStartTime, allAppointments]);

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          {/* Linha 1: Título e Ações Principais */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">Agenda Completa</h1>
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {!isReadOnly && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const newShowFinished = !showFinished;
                      setShowFinished(newShowFinished);
                      if (newShowFinished) {
                        if (!statusFilters.includes('finalizado')) {
                          setStatusFilters(prev => [...prev, 'finalizado']);
                        }
                      } else {
                        setStatusFilters(prev => prev.filter(s => s !== 'finalizado'));
                      }
                    }}
                    className="gap-2 whitespace-nowrap"
                  >
                    {showFinished ? "Ocultar finalizados" : `Mostrar finalizados (${allAppointments?.filter(a => String(a.status).toLowerCase().trim() === 'finalizado').length || 0})`}
                  </Button>
                  <Button 
                    onClick={() => {
                      setEditingAppointment(null);
                      // Pré-preenche médico se houver filtro selecionado
                      if (selectedDoctorId) {
                        aptForm.setValue("doctorId", selectedDoctorId);
                      }
                      setIsAptDialogOpen(true);
                    }} 
                    className="gap-2 whitespace-nowrap group relative"
                  >
                    <Plus className="w-4 h-4" /> Agendar Consulta
                    <kbd className="hidden group-hover:inline-flex absolute -top-2 -right-2 h-5 items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500 shadow-sm">
                      N
                    </kbd>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Linha 2: Barra de controles e Chips de status */}
          <div className="flex flex-col gap-3">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-grow min-w-[200px] group">
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar paciente... (Ctrl+K ou /)"
                  className="w-full pl-9 pr-12 bg-white transition-all focus:ring-2 focus:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-patient"
                />
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 group-focus-within:opacity-100 transition-opacity">
                  <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-slate-600">
                    <span className="text-xs">/</span>
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-white border rounded-md p-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const date = parseISO(e.target.value);
                    if (!isNaN(date.getTime())) handleDateChange(date);
                  }}
                  className="w-32 h-8 border-none bg-transparent p-0 text-center focus-visible:ring-0"
                />
                <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={handleToday} className="h-8 px-2 text-xs group relative">
                  Hoje
                  <kbd className="hidden group-hover:inline-flex absolute -top-2 -right-2 h-4 items-center gap-1 rounded border bg-white px-1 font-mono text-[9px] font-medium text-slate-500 shadow-sm">
                    T
                  </kbd>
                </Button>
              </div>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="shrink-0">
                <TabsList className="bg-slate-100 h-9">
                  <TabsTrigger value="calendar" className="gap-2 h-7">
                    <CalendarIcon className="h-4 w-4" />
                    Calendário
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2 h-7">
                    <LayoutList className="h-4 w-4" />
                    Lista
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Select 
                onValueChange={(v) => setSelectedDoctorId(v === "all" ? undefined : Number(v))} 
                value={selectedDoctorId?.toString() || "all"}
              >
                <SelectTrigger className="w-[180px] bg-white h-9 shrink-0">
                  <SelectValue placeholder="Médico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Médicos</SelectItem>
                  {doctors?.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDoctorId && !isReadOnly && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsAvailabilityDialogOpen(true)}
                  className="h-9"
                >
                  Bloquear Agenda
                </Button>
              )}
            </div>

            {/* Chips row */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'agendado', label: 'Agendado' },
                { id: 'confirmado', label: 'Confirmado' },
                { id: 'presente', label: 'Aguardando' },
                { id: 'em_atendimento', label: 'Em Atendimento' },
                { id: 'finalizado', label: 'Finalizado' },
                { id: 'cancelado', label: 'Cancelado' }
              ].map((status, index) => {
                const count = allAppointments?.filter(a => {
                  const s = String(a.status).toLowerCase().trim();
                  return s === status.id;
                }).length || 0;
                return (
                  <Button
                    key={status.id}
                    variant={statusFilters.includes(status.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleStatusFilter(status.id)}
                    className="h-7 rounded-full px-3 text-[11px] font-medium group relative"
                  >
                    {status.label} ({count})
                    <kbd className="hidden group-hover:inline-flex absolute -top-2 -right-1 h-4 items-center gap-1 rounded border bg-white px-1 font-mono text-[8px] font-medium text-slate-500 shadow-sm">
                      {index + 1}
                    </kbd>
                  </Button>
                );
              })}
              <Button
                variant={statusFilters.length === 6 ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilters(["agendado", "confirmado", "presente", "em_atendimento", "finalizado", "cancelado"]);
                  setShowFinished(true);
                  setActiveKpiFilter(null);
                }}
                className="h-7 rounded-full px-3 text-[11px] font-medium group relative"
              >
                Todos
                <kbd className="hidden group-hover:inline-flex absolute -top-2 -right-1 h-4 items-center gap-1 rounded border bg-white px-1 font-mono text-[8px] font-medium text-slate-500 shadow-sm">
                  0
                </kbd>
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isAvailabilityDialogOpen} onOpenChange={setIsAvailabilityDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar Disponibilidade</DialogTitle>
              <DialogDescription>
                Defina um período para bloquear horários e ajustar a agenda.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <DateRangePicker 
                  date={availabilityDateRange}
                  setDate={setAvailabilityDateRange}
                />
              </div>
              <div className="flex gap-4">
                <Button 
                  className="flex-1"
                  variant="destructive"
                  onClick={() => {
                    if (!availabilityDateRange?.from || !selectedDoctorId) return;
                    const dates = eachDayOfInterval({
                      start: availabilityDateRange.from,
                      end: availabilityDateRange.to || availabilityDateRange.from
                    }).map(d => format(d, 'yyyy-MM-dd'));
                    
                    toggleAvailability.mutate({
                      doctorId: selectedDoctorId,
                      dates,
                      isAvailable: false
                    });
                  }}
                  disabled={toggleAvailability.isPending}
                >
                  Fechar Agenda
                </Button>
                <Button 
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    if (!availabilityDateRange?.from || !selectedDoctorId) return;
                    const dates = eachDayOfInterval({
                      start: availabilityDateRange.from,
                      end: availabilityDateRange.to || availabilityDateRange.from
                    }).map(d => format(d, 'yyyy-MM-dd'));
                    
                    toggleAvailability.mutate({
                      doctorId: selectedDoctorId,
                      dates,
                      isAvailable: true
                    });
                  }}
                  disabled={toggleAvailability.isPending}
                >
                  Abrir Agenda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard 
            title="Agendados" 
            value={allAppointments?.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.status === 'agendado').length || 0}
            icon={<CalendarIcon className="h-5 w-5" />}
            description="Para hoje"
            variant="blue"
            onClick={() => handleKpiClick("agendado")}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${activeKpiFilter === 'agendado' ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}`}
          />
          <StatCard 
            title="Em Atendimento" 
            value={allAppointments?.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.status === 'em_atendimento').length || 0}
            icon={<Clock className="h-5 w-5" />}
            description="Neste momento"
            variant="purple"
            onClick={() => handleKpiClick("em_atendimento")}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${activeKpiFilter === 'em_atendimento' ? 'ring-2 ring-purple-500 ring-offset-2 shadow-lg' : ''}`}
          />
          <StatCard 
            title="Finalizados" 
            value={allAppointments?.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.status === 'finalizado').length || 0}
            icon={<CheckCircle2 className="h-5 w-5" />}
            description="Concluídos hoje"
            variant="green"
            onClick={() => handleKpiClick("finalizado")}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${activeKpiFilter === 'finalizado' ? 'ring-2 ring-green-500 ring-offset-2 shadow-lg' : ''}`}
          />
          <StatCard 
            title="Cancelados" 
            value={allAppointments?.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.status === 'cancelado').length || 0}
            icon={<XCircle className="h-5 w-5" />}
            description="Não compareceram"
            variant="red"
            onClick={() => handleKpiClick("cancelado")}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${activeKpiFilter === 'cancelado' ? 'ring-2 ring-red-500 ring-offset-2 shadow-lg' : ''}`}
          />
          <StatCard 
            title="Pendências" 
            value={(pendingPayments?.length || 0) + (pendingTriage?.length || 0)}
            icon={<AlertCircle className="h-5 w-5" />}
            description="Pagamento / Triagem"
            variant="amber"
            onClick={() => handleKpiClick("pendencias")}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${activeKpiFilter === 'pendencias' ? 'ring-2 ring-amber-500 ring-offset-2 shadow-lg' : ''}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm overflow-hidden rounded-3xl">
            <CardContent className="p-0">
              {viewMode === "list" ? (
                <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
                  {(["agendado", "confirmado", "presente", "em_atendimento", "cancelado", "finalizado"] as const).map((status) => {
                    const appointments = groupedAppointments[status] || [];
                    if (appointments.length === 0 && status !== 'finalizado') return null;
                    if (appointments.length === 0 && status === 'finalizado' && !showFinished) return null;

                    const isExpanded = expandedSections[status];

                    return (
                      <div key={status} className="space-y-4">
                        <div 
                          className="flex items-center justify-between cursor-pointer group pb-2 border-b"
                          onClick={() => toggleSection(status)}
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold capitalize">
                              {status.replace('_', ' ')} ({appointments.length})
                            </h3>
                            <StatusBadge status={status} className="scale-75 origin-left" />
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {isExpanded ? <ChevronRight className="h-4 w-4 rotate-90 transition-transform" /> : <ChevronRight className="h-4 w-4 transition-transform" />}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="grid gap-3">
                            {appointments.length === 0 ? (
                              <p className="text-sm text-slate-600 italic pl-2">Nenhum agendamento nesta categoria.</p>
                            ) : (
                              appointments.map((apt) => (
                                <Card 
                                  key={apt.id} 
                                  className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    if (isReadOnly) return;
                                    setSelectedAppointmentDetails(apt);
                                    setIsDetailsSheetOpen(true);
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="flex flex-col items-center justify-center bg-muted rounded-md px-3 py-1 min-w-[80px]">
                                          <span className="text-sm font-bold text-primary">{apt.startTime}</span>
                                          <span className="text-[10px] text-slate-600">{apt.duration} min</span>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="font-medium flex items-center gap-2">
                                            {apt.patient.name}
                                            <StatusBadge status={apt.status} className="h-5 text-[10px]" />
                                          </div>
                                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                            <span className="flex items-center gap-1">
                                              <UserIcon className="h-3 w-3" />
                                              {apt.patient.cpf || "Sem CPF"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <Phone className="h-3 w-3" />
                                              {apt.patient.phone || "Sem Telefone"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <Stethoscope className="h-3 w-3" />
                                              Dr(a). {apt.doctor.name}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0">
                                        <div className="text-right">
                                          <div className="text-sm font-semibold">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(apt.price / 100)}
                                          </div>
                                          <div className="text-[10px] text-slate-600 uppercase">
                                            {apt.paymentStatus === 'pago' ? 'Pago' : 'Pendente'}
                                          </div>
                                        </div>
                                        <AppointmentActionsMenu appointment={apt} />
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6">
                    <FullCalendar
                      ref={calendarRef}
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView="timeGridDay"
                      headerToolbar={false}
                      events={[...filteredEvents, ...backgroundEvents]}
                      slotMinTime="07:00:00"
                      slotMaxTime="20:00:00"
                      allDaySlot={false}
                      height="auto"
                      locale="pt-br"
                      slotLabelFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        omitZeroMinute: false,
                        meridiem: false
                      }}
                      eventContent={(eventInfo) => {
                        if (eventInfo.event.display === "background") return null;

                        const defaultConfig = {
                          bg: "bg-slate-50",
                          border: "border-l-slate-400",
                          text: "text-slate-700",
                        };

                        const config = eventInfo.event.extendedProps?.config ?? defaultConfig;
                        const { event } = eventInfo;
                        const apt = event.extendedProps?.appointment;
                        
                        if (!apt) return null;

                        const isTimeGrid = eventInfo.view.type.includes('timeGrid');
                        
                        return (
                          <div 
                            className={`flex flex-col h-full w-full p-1 border-l-4 rounded-r-md transition-all hover:shadow-md cursor-pointer overflow-hidden group ${config.bg} ${config.border} ${config.text}`}
                            title={`${apt.patient?.name || 'Paciente'} | ${apt.startTime} | Dr. ${apt.doctor?.name || 'Médico'} | ${apt.status}`}
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span className="font-bold text-xs truncate flex-1">{apt.patient?.name || 'Paciente'}</span>
                              <div className="hidden sm:block scale-75 origin-right opacity-80">
                                <StatusBadge status={apt.status} className="h-4 text-[9px] px-1" />
                              </div>
                            </div>
                            
                            {isTimeGrid && (
                              <div className="flex flex-col gap-0.5 mt-0.5 min-w-0">
                                <div className="flex items-center gap-1 text-[10px] opacity-80 whitespace-nowrap overflow-hidden">
                                  <Clock className="h-2.5 w-2.5 shrink-0" />
                                  <span>{apt.startTime} - {format(addMinutes(parseISO(`${apt.date}T${apt.startTime}`), apt.duration), 'HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] opacity-80 whitespace-nowrap overflow-hidden">
                                  <Stethoscope className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">Dr. {apt.doctor?.name || 'Médico'}</span>
                                </div>
                                {apt.price > 0 && (
                                  <div className="hidden md:flex items-center gap-1 text-[10px] font-semibold mt-auto">
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(apt.price / 100)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }}
                      eventClick={(info) => {
                        if (isReadOnly) return;
                        setSelectedAppointmentDetails(info.event.extendedProps.appointment);
                        setIsDetailsSheetOpen(true);
                      }}
                      nowIndicator={true}
                      dayMaxEvents={true}
                      expandRows={true}
                      stickyHeaderDates={true}
                      handleWindowResize={true}
                      editable={true}
                      eventStartEditable={true}
                      eventDurationEditable={false}
                      eventDrop={handleEventDrop}
                      datesSet={(info) => {
                        setViewRange({
                          start: format(info.start, "yyyy-MM-dd"),
                          end: format(subDays(info.end, 1), "yyyy-MM-dd"),
                        });
                      }}
                    />
                </div>
              )}
            </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Novo Card: Hoje */}
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm overflow-hidden rounded-3xl">
              <CardContent className="p-6">
                <h3 className="font-display font-bold text-xl text-slate-900 mb-6 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Hoje
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={handleGoToNow}
                            disabled={viewMode !== "calendar"}
                            data-testid="button-go-to-now"
                          >
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="sr-only">Ir para agora</span>
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{viewMode === "calendar" ? "Ir para agora" : "Disponível no modo Calendário"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h3>
                <div className="space-y-4">
                  {/* Barra de Ocupação */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Ocupação do dia</span>
                      <span className="text-primary font-bold">{dayOccupationMetrics.occupiedPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500 ease-in-out" 
                        style={{ width: `${dayOccupationMetrics.occupiedPercent}%` }}
                      />
                    </div>
                    <div className="flex flex-col gap-y-1 text-[10px] text-slate-500 mt-1">
                      <div className="flex items-center justify-between">
                        <span>{dayOccupationMetrics.occupiedPercent}% ocupado</span>
                        <span>{formatMinutes(dayOccupationMetrics.totalFreeMinutes)} livre</span>
                      </div>
                      <div className="text-center border-t border-slate-100 pt-1 mt-1">
                        maior intervalo {formatMinutes(dayOccupationMetrics.biggestGapMinutes)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Próximo</span>
                    <span className="text-base font-semibold text-slate-900">
                      {nextAppointment 
                        ? `${nextAppointment.startTime} ${nextAppointment.patient.name}` 
                        : "Nenhum"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-y border-slate-50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atrasados</span>
                    <button 
                      onClick={() => setShowOnlyLate(prev => !prev)}
                      className={`text-base font-black px-3 py-1 rounded-xl transition-all hover:scale-105 active:scale-95 ${
                        showOnlyLate 
                          ? "bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-600 ring-offset-2" 
                          : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                      data-testid="button-toggle-late"
                    >
                      {lateAppointments.length}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tempo livre</span>
                    <span className="text-base font-bold text-slate-700">
                      {nextAppointment && productivityData.freeMinutesUntilNext !== null
                        ? `${productivityData.freeMinutesUntilNext} min`
                        : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Novo Bloco: KPIs Operacionais do Dia */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ocupação</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-slate-900">{dayOccupationMetrics.occupiedPercent}%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{formatMinutes(dayOccupationMetrics.totalBookedMinutes)} agendado</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Livre</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-semibold text-slate-700">{formatMinutes(dayOccupationMetrics.totalFreeMinutes)}</span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowOnlyLate(prev => !prev)}
                  className={`h-6 text-[10px] mt-2 px-2 rounded-lg transition-all ${
                    showOnlyLate 
                      ? "bg-red-50 text-red-600 hover:bg-red-100" 
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {showOnlyLate ? "Ver todos" : "Ver atrasados"}
                </Button>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maior Intervalo</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-slate-700">{formatMinutes(dayOccupationMetrics.biggestGapMinutes)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Tempo máximo de vago</p>
              </div>
            </div>

            {/* Novo Card: Timeline do Dia */}
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm overflow-hidden rounded-3xl">
              <CardContent className="p-6">
                <h3 className="font-display font-bold text-xl text-slate-900 mb-6 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Timeline do Dia
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {(showOnlyLate ? lateAppointments : dayAppointments).length > 0 ? (
                    (showOnlyLate ? lateAppointments : dayAppointments).map((apt) => (
                      <div 
                        key={apt.id}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => {
                          setSelectedAppointmentDetails(apt);
                          setIsDetailsSheetOpen(true);
                        }}
                      >
                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg px-2 py-1 min-w-[60px]">
                          <span className="text-xs font-bold text-slate-700">{apt.startTime}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                            {apt.patient.name}
                          </p>
                        </div>
                        <StatusBadge status={apt.status} className="h-5 text-[10px] px-2 shrink-0" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500 italic">Sem consultas neste dia</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm overflow-hidden rounded-3xl">
              <CardContent className="p-6">
                <h3 className="font-display font-bold text-xl text-slate-900 mb-6 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Pendências do Dia
                </h3>
                <Tabs defaultValue="payments">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 rounded-xl p-1">
                    <TabsTrigger value="payments" className="rounded-lg py-2">Pagamentos</TabsTrigger>
                    <TabsTrigger value="triage" className="rounded-lg py-2">Triagem</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="payments" className="space-y-4">
                    {pendingPayments.length > 0 ? (
                      pendingPayments.map((apt) => (
                        <div 
                          key={apt.id}
                          className="p-3 rounded-2xl border border-slate-50 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedAppointmentDetails(apt);
                            setIsDetailsSheetOpen(true);
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              {apt.startTime}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              R$ {(apt.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate group-hover:text-amber-700">
                            {apt.patient.name}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Sem pendências de pagamento hoje</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="triage" className="space-y-4">
                    {pendingTriage.length > 0 ? (
                      pendingTriage.map((apt) => (
                        <div 
                          key={apt.id}
                          className="p-3 rounded-2xl border border-slate-50 hover:border-purple-200 hover:bg-purple-50/30 transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedAppointmentDetails(apt);
                            setIsDetailsSheetOpen(true);
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                              {apt.startTime}
                            </span>
                            <StatusBadge status={apt.status} className="h-4 text-[10px] px-1.5" />
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate group-hover:text-purple-700">
                            {apt.patient.name}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Sem pendências de triagem hoje</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remarcar Agendamento</DialogTitle>
            <DialogDescription>
              Escolha uma nova data e horário para este agendamento.
            </DialogDescription>
          </DialogHeader>
          <Form {...rescheduleForm}>
            <form onSubmit={rescheduleForm.handleSubmit(onRescheduleSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={rescheduleForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={rescheduleForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Novo Horário</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rescheduleForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duração (min)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsRescheduleDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateAppointment.isPending}
                >
                  {updateAppointment.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Confirmar Reagendamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckinDialogOpen} onOpenChange={setIsCheckinDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in do Paciente</DialogTitle>
            <DialogDescription>
              Confirme os dados do paciente e registre o check-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-md space-y-2">
              <p className="text-sm font-medium">Paciente: <span className="font-bold">{selectedAppointmentForCheckin?.patient.name}</span></p>
              <p className="text-sm">CPF: {selectedAppointmentForCheckin?.patient.cpf || 'Não informado'}</p>
              <p className="text-sm">Telefone: {selectedAppointmentForCheckin?.patient.phone || 'Não informado'}</p>
            </div>
            
            <Form {...checkinForm}>
              <form onSubmit={checkinForm.handleSubmit(onCheckinSubmit)} className="space-y-4">
                <FormField
                  control={checkinForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o pagamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="convenio">Convênio</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={checkinForm.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status do pagamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={updateStatusMutation.isPending}>
                  Confirmar Dados e Check-in
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAptDialogOpen} onOpenChange={setIsAptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-800">
              {editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do paciente, médico e detalhes do atendimento.
            </DialogDescription>
          </DialogHeader>
          <Form {...aptForm}>
            <form
              onSubmit={aptForm.handleSubmit(onAptSubmit, () => {
                toast({
                  title: "Campos obrigatórios",
                  description: "Selecione o Paciente e o Médico na aba 'Informações Básicas'.",
                  variant: "destructive",
                });
              })}
              className="space-y-6"
            >
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="payment">Financeiro</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={aptForm.control}
                      name="patientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paciente</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um paciente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {patients?.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aptForm.control}
                      name="doctorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Médico</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um médico" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {doctors?.map(d => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={aptForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <FormField
                          control={aptForm.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Horário</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {currentConflict && (
                          <div className="text-[10px] leading-tight space-y-0.5">
                            <p className="text-destructive font-medium">Indisponível neste horário.</p>
                            {timeSuggestions.length > 0 && (
                              <p className="text-slate-600">
                                Sugestões: {timeSuggestions.join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <FormField
                        control={aptForm.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duração (min)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={aptForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Agendamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="consulta">Consulta</SelectItem>
                              <SelectItem value="retorno">Retorno</SelectItem>
                              <SelectItem value="exame">Exame</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {aptForm.watch("type") === "exame" && (
                      <FormField
                        control={aptForm.control}
                        name="examType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Exame</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Hemograma" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={aptForm.control}
                    name="procedure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Procedimento</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Limpeza, Canal, etc." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={aptForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Notas adicionais sobre o agendamento..." 
                            className="resize-none"
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="payment" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={aptForm.control}
                      name="isPrivate"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) {
                                  aptForm.setValue("insurance", "");
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Particular</FormLabel>
                            <FormDescription>
                              Sem uso de convênio
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aptForm.control}
                      name="insurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Convênio</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Nome do convênio" 
                              {...field} 
                              value={field.value || ""} 
                              disabled={aptForm.watch("isPrivate")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={aptForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aptForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="agendado">Agendado</SelectItem>
                              <SelectItem value="confirmado">Confirmado</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex gap-2 pt-4 border-t">
                {editingAppointment && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => {
                      if (confirm("Deseja realmente excluir este agendamento?")) {
                        deleteAppointment.mutate(editingAppointment.id);
                      }
                    }}
                    disabled={deleteAppointment.isPending}
                  >
                    Excluir
                  </Button>
                )}
                <Button 
                  type="submit" 
                  className="flex-[2]" 
                  disabled={createAppointment.isPending || updateAppointment.isPending || !!currentConflict}
                >
                  {(createAppointment.isPending || updateAppointment.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  {editingAppointment ? "Salvar Alterações" : "Criar Agendamento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

        {/* Dialog de Cancelamento com Motivo */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-bold text-slate-900">Cancelar agendamento</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento para registrar no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Motivo (obrigatório)</label>
              <Textarea 
                placeholder="Descreva o motivo do cancelamento..." 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="min-h-[100px] rounded-xl resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} className="rounded-xl">
              Voltar
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl"
              disabled={!cancelReason.trim() || updateStatusMutation.isPending}
              onClick={async () => {
                if (!appointmentToCancel) return;
                const now = format(new Date(), 'yyyy-MM-dd HH:mm');
                const reasonEntry = `\nCancelado em ${now}: ${cancelReason.trim()}`;
                
                // Usar updateAppointment para salvar as notas e o status
                try {
                  await updateAppointment.mutateAsync({
                    ...appointmentToCancel,
                    status: 'cancelado',
                    notes: (appointmentToCancel.notes || "") + reasonEntry,
                    price: appointmentToCancel.price / 100 // Manter consistência de unidade
                  });
                  setIsCancelDialogOpen(false);
                  setAppointmentToCancel(null);
                  setIsDetailsSheetOpen(false); // Fechar drawer se estiver aberto
                } catch (error) {
                  // Erro já tratado pela mutation
                }
              }}
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-0">
          {selectedAppointmentDetails && (
            <div className="flex flex-col h-full">
              {/* Header Premium */}
              <div className="p-6 pb-4 border-b bg-white sticky top-0 z-10">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-slate-900 truncate" title={selectedAppointmentDetails.patient.name}>
                      {selectedAppointmentDetails.patient.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AppTooltip label={TOOLTIP.appointment.status}>
                      <div className="inline-flex">
                        <StatusBadge status={selectedAppointmentDetails.status} />
                      </div>
                    </AppTooltip>
                    <DropdownMenu>
                      <AppTooltip label={TOOLTIP.appointment.more}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </AppTooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          const text = `Paciente: ${selectedAppointmentDetails.patient.name}\nData: ${format(parseISO(selectedAppointmentDetails.date), "dd/MM/yyyy")}\nHora: ${selectedAppointmentDetails.startTime}\nMédico: Dr(a). ${selectedAppointmentDetails.doctor.name}`;
                          navigator.clipboard.writeText(text);
                          toast({ title: "Copiado", description: "Dados do agendamento copiados" });
                        }}>
                          <Copy className="mr-2 h-4 w-4" /> Copiar dados
                        </DropdownMenuItem>
                        {selectedAppointmentDetails.patient.phone && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(selectedAppointmentDetails.patient.phone!);
                            toast({ title: "Copiado", description: "Telefone copiado" });
                          }}>
                            <Phone className="mr-2 h-4 w-4" /> Copiar telefone
                          </DropdownMenuItem>
                        )}
                        {selectedAppointmentDetails.patient.cpf && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(selectedAppointmentDetails.patient.cpf!);
                            toast({ title: "Copiado", description: "CPF copiado" });
                          }}>
                            <FileText className="mr-2 h-4 w-4" /> Copiar CPF
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-600 font-medium">
                    {format(parseISO(selectedAppointmentDetails.date), "EEE, dd/MM", { locale: ptBR })} • {selectedAppointmentDetails.startTime}–{format(addMinutes(parseISO(`${selectedAppointmentDetails.date}T${selectedAppointmentDetails.startTime}`), selectedAppointmentDetails.duration), 'HH:mm')}
                  </p>
                  <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                    Dr(a). {selectedAppointmentDetails.doctor.name}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mt-6">
                  {canAction(selectedAppointmentDetails, "start").ok && (
                    <AppTooltip label={TOOLTIP.appointment.start}>
                      <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 gap-1.5 flex-1"
                        onClick={() => updateStatusMutation.mutate({ id: selectedAppointmentDetails.id, status: 'em_atendimento' })}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Iniciar
                      </Button>
                    </AppTooltip>
                  )}
                  {canAction(selectedAppointmentDetails, "finish").ok && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 gap-1.5 flex-1"
                      onClick={() => updateStatusMutation.mutate({ id: selectedAppointmentDetails.id, status: 'finalizado' })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                    </Button>
                  )}
                  {canAction(selectedAppointmentDetails, "markPaid").ok && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 gap-1.5 flex-1"
                      onClick={() => updateStatusMutation.mutate({ id: selectedAppointmentDetails.id, status: selectedAppointmentDetails.status, paymentStatus: 'pago' })}
                    >
                      <DollarSign className="h-3.5 w-3.5" /> Pagar
                    </Button>
                  )}
                  <AppTooltip label={TOOLTIP.appointment.reschedule}>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`gap-1.5 flex-1 ${!canAction(selectedAppointmentDetails, "reschedule").ok ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={canAction(selectedAppointmentDetails, "reschedule").reason || ""}
                      onClick={() => {
                        const check = canAction(selectedAppointmentDetails, "reschedule");
                        if (!check.ok) {
                          toast({ title: "Ação não permitida", description: check.reason, variant: "destructive" });
                          return;
                        }
                        setIsRescheduleDialogOpen(true);
                      }}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" /> Remarcar
                    </Button>
                  </AppTooltip>
                  <AppTooltip label={TOOLTIP.appointment.cancel}>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`text-red-600 border-red-100 hover:bg-red-50 gap-1.5 flex-1 ${!canAction(selectedAppointmentDetails, "cancel").ok ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={canAction(selectedAppointmentDetails, "cancel").reason || ""}
                      onClick={() => {
                        const check = canAction(selectedAppointmentDetails, "cancel");
                        if (!check.ok) {
                          toast({ title: "Ação não permitida", description: check.reason, variant: "destructive" });
                          return;
                        }
                        setAppointmentToCancel(selectedAppointmentDetails);
                        setCancelReason("");
                        setIsCancelDialogOpen(true);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </AppTooltip>
                </div>
              </div>

              <div className="flex-1 p-6 space-y-6">
                {/* Tabs Navigation */}
                <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                  {(["resumo", "pagamento", "triagem", "historico"] as const).map((tab) => {
                    const labels: Record<string, string> = {
                      resumo: TOOLTIP.appointment.tabSummary,
                      pagamento: TOOLTIP.appointment.tabPayment,
                      triagem: TOOLTIP.appointment.tabTriage,
                      historico: TOOLTIP.appointment.tabHistory
                    };
                    return (
                      <AppTooltip key={tab} label={labels[tab] || ""}>
                        <button
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize ${
                            activeTab === tab
                              ? "bg-white text-primary shadow-sm"
                              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                          }`}
                        >
                          {tab === "historico" ? "Histórico" : tab}
                        </button>
                      </AppTooltip>
                    );
                  })}
                </div>

                {activeTab === "resumo" && (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paciente</h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {selectedAppointmentDetails.patient.cpf && (
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                              <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">CPF</p>
                                <p className="font-medium text-slate-900">{selectedAppointmentDetails.patient.cpf}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                              <CalendarIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">Idade</p>
                              <p className="font-medium text-slate-900">
                                {selectedAppointmentDetails.patient.birthDate ? (() => {
                                  const birthDate = new Date(selectedAppointmentDetails.patient.birthDate);
                                  const today = new Date();
                                  let age = today.getFullYear() - birthDate.getFullYear();
                                  const m = today.getMonth() - birthDate.getMonth();
                                  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
                                  return `${age} anos`;
                                })() : "Não informada"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contato</h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                        {selectedAppointmentDetails.patient.phone && (
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-sm min-w-0">
                              <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                <Phone className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">WhatsApp / Telefone</p>
                                <p className="font-medium text-slate-900 truncate">{selectedAppointmentDetails.patient.phone}</p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs bg-green-50 border-green-100 text-green-700 hover:bg-green-100 hover:text-green-800"
                              onClick={() => {
                                const clean = selectedAppointmentDetails.patient.phone!.replace(/\D/g, '');
                                let final = clean;
                                if (clean.length === 11 && !clean.startsWith('55')) final = '55' + clean;
                                window.open(`https://wa.me/${final}`, '_blank');
                              }}
                            >
                              WhatsApp
                            </Button>
                          </div>
                        )}
                        {(selectedAppointmentDetails.patient as any).email && (
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">E-mail</p>
                              <p className="font-medium text-slate-900">{(selectedAppointmentDetails.patient as any).email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    {selectedAppointmentDetails.notes && (
                      <section className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Observações</h3>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm italic text-slate-700 leading-relaxed">
                          {selectedAppointmentDetails.notes}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {activeTab === "pagamento" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financeiro</h3>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Valor da consulta:</span>
                        <span className="font-bold text-xl text-slate-900">
                          {(selectedAppointmentDetails.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <Separator className="bg-slate-200/50" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Status do pagamento:</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          selectedAppointmentDetails.paymentStatus === 'pago' 
                            ? "bg-green-100 text-green-700" 
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {selectedAppointmentDetails.paymentStatus === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      {(selectedAppointmentDetails as any).paymentMethod && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">Forma de pagamento:</span>
                          <span className="text-sm font-semibold capitalize text-slate-700">{(selectedAppointmentDetails as any).paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "triagem" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Triagem Clínica</h3>
                    {(selectedAppointmentDetails as any).triageDone ? (
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Triagem Finalizada
                        </div>
                        {(selectedAppointmentDetails as any).triageData && (
                          <div className="text-sm text-slate-600 bg-white p-3 rounded-xl border border-slate-100 font-mono text-xs">
                            {JSON.stringify((selectedAppointmentDetails as any).triageData, null, 2)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-10 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
                        <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle className="h-6 w-6 text-amber-500" />
                        </div>
                        <p className="font-bold text-slate-900">Aguardando Triagem</p>
                        <p className="text-xs text-slate-500 px-4">O paciente deve passar pela triagem antes do atendimento médico.</p>
                      </div>
                    )}
                  </section>
                )}

                {activeTab === "historico" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Atendimentos</h3>
                    <div className="space-y-2">
                      {allAppointments
                        ?.filter(apt => apt.patientId === selectedAppointmentDetails.patientId)
                        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
                        .slice(0, 8)
                        .map(apt => (
                          <div 
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointmentDetails(apt);
                              setActiveTab("resumo");
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                              apt.id === selectedAppointmentDetails.id 
                                ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" 
                                : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${apt.id === selectedAppointmentDetails.id ? "text-primary" : "text-slate-600"}`}>
                                  {format(parseISO(apt.date), "dd/MM")} • {apt.startTime}
                                </span>
                                {apt.id === selectedAppointmentDetails.id && (
                                  <span className="text-[8px] bg-primary text-white px-1 py-0 rounded font-black uppercase">Atual</span>
                                )}
                              </div>
                              <StatusBadge status={apt.status} className="h-4 text-[8px] px-1.5 font-black" />
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 min-w-0">
                              <Stethoscope className="h-3 w-3 shrink-0" /> 
                              <span className="truncate">Dr(a). {apt.doctor.name}</span>
                            </p>
                          </div>
                        ))}
                    </div>
                  </section>
                )}

                <div className="pt-6">
                  <Button 
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-slate-600 font-bold py-6 rounded-2xl"
                    ref={closeDetailsButtonRef}
                    onClick={() => setIsDetailsSheetOpen(false)}
                  >
                    Fechar Detalhes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </LayoutShell>
  );
}
