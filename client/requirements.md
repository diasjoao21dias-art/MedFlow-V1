## Packages
recharts | For dashboard analytics charts (revenue, appointment stats)
react-big-calendar | For the appointment scheduler view
moment | Required peer dependency for react-big-calendar
framer-motion | For smooth page transitions and micro-interactions
lucide-react | Icon system (already in base but vital)
clsx | Utility for conditional classes
tailwind-merge | Utility for merging tailwind classes

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["'Inter'", "sans-serif"],
  display: ["'Outfit'", "sans-serif"],
}
Authentication uses cookie-based sessions.
Role-based access control (RBAC) required for routes.
