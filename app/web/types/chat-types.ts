/**
 * チャット機能のTypeScript型定義
 * アーキテクチャ設計書に基づく型システム
 */

// 基本的な識別子の型
export type ChatRoomId = string;
export type MessageId = string;
export type UserId = number;
export type ChatMemberId = string;

// チャットルームタイプ
export enum ChatRoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

// メッセージタイプ
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
}

// メンバーロール
export enum MemberRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

// チャットルームエンティティ
export interface ChatRoom {
  id: ChatRoomId;
  type: ChatRoomType;
  name?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: ChatMember[];
  lastMessage?: Message;
  unreadCount?: number;
}

// メッセージエンティティ
export interface Message {
  id: MessageId;
  chatRoomId: ChatRoomId;
  senderId: UserId;
  content: string;
  messageType: MessageType;
  sentAt: Date;
  editedAt?: Date;
  isDeleted: boolean;
  sender: {
    id: UserId;
    name: string;
    email: string;
  };
}

// チャットメンバーエンティティ
export interface ChatMember {
  id: ChatMemberId;
  chatRoomId: ChatRoomId;
  userId: UserId;
  role: MemberRole;
  joinedAt: Date;
  lastReadAt: Date;
  isActive: boolean;
  user: {
    id: UserId;
    name: string;
    email: string;
  };
}

// WebSocketイベントタイプ
export interface SocketEvents {
  // サーバーから受信するイベント
  'message:new': (message: Message) => void;
  'room:joined': (data: { roomId: ChatRoomId; member: ChatMember }) => void;
  'room:left': (data: { roomId: ChatRoomId; userId: UserId }) => void;
  'user:typing': (data: { roomId: ChatRoomId; userId: UserId; isTyping: boolean }) => void;
  'user:online': (data: { userId: UserId; isOnline: boolean }) => void;
  error: (error: SocketError) => void;

  // サーバーに送信するイベント
  'message:send': (data: { roomId: ChatRoomId; content: string }) => void;
  'room:join': (roomId: ChatRoomId) => void;
  'room:leave': (roomId: ChatRoomId) => void;
  'typing:start': (roomId: ChatRoomId) => void;
  'typing:stop': (roomId: ChatRoomId) => void;
}

// WebSocketエラー
export interface SocketError {
  code:
    | 'AUTH_FAILED'
    | 'ROOM_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'MESSAGE_TOO_LONG'
    | 'RATE_LIMIT_EXCEEDED';
  message: string;
  details?: unknown;
  timestamp: Date;
}

// Socket接続状態
export enum SocketConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

// チャット状態管理の型
export interface ChatState {
  // 接続状態
  connectionStatus: SocketConnectionStatus;
  socket: unknown; // Socket.IO Clientインスタンス

  // データ
  currentUser: User | null;
  chatRooms: ChatRoom[];
  messages: Record<ChatRoomId, Message[]>;
  onlineUsers: Set<UserId>;
  typingUsers: Record<ChatRoomId, Set<UserId>>;

  // UI状態
  activeChatRoom: ChatRoomId | null;
  isTyping: boolean;

  // アクション
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (roomId: ChatRoomId, content: string) => Promise<void>;
  joinRoom: (roomId: ChatRoomId) => Promise<void>;
  leaveRoom: (roomId: ChatRoomId) => Promise<void>;
  setActiveRoom: (roomId: ChatRoomId | null) => void;
  startTyping: (roomId: ChatRoomId) => void;
  stopTyping: (roomId: ChatRoomId) => void;
  markAsRead: (roomId: ChatRoomId, messageId: MessageId) => void;
}

// ユーザー型（既存のユーザーエンティティから）
export interface User {
  id: UserId;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
  };
}

// チャットルーム作成用の型
export interface CreateChatRoomRequest {
  type: ChatRoomType;
  name?: string;
  description?: string;
  memberIds: UserId[];
}

// メッセージページネーション
export interface MessagePagination {
  limit: number;
  cursor?: Date;
  direction: 'before' | 'after';
}

// メッセージ履歴取得リクエスト
export interface GetMessagesRequest {
  roomId: ChatRoomId;
  pagination: MessagePagination;
}

// チャット統計情報
export interface ChatStats {
  totalRooms: number;
  totalMessages: number;
  onlineUsers: number;
  unreadCount: number;
}

// フォームバリデーション用の型
export interface MessageFormData {
  content: string;
}

export interface ChatRoomFormData {
  name: string;
  description?: string;
  memberIds: UserId[];
}

// エラーハンドリング用の型
export interface ChatError extends Error {
  code: string;
  details?: unknown;
  retryable?: boolean;
}
