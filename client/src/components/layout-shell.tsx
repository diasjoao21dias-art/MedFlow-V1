import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Stethoscope, 
  LogOut, 
  UserCircle,
  Menu,
  X,
  Building2,
  ClipboardList,
  FileText,
  Calculator
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { AppTooltip } from "./ui/app-tooltip";
import { TOOLTIP } from "@/constants/tooltips";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar relative">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
