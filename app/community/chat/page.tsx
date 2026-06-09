'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, MessageCircle, Send, Users, Wifi, WifiOff } from 'lucide-react'
import { type Socket } from 'socket.io-client'
import {
  communityApi,
  createCommunityChatSocket,
  type CommunityChatJoinAck,
  type CommunityChatMessage,
  type CommunityChatRoom,
  type CommunityChatSocketEvents,
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
  const [refreshingMessages, setRefreshingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<Socket<CommunityChatSocketEvents, Record<string, never>> | null>(null)
  const activeRoomIdRef = useRef(activeRoomId)
  const lastMessageAtRef = useRef('')
  const joinedRoomRef = useRef('')
  const lastResumeSyncAtRef = useRef(0)

  function normalizeMessage(message: CommunityChatMessage): CommunityChatMessage {
    const mineById = message.senderId && user?.id ? message.senderId === user.id : undefined
    const mineByUsername =
      message.sender?.username && user?.username
        ? message.sender.username === user.username
        : undefined

    return {
      ...message,
      mine: mineById ?? mineByUsername ?? Boolean(message.mine),
    }
  }

  function mergeMessages(
    current: CommunityChatMessage[],
    incoming: CommunityChatMessage[],
    clientTempId?: string | null,
  ) {
    if (!incoming.length) return current
    const merged = [...current]

    for (const rawMessage of incoming) {
      const message = normalizeMessage(rawMessage)
      const byIdIndex = merged.findIndex((item) => item.id === message.id)
      if (byIdIndex >= 0) {
        merged[byIdIndex] = { ...merged[byIdIndex], ...message, pending: false }
        continue
      }

      const byTempIndex = clientTempId
        ? merged.findIndex((item) => item.clientTempId === clientTempId)
        : message.clientTempId
          ? merged.findIndex((item) => item.clientTempId === message.clientTempId)
          : -1

      if (byTempIndex >= 0) {
        merged[byTempIndex] = {
          ...merged[byTempIndex],
          ...message,
          pending: false,
          clientTempId: clientTempId || message.clientTempId,
        }
        continue
      }

      merged.push({ ...message, pending: false })
    }

    merged.sort((left, right) => {
      const leftAt = new Date(left.createdAt).getTime()
      const rightAt = new Date(right.createdAt).getTime()
      return leftAt - rightAt
    })
    return merged
  }

  function scrollToBottom(force = false) {
    const container = messageListRef.current
    if (!container) return

    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120

    if (force || nearBottom) {
      window.requestAnimationFrame(() => {
        const node = messageListRef.current
        if (node) node.scrollTop = node.scrollHeight
      })
    }
  }

  function syncRoomLatestMessage(roomId: string, latestMessage: CommunityChatMessage) {
    setRooms((current) => {
      const normalizedLatestMessage = normalizeMessage(latestMessage)
      const next = current.map((room) =>
        room.id === roomId ? { ...room, latestMessage: normalizedLatestMessage } : room,
      )

      next.sort((left, right) => {
        const leftAt = new Date(left.latestMessage?.createdAt || 0).getTime()
        const rightAt = new Date(right.latestMessage?.createdAt || 0).getTime()
        return rightAt - leftAt
      })

      return next
    })
  }

  async function loadMessagesByHttp(roomId: string, options?: { incremental?: boolean; forceFull?: boolean }) {
    const incremental = options?.incremental ?? false
    const forceFull = options?.forceFull ?? false

    if (incremental) setRefreshingMessages(true)
    else setLoadingMessages(true)

    try {
      const res = await communityApi.getChatMessages(
        roomId,
        incremental && !forceFull && lastMessageAtRef.current
          ? { after: lastMessageAtRef.current, limit: 100 }
          : { limit: 100 },
      )

      if (incremental) {
        setMessages((current) => {
          const merged = mergeMessages(current, res.messages)
          const latest = merged[merged.length - 1]
          if (latest) {
            lastMessageAtRef.current = latest.createdAt
            syncRoomLatestMessage(roomId, latest)
          }
          return merged
        })
        if (res.messages.length) scrollToBottom()
        return
      }

      const normalizedMessages = res.messages.map(normalizeMessage)
      setMessages(normalizedMessages)
      const latest = normalizedMessages[normalizedMessages.length - 1]
      lastMessageAtRef.current = latest?.createdAt || ''
      if (latest) syncRoomLatestMessage(roomId, latest)
      scrollToBottom(true)
    } finally {
      if (incremental) setRefreshingMessages(false)
      else setLoadingMessages(false)
    }
  }

  async function joinActiveRoom(roomId: string) {
    if (!roomId) {
      setMessages([])
      joinedRoomRef.current = ''
      lastMessageAtRef.current = ''
      return
    }

    const socket = socketRef.current
    if (socket?.connected) {
      const socketClient = socket as Socket<any, any>
      if (joinedRoomRef.current && joinedRoomRef.current !== roomId) {
        socketClient.emit('chat:leave_room', { roomId: joinedRoomRef.current })
      }

      setLoadingMessages(true)
      try {
        const response = (await socketClient.emitWithAck('chat:join_room', {
          roomId,
        })) as CommunityChatJoinAck | undefined

        if (response?.ok) {
          joinedRoomRef.current = roomId
          const normalizedMessages = (response.messages || []).map(normalizeMessage)
          setMessages(normalizedMessages)
          const latest = normalizedMessages[normalizedMessages.length - 1]
          lastMessageAtRef.current = latest?.createdAt || ''
          if (latest) syncRoomLatestMessage(roomId, latest)
          scrollToBottom(true)
          return
        }
      } catch {
        // Fall back to HTTP below.
      } finally {
        setLoadingMessages(false)
      }
    }

    await loadMessagesByHttp(roomId, { forceFull: true })
  }

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId
  }, [activeRoomId])

  async function loadChatRooms(preferredRoomId?: string) {
    const res = await communityApi.getChatRooms()
    setRooms(res.rooms)
    setActiveRoomId((current) => {
      const requested = preferredRoomId || requestedRoomId || current
      if (requested && res.rooms.some((room) => room.id === requested)) {
        return requested
      }
      return res.rooms[0]?.id || ''
    })
    return res.rooms
  }

  function selectRoom(roomId: string) {
    setActiveRoomId(roomId)
    router.replace(`/community/chat?room=${encodeURIComponent(roomId)}`, { scroll: false })
  }

  useEffect(() => {
    if (!user) return
    if (user.role === 'guest') {
      router.replace('/login')
      return
    }

    let mounted = true
    setLoadingRooms(true)
    loadChatRooms(requestedRoomId || undefined)
      .finally(() => {
        if (!mounted) return
        setLoadingRooms(false)
      })

    return () => {
      mounted = false
    }
  }, [requestedRoomId, router, user])

  useEffect(() => {
    if (!requestedRoomId || requestedRoomId === activeRoomId) return
    setActiveRoomId(requestedRoomId)
  }, [requestedRoomId, activeRoomId])

  useEffect(() => {
    if (!user || user.role === 'guest') return

    const socket = createCommunityChatSocket()
    socketRef.current = socket
    if (!socket) return

    const handleConnect = () => {
      setSocketConnected(true)
      const roomId = activeRoomIdRef.current
      if (roomId) {
        joinActiveRoom(roomId).catch(() => {})
      }
    }

    const handleDisconnect = () => {
      setSocketConnected(false)
    }

    const handleChatError = () => {
      setSocketConnected(false)
    }

    const handleNewMessage: CommunityChatSocketEvents['chat:new_message'] = ({ roomId, message, clientTempId }) => {
      syncRoomLatestMessage(roomId, message)
      if (roomId !== activeRoomIdRef.current) return

      setMessages((current) => {
        const merged = mergeMessages(current, [message], clientTempId)
        const latest = merged[merged.length - 1]
        if (latest) lastMessageAtRef.current = latest.createdAt
        return merged
      })
      scrollToBottom()
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('chat:error', handleChatError)
    socket.on('chat:new_message', handleNewMessage)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('chat:error', handleChatError)
      socket.off('chat:new_message', handleNewMessage)
      socket.disconnect()
      socketRef.current = null
      joinedRoomRef.current = ''
      setSocketConnected(false)
    }
  }, [user])

  useEffect(() => {
    joinActiveRoom(activeRoomId).catch(() => {})
  }, [activeRoomId])

  useEffect(() => {
    if (!user || user.role === 'guest') return

    let mounted = true
    const roomTimer = window.setInterval(async () => {
      try {
        const res = await communityApi.getChatRooms()
        if (!mounted) return
        setRooms(res.rooms)
        setActiveRoomId((current) => {
          const requested = requestedRoomId || current
          if (requested && res.rooms.some((room) => room.id === requested)) {
            return requested
          }
          return res.rooms[0]?.id || ''
        })
      } catch {
        // Keep current list until next refresh.
      }
    }, 10000)

    const syncTimer = window.setInterval(async () => {
      const roomId = activeRoomIdRef.current
      if (!roomId) return
      if (socketConnected && lastMessageAtRef.current) return
      await loadMessagesByHttp(roomId, {
        incremental: Boolean(lastMessageAtRef.current),
        forceFull: !lastMessageAtRef.current,
      }).catch(() => {})
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(roomTimer)
      window.clearInterval(syncTimer)
    }
  }, [requestedRoomId, socketConnected, user])

  useEffect(() => {
    if (!user || user.role === 'guest') return

    const refreshAfterResume = async () => {
      const now = Date.now()
      if (now - lastResumeSyncAtRef.current < 1500) return
      lastResumeSyncAtRef.current = now

      const roomId = activeRoomIdRef.current
      await loadChatRooms(roomId || undefined).catch(() => {})
      if (roomId) {
        await loadMessagesByHttp(roomId, { forceFull: true }).catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAfterResume().catch(() => {})
      }
    }

    const handlePageShow = () => {
      refreshAfterResume().catch(() => {})
    }

    window.addEventListener('focus', handlePageShow)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('online', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handlePageShow)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('online', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, requestedRoomId])

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) || null,
    [rooms, activeRoomId],
  )

  async function handleSend() {
    const body = draft.trim()
    if (!activeRoomId || !body || sending) return

    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticMessage: CommunityChatMessage = {
      id: clientTempId,
      roomId: activeRoomId,
      senderId: user?.id,
      body,
      createdAt: new Date().toISOString(),
      time: 'Đang gửi...',
      mine: true,
      pending: true,
      clientTempId,
      sender: {
        username: user?.username || 'me',
        name: user?.fullName || user?.username || 'Bạn',
        avatar: '',
        level: 'Trung bình',
        district: '',
        bio: '',
        followers: 0,
        following: 0,
        matches: 0,
        checkins: 0,
        cover: '',
      },
    }

    setMessages((current) => mergeMessages(current, [optimisticMessage], clientTempId))
    syncRoomLatestMessage(activeRoomId, optimisticMessage)
    setDraft('')
    scrollToBottom(true)
    setSending(true)
    try {
      const socket = socketRef.current
      if (socket?.connected) {
        const socketClient = socket as Socket<any, any>
        const response = (await socketClient.emitWithAck('chat:send_message', {
          roomId: activeRoomId,
          message: body,
          clientTempId,
        })) as { message?: CommunityChatMessage; clientTempId?: string } | undefined

        const message = response?.message as CommunityChatMessage | undefined
        if (message) {
          setMessages((current) => {
            const merged = mergeMessages(current, [message], response?.clientTempId || clientTempId)
            const latest = merged[merged.length - 1]
            if (latest) lastMessageAtRef.current = latest.createdAt
            return merged
          })
          syncRoomLatestMessage(activeRoomId, message)
          scrollToBottom(true)
          return
        }
      }

      const res = await communityApi.sendChatMessage(activeRoomId, body)
      if (res.success && res.message) {
        setMessages((current) => {
          const merged = mergeMessages(current, [res.message!], clientTempId)
          const latest = merged[merged.length - 1]
          if (latest) lastMessageAtRef.current = latest.createdAt
          return merged
        })
        syncRoomLatestMessage(activeRoomId, res.message)
        scrollToBottom(true)
      } else {
        setMessages((current) =>
          current.map((message) =>
            message.clientTempId === clientTempId
              ? { ...message, pending: false, time: 'Gửi thất bại' }
              : message,
          ),
        )
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
          Chat ưu tiên WebSocket và tự động đồng bộ lại lịch sử để tránh mất tin nhắn.
        </p>
      </div>

      <div className="grid gap-4 lg:min-h-[620px] lg:grid-cols-[320px_minmax(0,1fr)]">
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
                  onClick={() => selectRoom(room.id)}
                  className={cn(
                    'min-w-[220px] rounded-2xl border p-3 text-left transition-colors sm:min-w-[260px] lg:min-w-0 lg:w-full',
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

        <section className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card sm:h-[calc(100dvh-15rem)] lg:min-h-[560px] lg:h-auto">
          {activeRoom ? (
            <>
              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between gap-3">
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
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {refreshingMessages ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Đồng bộ
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-1',
                        socketConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {socketConnected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                      {socketConnected ? 'WebSocket on' : 'Chế độ dự phòng'}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={messageListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải tin nhắn...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Chưa có tin nhắn. Bắt đầu chào mọi người nào.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex gap-2', message.mine ? 'justify-end' : 'justify-start')}
                    >
                      {!message.mine ? (
                        <CommunityAvatar
                          src={message.sender.avatar}
                          name={message.sender.name}
                          size={30}
                          className="size-8"
                        />
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
                        <p className="mt-1 text-[10px] opacity-70">
                          {message.pending ? 'Đang gửi...' : message.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border bg-card/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
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
                    className="min-h-12 max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
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
