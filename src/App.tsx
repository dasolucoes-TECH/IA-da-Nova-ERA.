import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from './components/Layout'

import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import Shopify from './pages/Shopify'
import Marketing from './pages/Marketing'
import InstagramPage from './pages/Instagram'
import SeoPage from './pages/Seo'
import AnalyticsPage from './pages/AnalyticsPage'
import BannersPage from './pages/BannersPage'
import IaPage from './pages/IaPage'
import Configuracoes from './pages/Configuracoes'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/shopify" element={<Shopify />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/instagram" element={<InstagramPage />} />
            <Route path="/seo" element={<SeoPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/banners" element={<BannersPage />} />
            <Route path="/ia" element={<IaPage />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
