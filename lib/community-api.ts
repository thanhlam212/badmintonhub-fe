import { apiFetch, getToken } from '@/lib/api'
import { io, type Socket } from 'socket.io-client'

export type CommunityLevel = 'Mới chơi' | 'Trung bình' | 'Khá' | 'Nâng cao'
export type CommunityDistrict = 'Cầu Giấy' | 'Thanh Xuân' | 'Long Biên'
export type CommunityPostKind = 'Chia sẻ' | 'Tìm đội' | 'Check-in' | 'Review sân' | 'Mẹo chơi'
export type CommunityNotificationKind = 'like' | 'comment' | 'follow' | 'match' | 'reminder'
export type CommunityMatchStatus = 'open' | 'full' | 'closed' | 'cancelled' | 'completed' | 'expired'
export type CommunityParticipationStatus = 'requested' | 'joined' | 'rejected' | 'left'
export type CommunityFriendshipStatus = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'

export interface CommunityPlayer {
  username: string
  name: string
  avatar: string
  level: CommunityLevel
  district: CommunityDistrict | ''
  bio: string
  followers: number
  following: number
  matches: number
  checkins: number
  postsCount?: number
  cover: string
  friendshipStatus?: CommunityFriendshipStatus
}

export interface CommunityComment {
  id: string
  body: string
  time: string
  likes: number
  author: CommunityPlayer
}

export interface CommunityPost {
  id: string
  kind: CommunityPostKind
  body: string
  time: string
  createdAt: string
  images: string[]
  tags: string[]
  court: string
  district: CommunityDistrict | ''
  level: CommunityLevel | ''
  likes: number
  saves: number
  commentsCount: number
  comments: CommunityComment[]
  author: CommunityPlayer
}

export interface CommunityMatch {
  id: string
  title: string
  createdAt?: string
  status?: CommunityMatchStatus
  statusLabel?: string
  district: CommunityDistrict
  court: string
  level: CommunityLevel
  date: string
  slot: string
  filled: number
  needed: number
  pricePerPerson?: number
  price: string
  note: string
  joined?: boolean
  requested?: boolean
  canJoin?: boolean
  expired?: boolean
  isHost?: boolean
  roomId?: string | null
  pendingParticipants?: number
  participants?: CommunityMatchParticipant[]
  host: CommunityPlayer
}

export interface CommunityMatchParticipant {
  userId: string
  status: CommunityParticipationStatus
  requestedAt?: string
  player: CommunityPlayer
}

export interface CommunityChatMessage {
  id: string
  roomId: string
  senderId?: string
  body: string
  createdAt: string
  time: string
  mine?: boolean
  pending?: boolean
  clientTempId?: string
  sender: CommunityPlayer
}

export interface CommunityChatRoom {
  id: string
  type?: 'match' | 'private'
  title: string
  matchId: string | null
  memberCount: number
  match: CommunityMatch | null
  otherPlayer?: CommunityPlayer | null
  latestMessage: CommunityChatMessage | null
}

export interface CommunityTagTrend {
  tag: string
  count: string
}

export interface CommunityUpcomingSession {
  court: string
  time: string
  label: string
}

export interface CommunityNotification {
  id: string
  kind: CommunityNotificationKind
  text: string
  time: string
  unread: boolean
  link: string
  actor: CommunityPlayer | null
}

export interface CommunityLandingResponse {
  featuredPlayers: CommunityPlayer[]
  featuredPosts: CommunityPost[]
  activeMatches: CommunityMatch[]
}

export interface CommunityFeedResponse {
  posts: CommunityPost[]
  trendingTags: CommunityTagTrend[]
  suggestedPlayers: CommunityPlayer[]
  upcomingSessions: CommunityUpcomingSession[]
}

export interface CommunityProfileResponse {
  player: CommunityPlayer
  posts: CommunityPost[]
  checkins: CommunityPost[]
  hostedMatches: CommunityMatch[]
  savedPosts: CommunityPost[]
}

export interface CommunityPostDetailResponse {
  post: CommunityPost
  relatedPosts: CommunityPost[]
}

export interface CommunityMatchesResponse {
  matches: CommunityMatch[]
}

export interface CommunityNotificationsResponse {
  notifications: CommunityNotification[]
}

export interface CommunityPlayersResponse {
  players: CommunityPlayer[]
}

export interface CommunityFriendshipItem {
  id: string
  status: string
  direction: 'incoming' | 'outgoing'
  player: CommunityPlayer
}

export interface CommunityFriendsResponse {
  friends: CommunityFriendshipItem[]
  incomingRequests: CommunityFriendshipItem[]
  outgoingRequests: CommunityFriendshipItem[]
}

export interface CommunityChatRoomsResponse {
  rooms: CommunityChatRoom[]
}

export interface CommunityChatMessagesResponse {
  messages: CommunityChatMessage[]
}

export interface CommunityChatMessagesQuery {
  after?: string
  limit?: number
}

