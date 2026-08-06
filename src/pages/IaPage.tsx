import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendAgentMessage } from '@/services/ai'
import { toast } from '@/components/ui/use-toast'

const chips = [
  'Cadastre este produto',
  'Crie um banner',
  'Crie um post',
  'Analise minhas vendas',
  'Crie uma promoção',
  'Atualize os preços',
  'Responder dúvidas',
]

export default function IaPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    [],
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (textToSend?: string) => {
    const msg = textToSend || input
    if (!msg.trim()) return

    const newMsgs = [...messages, { role: 'user' as const, content: msg }]
    setMessages(newMsgs)
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage(msg, conversationId)
      if (res.conversation_id) setConversationId(res.conversation_id)
      setMessages([...newMsgs, { role: 'assistant', content: res.content }])
    } catch (e: any) {
      toast({ title: 'Erro ao conversar com a IA', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assistente Nova Era IA</h1>
        <p className="text-xs text-slate-500">
          Agente autônomo conectado aos dados da sua loja Shopify.
        </p>
      </div>

      <Card className="flex-1 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B] flex flex-col overflow-hidden">
        <CardContent className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto my-auto">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#FFC400] to-amber-300 flex items-center justify-center text-[#071B3B] font-black text-2xl shadow-xl shadow-[#FFC400]/20">
                ⚡
              </div>
              <div>
                <h2 className="text-xl font-bold">O que deseja fazer?</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione uma ação rápida ou digite sua pergunta para o assistente da loja.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(chip)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-[#FFC400] hover:text-[#071B3B] transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[#FFC400] text-[#071B3B] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    ⚡
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl text-xs max-w-xl leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#071B3B] text-white dark:bg-[#FFC400] dark:text-[#071B3B] font-medium'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium animate-pulse">
              <Sparkles className="w-4 h-4 text-[#FFC400]" />
              <span>O Assistente Nova Era está pensando...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ou peça uma ação para a IA..."
              className="rounded-xl bg-white dark:bg-[#071B3B]"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
