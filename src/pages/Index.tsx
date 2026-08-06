import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export default function Index() {
  const { signIn, signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('dasolucoestst@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [name, setName] = useState('')

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isSignUp) {
      const { error } = await signUp(email, password, name)
      if (error) {
        toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Conta criada!', description: 'Bem-vindo ao Nova Era AI.' })
        navigate('/dashboard')
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        toast({
          title: 'Erro no login',
          description: 'Credenciais inválidas.',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Login realizado com sucesso' })
        navigate('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#071B3B] text-white">
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#071B3B] via-[#0b275c] to-[#050D1F]">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#FFC400]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFC400] to-amber-300 flex items-center justify-center text-[#071B3B] font-extrabold text-xl shadow-lg shadow-[#FFC400]/20">
            ⚡
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">Nova Era AI</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 py-1 px-3 rounded-full bg-white/10 text-amber-300 text-xs font-semibold backdrop-blur-md border border-white/10">
            <Sparkles className="w-3.5 h-3.5 fill-amber-300" />
            O Sistema Operacional IA para E-commerce
          </div>
          <h1 className="text-4xl font-black tracking-tight leading-tight">
            Administre sua loja Shopify com inteligência autônoma.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Cadastre produtos com IA, gere copies de conversão para Instagram, otimize SEO e
            acompanhe seus dados de vendas em uma única plataforma integrada.
          </p>

          <div className="space-y-3 pt-4">
            {[
              'Cadastro Inteligente de Produtos em segundos',
              'Gerador de Campanhas e Banners com IA',
              'Analytics em Tempo Real e Previsão de Estoque',
              'Assistente IA integrado às suas coleções',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#FFC400] flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Nova Era AI — Todos os direitos reservados.
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-[#F7F8FA] dark:bg-[#050D1F] text-slate-900 dark:text-slate-100">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white dark:bg-[#071B3B] rounded-2xl overflow-hidden p-2">
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold tracking-tight">
                {isSignUp ? 'Criar sua conta' : 'Entrar no painel'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSignUp
                  ? 'Preencha seus dados para acessar a plataforma'
                  : 'Digite suas credenciais de acesso'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Seu Nome</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Carlos Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@sualoja.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#FFC400] to-amber-400 text-[#071B3B] font-bold hover:from-amber-400 hover:to-[#FFC400] rounded-xl shadow-md transition-all duration-200"
              >
                {loading ? (
                  'Aguarde...'
                ) : (
                  <span className="flex items-center gap-2">
                    {isSignUp ? 'Cadastrar' : 'Entrar no Sistema'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#071B3B] dark:hover:text-[#FFC400] transition-colors"
              >
                {isSignUp ? 'Já possui uma conta? Faça Login' : 'Não tem uma conta? Crie agora'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