export interface CommunityChatSocketEvents {
  'chat:new_message': (payload: { roomId: string; message: CommunityChatMessage; clientTempId?: string | null }) => void
  'chat:error': (payload: { message?: string }) => void
}

export interface CommunityChatJoinAck {
  ok: boolean
  roomId: string
  messages: CommunityChatMessage[]
}

function getCommunitySocketUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  return apiUrl.replace(/\/api\/?$/, '')
}

export interface CreateCommunityPostPayload {
  kind: CommunityPostKind
  body: string
  district?: CommunityDistrict
  level?: CommunityLevel
  branch_id?: number
  court_id?: number
  image_urls?: string[]
  tags?: string[]
}

export interface CreateCommunityMatchPayload {
  booking_id: string
  title: string
  level: CommunityLevel
  current_players: number
  needed_players: number
  price_per_person: number
  note?: string
}

export const communityApi = {
  getLanding: async (): Promise<CommunityLandingResponse> => {
    const res = await apiFetch<CommunityLandingResponse>('/community/landing')
    return (res.data as CommunityLandingResponse) || { featuredPlayers: [], featuredPosts: [], activeMatches: [] }
  },

  getFeed: async (kind?: string): Promise<CommunityFeedResponse> => {
    const query = kind ? `?kind=${encodeURIComponent(kind)}` : ''
    const res = await apiFetch<CommunityFeedResponse>(`/community/feed${query}`)
    return (
      (res.data as CommunityFeedResponse) || {
        posts: [],
        trendingTags: [],
        suggestedPlayers: [],
        upcomingSessions: [],
      }
    )
  },

  getProfile: async (username: string): Promise<CommunityProfileResponse | null> => {
    const res = await apiFetch<CommunityProfileResponse>(`/community/players/${encodeURIComponent(username)}`)
    return (res.data as CommunityProfileResponse) || null
  },

  getPlayers: async (filters?: { q?: string; district?: string; level?: string }): Promise<CommunityPlayersResponse> => {
    const params = new URLSearchParams()
    if (filters?.q) params.set('q', filters.q)
    if (filters?.district) params.set('district', filters.district)
    if (filters?.level) params.set('level', filters.level)
    const query = params.toString()
    const res = await apiFetch<CommunityPlayersResponse>(`/community/players${query ? `?${query}` : ''}`)
    return (res.data as CommunityPlayersResponse) || { players: [] }
  },

  getFriends: async (): Promise<CommunityFriendsResponse> => {
    const res = await apiFetch<CommunityFriendsResponse>('/community/friends')
    return (res.data as CommunityFriendsResponse) || { friends: [], incomingRequests: [], outgoingRequests: [] }
  },

  sendFriendRequest: async (username: string) => {
    const res = await apiFetch<{ friendshipStatus: CommunityFriendshipStatus }>(`/community/friends/${encodeURIComponent(username)}/request`, {
      method: 'POST',
    })
    return { success: res.success, friendshipStatus: res.data?.friendshipStatus || 'none', error: res.message }
  },

  acceptFriendRequest: async (username: string) => {
    const res = await apiFetch<{ friendshipStatus: CommunityFriendshipStatus }>(`/community/friends/${encodeURIComponent(username)}/accept`, {
      method: 'PATCH',
    })
    return { success: res.success, friendshipStatus: res.data?.friendshipStatus || 'none', error: res.message }
  },

  rejectFriendRequest: async (username: string) => {
    const res = await apiFetch<{ friendshipStatus: CommunityFriendshipStatus }>(`/community/friends/${encodeURIComponent(username)}/reject`, {
      method: 'PATCH',
    })
    return { success: res.success, friendshipStatus: res.data?.friendshipStatus || 'none', error: res.message }
  },

  getPostDetail: async (id: string): Promise<CommunityPostDetailResponse | null> => {
    const res = await apiFetch<CommunityPostDetailResponse>(`/community/posts/${id}`)
    return (res.data as CommunityPostDetailResponse) || null
  },

  getMatches: async (filters?: { district?: string; level?: string; slot?: string }): Promise<CommunityMatchesResponse> => {
    const params = new URLSearchParams()
    if (filters?.district) params.set('district', filters.district)
    if (filters?.level) params.set('level', filters.level)
    if (filters?.slot) params.set('slot', filters.slot)
    const query = params.toString()
    const res = await apiFetch<CommunityMatchesResponse>(`/community/matches${query ? `?${query}` : ''}`)
    return (res.data as CommunityMatchesResponse) || { matches: [] }
  },

  getNotifications: async (): Promise<CommunityNotificationsResponse> => {
    const res = await apiFetch<CommunityNotificationsResponse>('/community/notifications')
    return (res.data as CommunityNotificationsResponse) || { notifications: [] }
  },

  markAllNotificationsRead: async () => {
    return apiFetch('/community/notifications/read-all', { method: 'PATCH' })
  },

  markNotificationRead: async (id: string) => {
    return apiFetch(`/community/notifications/${id}/read`, { method: 'PATCH' })
  },

  createPost: async (payload: CreateCommunityPostPayload) => {
    const res = await apiFetch<CommunityPost>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { success: res.success, post: (res.data as CommunityPost) || null, error: res.message }
  },

  togglePostLike: async (id: string) => {
    const res = await apiFetch<{ liked: boolean; likes: number }>(`/community/posts/${id}/like`, { method: 'POST' })
    return { success: res.success, ...(res.data || {}), error: res.message }
  },

  togglePostSave: async (id: string) => {
    const res = await apiFetch<{ saved: boolean; saves: number }>(`/community/posts/${id}/save`, { method: 'POST' })
    return { success: res.success, ...(res.data || {}), error: res.message }
  },

  addComment: async (postId: string, body: string) => {
    const res = await apiFetch<{ comment: CommunityComment; commentsCount: number }>(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    return { success: res.success, ...(res.data || {}), error: res.message }
  },

  toggleFollow: async (username: string) => {
    const res = await apiFetch<{ following: boolean; followers: number }>(`/community/players/${encodeURIComponent(username)}/follow`, {
      method: 'POST',
    })
    return { success: res.success, ...(res.data || {}), error: res.message }
  },

  createMatch: async (payload: CreateCommunityMatchPayload) => {
    const res = await apiFetch<CommunityMatch>('/community/matches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { success: res.success, match: (res.data as CommunityMatch) || null, error: res.message }
  },

  joinMatch: async (id: string) => {
    const res = await apiFetch<{ joined: boolean; requested?: boolean; match: CommunityMatch }>(`/community/matches/${id}/join`, {
      method: 'POST',
    })
    return { success: res.success, ...(res.data || {}), error: res.message }
  },

  getMatchParticipants: async (id: string) => {
    const res = await apiFetch<{ participants: CommunityMatchParticipant[] }>(`/community/matches/${id}/participants`)
    return { success: res.success, participants: res.data?.participants || [], error: res.message }
  },

  approveMatchParticipant: async (matchId: string, userId: string) => {
    const res = await apiFetch<{ match: CommunityMatch }>(`/community/matches/${matchId}/participants/${userId}/approve`, {
      method: 'PATCH',
    })
    return { success: res.success, match: res.data?.match || null, error: res.message }
  },

  rejectMatchParticipant: async (matchId: string, userId: string) => {
    const res = await apiFetch<{ success: boolean }>(`/community/matches/${matchId}/participants/${userId}/reject`, {
      method: 'PATCH',
    })
    return { success: res.success, error: res.message }
  },

  getChatRooms: async (): Promise<CommunityChatRoomsResponse> => {
    const res = await apiFetch<CommunityChatRoomsResponse>('/community/chat/rooms')
    if (!res.success) throw new Error(res.message || 'Khong tai duoc phong chat')
    return (res.data as CommunityChatRoomsResponse) || { rooms: [] }
  },

  startPrivateChat: async (username: string) => {
    const res = await apiFetch<{ room: CommunityChatRoom }>(`/community/chat/private/${encodeURIComponent(username)}`, {
      method: 'POST',
    })
    return { success: res.success, room: res.data?.room || null, error: res.message }
  },

  getChatMessages: async (roomId: string, query?: CommunityChatMessagesQuery): Promise<CommunityChatMessagesResponse> => {
    const params = new URLSearchParams()
    if (query?.after) params.set('after', query.after)
    if (query?.limit) params.set('limit', String(query.limit))
    const suffix = params.size ? `?${params.toString()}` : ''
    const res = await apiFetch<CommunityChatMessagesResponse>(`/community/chat/rooms/${roomId}/messages${suffix}`)
    if (!res.success) throw new Error(res.message || 'Khong tai duoc tin nhan')
    return (res.data as CommunityChatMessagesResponse) || { messages: [] }
  },

  sendChatMessage: async (roomId: string, body: string) => {
    const res = await apiFetch<{ message: CommunityChatMessage }>(`/community/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    return { success: res.success, message: res.data?.message || null, error: res.message }
  },

  updateProfile: async (payload: { avatar_url?: string; cover_image_url?: string }) => {
    const res = await apiFetch<{ player: CommunityPlayer }>('/community/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    return { success: res.success, player: res.data?.player || null, error: res.message }
  },

  uploadImage: async (file: File) => {
    const token = getToken()
    const form = new FormData()
    form.append('image', file)

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/community/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    })
    const json = await response.json()
    if (!response.ok) {
      const message = Array.isArray(json.message) ? json.message[0] : json.message
      return { success: false, error: message || 'Upload thất bại', url: '' }
    }
    const data = json?.success ? json.data : json
    return { success: true, url: data?.url || '' }
  },
}

export function createCommunityChatSocket(): Socket<CommunityChatSocketEvents, Record<string, never>> | null {
  const token = getToken()
  if (!token) return null

  return io(`${getCommunitySocketUrl()}/community-chat`, {
    transports: ['websocket'],
    auth: { token },
  })
}
