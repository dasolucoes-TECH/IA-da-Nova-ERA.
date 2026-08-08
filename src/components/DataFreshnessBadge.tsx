import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type FreshnessState = 'fresh' | 'recent' | 'stale' | 'unavailable'

export function DataFreshnessBadge({ lastSync }: { lastSync?: string | null }) {
  const [state, setState] = useState<FreshnessState>('unavailable')
  const [label, setLabel] = useState('Dados indisponíveis')

  useEffect(() => {
    if (!lastSync) {
      setState('unavailable')
      setLabel('Dados indisponíveis')
      return
    }

    const syncDate = new Date(lastSync)
    const minutesAgo = Math.floor((Date.now() - syncDate.getTime()) / 60000)

    if (minutesAgo < 1) {
      setState('fresh')
      setLabel('Atualizado agora')
    } else if (minutesAgo < 30) {
      setState('recent')
      setLabel(`Sincronizado há ${minutesAgo} min`)
    } else if (minutesAgo < 1440) {
      setState('stale')
      setLabel(`Sincronizado há ${Math.floor(minutesAgo / 60)}h`)
    } else {
      setState('stale')
      setLabel('Desatualizado — sincronize novamente')
    }
  }, [lastSync])

  const config = {
    fresh: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
    recent: { icon: Clock, color: 'text-blue-500 bg-blue-50 border-blue-200' },
    stale: { icon: AlertTriangle, color: 'text-amber-500 bg-amber-50 border-amber-200' },
    unavailable: { icon: XCircle, color: 'text-slate-400 bg-slate-50 border-slate-200' },
  }

  const { icon: Icon, color } = config[state]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border',
        color,
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  )
}
