'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, MessageCircle, Send, Users } from 'lucide-react'
import {
  communityApi,
  type CommunityChatMessage,
  type CommunityChatRoom,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityAvatar } from '@/components/community/primitives'

export default function CommunityChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Đang mở chat...</div>}>
      <CommunityChatContent />
    </Suspense>
  )
}

function CommunityChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const requestedRoomId = searchParams.get('room')
  const [rooms, setRooms] = useState<CommunityChatRoom[]>([])
  const [activeRoomId, setActiveRoomId] = useState(requestedRoomId || '')
  const [messages, setMessages] = useState<CommunityChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role === 'guest') {
      router.replace('/login')
      return
    }

    let mounted = true
    setLoadingRooms(true)
    communityApi
      .getChatRooms()
      .then((res) => {
        if (!mounted) return
        setRooms(res.rooms)
        setActiveRoomId((current) => current || requestedRoomId || res.rooms[0]?.id || '')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingRooms(false)
      })

    return () => {
      mounted = false
    }
  }, [requestedRoomId, router, user])

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([])
      return
    }

    let mounted = true
    async function loadMessages(showSpinner = false) {
      if (showSpinner) setLoadingMessages(true)
      try {
        const res = await communityApi.getChatMessages(activeRoomId)
        if (mounted) setMessages(res.messages)
      } finally {
        if (mounted && showSpinner) setLoadingMessages(false)
      }
    }

    loadMessages(true)
    const timer = window.setInterval(() => loadMessages(false), 3500)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [activeRoomId])

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) || null,
    [rooms, activeRoomId],
  )

  async function handleSend() {
    const body = draft.trim()
    if (!activeRoomId || !body || sending) return
    setSending(true)
    try {
      const res = await communityApi.sendChatMessage(activeRoomId, body)
      if (res.success && res.message) {
        setMessages((current) => [...current, res.message!])
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Community chat</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold">Nhóm chat kèo sân</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khi chủ kèo duyệt bạn vào kèo, nhóm chat chung của kèo sẽ xuất hiện ở đây.
        </p>
      </div>

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
            <MessageCircle className="size-4 text-primary" />
            Phòng chat của bạn
          </div>
          {loadingRooms ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang tải phòng...
            </div>
          ) : rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Bạn chưa có nhóm chat nào. Hãy xin tham gia kèo và chờ chủ kèo duyệt.
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-visible">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveRoomId(room.id)}
                  className={cn(
                    'min-w-[260px] rounded-2xl border p-3 text-left transition-colors lg:min-w-0 lg:w-full',
                    activeRoomId === room.id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{room.title}</p>
                    <span className="inline-flex items-center gap-1 text-xs opacity-80">
                      <Users className="size-3.5" />
                      {room.memberCount}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs opacity-75">
                    {room.latestMessage?.body || room.match?.slot || 'Chưa có tin nhắn'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-[560px] flex-col rounded-3xl border border-border bg-card">
          {activeRoom ? (
            <>
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-3">
                  {activeRoom.type === 'private' && activeRoom.otherPlayer ? (
                    <CommunityAvatar
                      src={activeRoom.otherPlayer.avatar}
                      name={activeRoom.otherPlayer.name}
                      size={40}
                      className="size-10"
                    />
                  ) : null}
                  <div>
                    <h2 className="font-heading text-xl font-semibold">{activeRoom.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeRoom.type === 'private'
                        ? 'Chat riêng 1-1'
                        : `${activeRoom.match?.court || ''} · ${activeRoom.match?.slot || ''}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải tin nhắn...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Chưa có tin nhắn. Bắt đầu chào team của bạn nào.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex gap-2', message.mine ? 'justify-end' : 'justify-start')}
                    >
                      {!message.mine ? (
                        <CommunityAvatar src={message.sender.avatar} name={message.sender.name} size={30} className="size-8" />
                      ) : null}
                      <div
                        className={cn(
                          'max-w-[78%] rounded-2xl px-3 py-2 text-sm',
                          message.mine
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground',
                        )}
                      >
                        {!message.mine ? (
                          <p className="mb-0.5 text-[11px] font-semibold opacity-80">{message.sender.name}</p>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className="mt-1 text-[10px] opacity-70">{message.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        handleSend()
                      }
                    }}
                    rows={2}
                    placeholder="Nhập tin nhắn..."
                    className="min-h-12 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
              Chọn một nhóm chat để bắt đầu.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
