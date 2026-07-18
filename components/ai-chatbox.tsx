'use client'

import { FormEvent, useMemo, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { aiApi, type AiChatMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

type ChatMessage = AiChatMessage & {
  id: string
}

const starterMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Xin chào, mình là trợ lý BadmintonHub. Bạn có thể hỏi về đặt sân, lịch cố định, đổi lịch, thanh toán, check-in hoặc cách dùng hệ thống.',
  },
]

const defaultQuickReplies = [
  'Cách đặt sân thường?',
  'Lịch cố định hoạt động thế nào?',
  'Cách đổi lịch cố định?',
  'Thanh toán và check-in ra sao?',
]

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AiChatbox() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickReplies, setQuickReplies] = useState(defaultQuickReplies)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const apiHistory = useMemo<AiChatMessage[]>(
    () =>
      messages
        .filter((message) => message.id !== 'welcome')
        .slice(-8)
        .map(({ role, content }) => ({ role, content })),
    [messages],
  )

  const submit = async (value?: string) => {
    const text = (value ?? input).trim()
    if (!text || loading) return

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
    }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await aiApi.chat(text, apiHistory)
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content: response.reply,
        },
      ])
      if (response.quickReplies?.length) setQuickReplies(response.quickReplies)
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content:
            error?.message ||
            'Mình chưa kết nối được trợ lý AI. Bạn thử lại sau ít phút nhé.',
        },
      ])
    } finally {
      setLoading(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit()
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[520px] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/18">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-[#0A2416] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Trợ lý BadmintonHub</p>
              <p className="text-xs text-white/70">Hỏi nhanh về đặt sân và hệ thống</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Đóng trợ lý"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'bg-[#0A2416] text-white'
                      : 'border border-slate-200 bg-white text-slate-700',
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang trả lời...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  disabled={loading}
                  onClick={() => void submit(reply)}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#FF6B35]/50 hover:bg-[#FF6B35]/10 disabled:opacity-50"
                >
                  {reply}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submit()
                  }
                }}
                placeholder="Nhập câu hỏi..."
                className="max-h-28 min-h-11 resize-none rounded-xl text-sm"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl bg-[#FF6B35] text-white hover:bg-[#e85f2f]"
                disabled={loading || !input.trim()}
                aria-label="Gửi câu hỏi"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6B35] text-white shadow-xl shadow-orange-600/30 transition-transform hover:scale-105"
        aria-label="Mở trợ lý BadmintonHub"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
