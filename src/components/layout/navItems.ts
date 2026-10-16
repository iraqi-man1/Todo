import { CalendarDays, ChartColumn, LayoutGrid, Settings, SquareCheckBig, type LucideIcon } from 'lucide-react'
import type { RouteName } from '@/store/ui'

export const NAV_ITEMS: { name: RouteName; icon: LucideIcon; key: string }[] = [
  { name: 'today', icon: SquareCheckBig, key: '1' },
  { name: 'wall', icon: LayoutGrid, key: '2' },
  { name: 'calendar', icon: CalendarDays, key: '3' },
  { name: 'stats', icon: ChartColumn, key: '4' },
  { name: 'settings', icon: Settings, key: '5' },
]
