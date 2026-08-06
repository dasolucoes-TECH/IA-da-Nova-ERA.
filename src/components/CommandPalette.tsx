import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  PlusCircle,
  SunMoon,
} from 'lucide-react'

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const runCommand = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Digite um comando ou busque uma página..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Navegação Rápida">
          <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-[#FFC400]" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/produtos'))}>
            <Package className="mr-2 h-4 w-[#FFC400]" />
            <span>Produtos</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/shopify'))}>
            <ShoppingBag className="mr-2 h-4 w-[#FFC400]" />
            <span>Loja Shopify</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/marketing'))}>
            <Megaphone className="mr-2 h-4 w-[#FFC400]" />
            <span>Marketing e Campanhas</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/instagram'))}>
            <Instagram className="mr-2 h-4 w-[#FFC400]" />
            <span>Instagram Studio IA</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/seo'))}>
            <Search className="mr-2 h-4 w-[#FFC400]" />
            <span>SEO Inteligente</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/analytics'))}>
            <BarChart3 className="mr-2 h-4 w-[#FFC400]" />
            <span>Analytics & BI</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/banners'))}>
            <ImageIcon className="mr-2 h-4 w-[#FFC400]" />
            <span>Banners e Mídias</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/ia'))}>
            <Bot className="mr-2 h-4 w-[#FFC400]" />
            <span>Assistente IA</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/configuracoes'))}>
            <Settings className="mr-2 h-4 w-[#FFC400]" />
            <span>Configurações</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ações Inteligentes">
          <CommandItem onSelect={() => runCommand(() => navigate('/produtos?novo=true'))}>
            <PlusCircle className="mr-2 h-4 w-green-500" />
            <span>Cadastrar Novo Produto com IA</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/banners'))}>
            <ImageIcon className="mr-2 h-4 w-blue-500" />
            <span>Criar Banner Promocional</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => document.documentElement.classList.toggle('dark'))}
          >
            <SunMoon className="mr-2 h-4 w-purple-500" />
            <span>Alternar Tema Claro / Escuro</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
