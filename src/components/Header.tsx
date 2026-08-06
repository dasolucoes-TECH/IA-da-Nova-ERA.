import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Sun, Moon, Bell, User, LogOut, Menu, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { SidebarContent, navItems } from '@/components/Sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function Header({ onOpenCommand }: { onOpenCommand: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [isDark, setIsDark] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const currentItem = navItems.find((i) => i.path === location.pathname) || {
    label: 'Dashboard',
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-[#071B3B]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 md:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-700 dark:text-slate-200"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Nova Era AI</span>
            <span>/</span>
            <span className="text-[#071B3B] dark:text-slate-200 font-semibold">
              {currentItem.label}
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight hidden sm:block">
            {currentItem.label}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="outline"
          onClick={onOpenCommand}
          className="hidden sm:flex items-center gap-3 h-9 px-3 text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Buscar ações ou páginas...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-slate-200 dark:bg-white/10 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-300">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-transform active:scale-90"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
          >
            <Bell className="w-4 h-4" />
          </Button>
          <Badge className="absolute top-1 right-1 h-2 w-2 p-0 bg-[#FFC400] rounded-full border border-white dark:border-[#071B3B]" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 pl-2 pr-1 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Avatar className="h-7 w-7 border border-amber-400/50">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-[#071B3B] text-[#FFC400] text-xs font-bold">
                  {user?.name?.substring(0, 2)?.toUpperCase() || 'AD'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden md:inline-block">
                {user?.name || 'Administrador'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
            <DropdownMenuLabel className="text-xs font-normal text-slate-500">
              Conectado como{' '}
              <strong className="font-semibold block text-slate-900">{user?.email}</strong>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/ia')}>
              <Sparkles className="mr-2 h-4 w-4 text-[#FFC400]" />
              <span>Assistente IA</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair da Conta</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
