import * as React from "react";
import { 
  Calendar, 
  Home, 
  Inbox, 
  Search, 
  Settings, 
  Users, 
  Building2, 
  Clock, 
  UserPlus, 
  Activity,
  FileText,
  Package,
  CreditCard,
  Calculator,
  KeyRound,
  LogOut
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/use-auth"
import { Link, useLocation } from "wouter"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query";
import { Clinic } from "@shared/schema";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  operator: "Recepção",
  doctor: "Médico",
  nurse: "Enfermagem",
  super_admin: "Super Admin",
};

export function AppSidebar() {
  const { user, logout } = useAuth()
  const { data: clinic } = useQuery<Clinic>({
    queryKey: ["/api/clinic/me"],
    enabled: !!user,
  });
  const [location] = useLocation()
  const logoutMutation = React.useCallback(() => {
    logout()
  }, [logout]);

  const receptionItems = React.useMemo(() => [
    { title: "Dashboard", url: "/reception/dashboard", icon: Activity },
    { title: "Agenda", url: "/reception/schedule", icon: Calendar },
    { title: "Pacientes", url: "/reception/patients", icon: UserPlus },
    { title: "Check-in", url: "/reception/checkin", icon: Clock },
  ], []);

  const doctorItems = React.useMemo(() => [
    { title: "Dashboard", url: "/doctor/dashboard", icon: Activity },
    { title: "Minha Agenda", url: "/doctor/appointments", icon: Calendar },
    { title: "Prescrições", url: "/doctor/prescriptions", icon: FileText },
    { title: "Calculadoras", url: "/doctor/calculators", icon: Calculator },
  ], []);

  const adminItems = React.useMemo(() => [
    { title: "Usuários", url: "/admin/users", icon: Users },
    { title: "Dashboard Executivo", url: "/admin/executive", icon: Activity },
    { title: "Estoque", url: "/admin/inventory", icon: Package },
    { title: "Faturamento", url: "/admin/billing", icon: CreditCard },
    { title: "Configurações", url: "/admin/clinic", icon: Settings },
    { title: "Licença", url: "/admin/license", icon: KeyRound },
  ], []);

  const nurseItems = React.useMemo(() => [
    { title: "Dashboard", url: "/nurse/dashboard", icon: Activity },
    { title: "Agenda", url: "/reception/schedule", icon: Calendar },
  ], []);

  const menuItems = React.useMemo(() => {
    if (!user) return [];
    
    // Admin sees everything
    if (user.role === 'admin') {
      return [...receptionItems, ...adminItems];
    }
    
    // Super admin role (if present) behaves like admin in single-tenant installs
    if (user.role === 'super_admin') {
      return [...receptionItems, ...adminItems];
    }
    
    // Doctor
    if (user.role === 'doctor') {
      return doctorItems;
    }
    
    // Nurse
    if (user.role === 'nurse') {
      return nurseItems;
    }
    
    // Operator (Reception)
    if (user.role === 'operator') {
      return receptionItems;
    }

    return [];
  }, [user?.role, doctorItems, receptionItems, nurseItems, adminItems]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex flex-row items-center gap-2 border-b">
        {clinic?.logoUrl ? (
          <img src={clinic.logoUrl} alt={clinic.name} className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="font-bold text-sm leading-none truncate">{clinic?.name || "MediFlow"}</span>
          <span className="text-xs text-muted-foreground mt-1">Gestão de Clínica</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user?.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">{user?.name}</span>
            <span className="text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] || user.role : ""}</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 h-9" 
          onClick={logoutMutation}
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
