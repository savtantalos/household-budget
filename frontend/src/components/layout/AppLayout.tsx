import { Outlet, useLocation } from 'react-router'
import { useBudgetContext } from '@/BudgetContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { navItemFor } from '@/nav'
import { AppSidebar } from './AppSidebar'
import { PageTransition } from './PageTransition'
import { SaveStatus } from './SaveStatus'
import { ThemeToggle } from './ThemeToggle'

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const { data, loading, error, settings, settingsStatus } = useBudgetContext()
  const page = navItemFor(pathname)
  const ready = data !== null && settings !== null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-transparent md:peer-data-[variant=inset]:bg-background/60 md:peer-data-[variant=inset]:shadow-card md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-border/60">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b border-border/60 bg-background/70 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold tracking-tight">{page.label}</h1>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {page.description}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SaveStatus />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertTitle>Could not reach the API.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!ready && (loading || settingsStatus === 'loading') && <LoadingSkeleton />}
          {ready && (
            <PageTransition>
              <Outlet />
            </PageTransition>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
