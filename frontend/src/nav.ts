import {
  Banknote,
  Home,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  Receipt,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    description: 'Monthly overview, settlement and spending breakdown.',
    icon: LayoutDashboard,
  },
  {
    to: '/income',
    label: 'Income',
    description: 'Salaries, other income and person-to-person transfers.',
    icon: Banknote,
  },
  {
    to: '/expenses',
    label: 'Expenses',
    description: 'Every monthly cost, shared or personal.',
    icon: Receipt,
  },
  {
    to: '/savings',
    label: 'Savings',
    description: 'Savings plans, account balances and the growth simulator.',
    icon: PiggyBank,
  },
  {
    to: '/investments',
    label: 'Investments',
    description: 'Holdings, projected growth and invest-vs-overpay.',
    icon: TrendingUp,
  },
  {
    to: '/mortgage',
    label: 'Mortgage',
    description: 'Overpayments, lump sums and interest saved.',
    icon: Home,
  },
  {
    to: '/chat',
    label: 'Chat',
    description: 'Ask questions about your budget.',
    icon: MessageSquare,
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Theme, household, categories, split mode and chart colours.',
    icon: Settings,
  },
]

export function navItemFor(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => item.to === pathname) ?? NAV_ITEMS[0]
}
