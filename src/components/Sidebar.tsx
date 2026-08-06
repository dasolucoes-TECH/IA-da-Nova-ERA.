import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Megaphone,
  Instagram,
  Search,
  BarChart3,
  Image as ImageIcon,
  Bot,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Produtos', icon: Package, path: '/produtos' },
  { label: 'Shopify', icon: ShoppingBag, path: '/shopify' },
  { label: 'Marketing', icon: Megaphone, path: '/marketing' },
  { label: 'Instagram', icon: Instagram, path: '/instagram' },
  { label: 'SEO', icon: Search, path: '/seo' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Banners', icon: ImageIcon, path: '/banners' },
  { label: 'IA', icon: Bot, path: '/ia' },
  { label: 'Configurações', icon: Settings, path: '/configuracoes' },
]

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <div className="flex flex-col h-full bg-[#071B3B] text-white">
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FFC400] to-amber-300 flex items-center justify-center text-[#071B3B] font-extrabold text-lg shadow-md shadow-[#FFC400]/20">
          ⚡
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#FFC400] bg-clip-text text-transparent">
            Nova Era AI
          </span>
          <span className="text-[10px] block text-amber-400 font-semibold tracking-wider uppercase">
            Shopify OS
          </span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                isActive
                  ? 'bg-white/10 text-white font-semibold shadow-inner'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FFC400] rounded-r-full shadow-[0_0_8px_#FFC400]" />
              )}
              <Icon
                className={cn(
                  'w-4 h-4 transition-transform duration-200 group-hover:scale-110',
                  isActive ? 'text-[#FFC400]' : 'text-slate-400 group-hover:text-slate-200',
                )}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link
          to="/ia"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-[#FFC400] to-amber-400 hover:from-amber-400 hover:to-[#FFC400] text-[#071B3B] font-bold text-xs rounded-xl shadow-lg shadow-[#FFC400]/20 transition-all duration-200 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 fill-[#071B3B]" />
          <span>Fale com a IA</span>
        </Link>
      </div>
    </div>
  )
}
