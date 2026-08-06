import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/components/ui/use-toast'

export default function Configuracoes() {
  const { user } = useAuth()
  const [storeName, setStoreName] = useState('Nova Era AI Store')

  const handleSave = () => {
    toast({ title: 'Configurações salvas!' })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Conta e Loja</h1>
        <p className="text-xs text-slate-500">Gerencie preferências gerais do sistema.</p>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold">Perfil do Lojista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="rounded-xl bg-slate-50" />
          </div>
          <div>
            <Label>Nome da Loja</Label>
            <Input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            onClick={handleSave}
            className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
          >
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
