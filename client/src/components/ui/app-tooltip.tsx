import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AppTooltipProps {
  label: string
  children: React.ReactNode
}

export function AppTooltip({ label, children }: AppTooltipProps) {
  const [isHoverable, setIsHoverable] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover)")
    setIsHoverable(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsHoverable(e.matches)
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  if (!isHoverable) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
