/**
 * MediFlow — Design Tokens (Institucional / Hospitalar)
 * Use este arquivo como fonte única de verdade para cores, tipografia e padrões de UI.
 * Observação: as cores do Tailwind/Shadcn são alimentadas por CSS variables definidas em `client/src/index.css`.
 */

export const colors = {
  primary600: "#1D4ED8",
  primary700: "#1E40AF",
  primary800: "#1E3A8A",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",

  textPrimary: "#0F172A",
  textSecondary: "#475569",

  success: "#16A34A",
  successSoft: "#DCFCE7",

  warning: "#CA8A04",
  warningSoft: "#FEF3C7",

  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
} as const;

export const typography = {
  fontSans: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  fontDisplay: "Plus Jakarta Sans, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",

  h1: "text-3xl font-semibold",
  h2: "text-2xl font-semibold",
  h3: "text-xl font-medium",
  body: "text-sm text-slate-600",
  label: "text-sm font-medium",
} as const;

/** Padrões de espaçamento (8pt grid). */
export const spacing = {
  cardPadding: "p-4",
  sectionPadding: "p-6",
  sectionGap: "gap-6",
} as const;

export const radii = {
  card: "rounded-2xl",
  input: "rounded-xl",
  button: "rounded-xl",
} as const;

/**
 * Classes utilitárias recomendadas (para consistência visual).
 * Pode usar direto via `className={ui.card}` etc.
 */
export const ui = {
  card: "bg-white border border-slate-200 rounded-2xl shadow-sm",
  input:
    "bg-slate-50 border border-slate-300 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:border-blue-600",
  buttonPrimary:
    "bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-4 py-2 transition-colors",
  buttonSecondary:
    "bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl px-4 py-2 transition-colors",
  sidebar:
    "bg-white border-r border-slate-200 text-slate-900",
  sidebarItemActive:
    "bg-blue-50 text-blue-700",
  sidebarItemHover:
    "hover:bg-slate-100",
} as const;
