import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SidebarContent } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { CommandPalette } from '@/components/CommandPalette'

export default function Layout() {
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] dark:bg-[#050D1F] text-slate-900 dark:text-slate-100 transition-colors">
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-40 border-r border-white/10 shadow-xl">
        <SidebarContent />
      </aside>

      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header onOpenCommand={() => setCommandOpen(true)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>

        <footer className="py-4 px-6 border-t border-slate-200 dark:border-white/5 text-center text-xs text-slate-400">
          Nova Era AI v0.0.1 — Plataforma SaaS Inteligente para Shopify &copy;{' '}
          {new Date().getFullYear()}
        </footer>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
