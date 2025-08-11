# チャット機能 API仕様書

## 概要

本ドキュメントは、チャット機能のREST APIエンドポイントとWebSocketイベントの詳細仕様を定義します。認証、レート制限、エラーハンドリングを含む包括的なAPI設計を提供します。

## 基本仕様

### Base URL
```
Production: https://api.nanika-game.com/v1
Development: http://localhost:3000/api/v1
```

### 認証方式
- **REST API**: セッションベース認証（Cookie）
- **WebSocket**: セッショントークン認証

### レスポンス形式
```typescript
// 成功レスポンス
interface SuccessResponse<T> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    timestamp: string
  }
}

// エラーレスポンス
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
  meta: {
    timestamp: string
    requestId: string
  }
}
```

## REST API エンドポイント

### 1. チャットルーム管理

#### GET /chat/rooms
**用途**: ユーザーが参加しているチャットルーム一覧を取得

**リクエスト:**
```typescript
interface GetChatRoomsRequest {
  type?: 'DIRECT' | 'GROUP' | 'ALL'  // デフォルト: 'ALL'
  limit?: number                     // デフォルト: 20
  cursor?: string                    // ページネーション用カーソル
  includeInactive?: boolean          // デフォルト: false
}
```

**レスポンス:**
```typescript
interface GetChatRoomsResponse {
  success: true
  data: {
    rooms: ChatRoomSummary[]
    hasNext: boolean
    nextCursor?: string
  }
}

interface ChatRoomSummary {
  id: number
  type: 'DIRECT' | 'GROUP'
  name?: string
  description?: string
  memberCount: number
  unreadCount: number
  lastMessage?: {
    content: string
    sentAt: string
    senderName: string
  }
  createdAt: string
  updatedAt: string
}
```

**エラー:**
- `401 UNAUTHORIZED`: 認証が必要
- `403 FORBIDDEN`: アクセス権限なし
- `500 INTERNAL_SERVER_ERROR`: サーバーエラー

#### POST /chat/rooms
**用途**: 新しいチャットルームを作成

**リクエスト:**
```typescript
interface CreateChatRoomRequest {
  type: 'DIRECT' | 'GROUP'
  name?: string                    // type='GROUP'の場合必須
  description?: string
  memberIds: number[]              // 招待するメンバーのID配列
}
```

**レスポンス:**
```typescript
interface CreateChatRoomResponse {
  success: true
  data: {
    room: ChatRoomDetail
  }
}

interface ChatRoomDetail {
  id: number
  type: 'DIRECT' | 'GROUP'
  name?: string
  description?: string
  isActive: boolean
  members: ChatMember[]
  createdAt: string
  updatedAt: string
}

interface ChatMember {
  id: number
  userId: number
  userName: string
  role: 'MEMBER' | 'ADMIN' | 'OWNER'
  joinedAt: string
  lastReadAt?: string
  isActive: boolean
}
```

**エラー:**
- `400 BAD_REQUEST`: 無効なリクエストパラメータ
- `401 UNAUTHORIZED`: 認証が必要
- `409 CONFLICT`: 既存のダイレクトチャットが存在
- `422 UNPROCESSABLE_ENTITY`: ビジネスルール違反

#### GET /chat/rooms/:roomId
**用途**: 特定のチャットルームの詳細情報を取得

**パラメータ:**
- `roomId`: チャットルームID (number)

**レスポンス:**
```typescript
interface GetChatRoomResponse {
  success: true
  data: {
    room: ChatRoomDetail
  }
}
```

**エラー:**
- `401 UNAUTHORIZED`: 認証が必要
- `403 FORBIDDEN`: アクセス権限なし
- `404 NOT_FOUND`: ルームが存在しない

#### PUT /chat/rooms/:roomId
**用途**: チャットルーム情報を更新（グループチャットのみ）

**リクエスト:**
```typescript
interface UpdateChatRoomRequest {
  name?: string
  description?: string
}
```

**レスポンス:**
```typescript
interface UpdateChatRoomResponse {
  success: true
  data: {
    room: ChatRoomDetail
  }
}
```

**エラー:**
- `400 BAD_REQUEST`: 無効なパラメータ
- `401 UNAUTHORIZED`: 認証が必要
- `403 FORBIDDEN`: 更新権限なし（ADMIN/OWNERのみ）
- `404 NOT_FOUND`: ルームが存在しない

### 2. メッセージ管理

#### GET /chat/rooms/:roomId/messages
**用途**: チャットルームのメッセージ履歴を取得

**パラメータ:**
- `roomId`: チャットルームID (number)

**クエリパラメータ:**
```typescript
interface GetMessagesRequest {
  limit?: number          // デフォルト: 20, 最大: 100
  cursor?: string         // ページネーション用カーソル（sent_at ISO文字列）
  direction?: 'before' | 'after'  // デフォルト: 'before'
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
}
```

**レスポンス:**
```typescript
interface GetMessagesResponse {
  success: true
  data: {
    messages: MessageDetail[]
    hasNext: boolean
    hasPrevious: boolean
    nextCursor?: string
    previousCursor?: string
  }
}

interface MessageDetail {
  id: number
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
  sender: {
    id: number
    name: string
  }
  sentAt: string
  editedAt?: string
  isDeleted: boolean
}
```

#### POST /chat/rooms/:roomId/messages
**用途**: メッセージを送信

**リクエスト:**
```typescript
interface SendMessageRequest {
  content: string                  // 1-10000文字
  messageType?: 'TEXT' | 'IMAGE' | 'FILE'  // デフォルト: 'TEXT'
  metadata?: {                     // 画像・ファイルの場合
    fileName?: string
    fileSize?: number
    mimeType?: string
  }
}
```

**レスポンス:**
```typescript
interface SendMessageResponse {
  success: true
  data: {
    message: MessageDetail
  }
}
```

**エラー:**
- `400 BAD_REQUEST`: 無効なメッセージ内容
- `401 UNAUTHORIZED`: 認証が必要
- `403 FORBIDDEN`: 送信権限なし
- `404 NOT_FOUND`: ルームが存在しない
- `429 TOO_MANY_REQUESTS`: レート制限超過（1分間20メッセージ）

#### PUT /chat/rooms/:roomId/messages/:messageId
**用途**: メッセージを編集

**リクエスト:**
```typescript
interface EditMessageRequest {
  content: string
}
```

**レスポンス:**
```typescript
interface EditMessageResponse {
  success: true
  data: {
    message: MessageDetail
  }
}
```

#### DELETE /chat/rooms/:roomId/messages/:messageId
**用途**: メッセージを削除（論理削除）

**レスポンス:**
```typescript
interface DeleteMessageResponse {
  success: true
  data: {
    messageId: number
  }
}
```

### 3. メンバー管理

#### POST /chat/rooms/:roomId/members
**用途**: チャットルームにメンバーを招待

**リクエスト:**
```typescript
interface InviteMemberRequest {
  userIds: number[]
}
```

**レスポンス:**
```typescript
interface InviteMemberResponse {
  success: true
  data: {
    invitedMembers: ChatMember[]
  }
}
```

#### DELETE /chat/rooms/:roomId/members/:userId
**用途**: メンバーをチャットルームから削除

**レスポンス:**
```typescript
interface RemoveMemberResponse {
  success: true
  data: {
    removedUserId: number
  }
}
```

#### PUT /chat/rooms/:roomId/members/:userId/role
**用途**: メンバーの役割を変更

**リクエスト:**
```typescript
interface ChangeMemberRoleRequest {
  role: 'MEMBER' | 'ADMIN'
}
```

#### POST /chat/rooms/:roomId/leave
**用途**: チャットルームから退出

**レスポンス:**
```typescript
interface LeaveChatRoomResponse {
  success: true
  data: {
    roomId: number
  }
}
```

## WebSocket イベント仕様

### 接続・認証

#### 接続エンドポイント
```
ws://localhost:3000/socket.io
wss://api.nanika-game.com/socket.io
```

#### 認証イベント
```typescript
// クライアント → サーバー
interface AuthenticateEvent {
  sessionToken: string
}

// サーバー → クライアント（成功）
interface AuthenticateSuccessEvent {
  userId: number
  socketId: string
  connectedAt: string
}

// サーバー → クライアント（失敗）
interface AuthenticateFailEvent {
  error: {
    code: 'INVALID_SESSION' | 'SESSION_EXPIRED' | 'USER_NOT_FOUND'
    message: string
  }
}
```

### ルーム管理イベント

#### ルーム参加
```typescript
// クライアント → サーバー
interface JoinRoomEvent {
  roomId: number
}

// サーバー → クライアント（参加者本人）
interface JoinRoomSuccessEvent {
  roomId: number
  members: ChatMember[]
  recentMessages: MessageDetail[]
}

// サーバー → ルーム内の他のメンバー
interface UserJoinedEvent {
  roomId: number
  member: ChatMember
}
```

#### ルーム退出
```typescript
// クライアント → サーバー
interface LeaveRoomEvent {
  roomId: number
}

// サーバー → ルーム内の他のメンバー
interface UserLeftEvent {
  roomId: number
  userId: number
}
```

### メッセージングイベント

#### メッセージ送信
```typescript
// クライアント → サーバー
interface SendMessageEvent {
  roomId: number
  content: string
  messageType?: 'TEXT' | 'IMAGE' | 'FILE'
  tempId?: string  // 楽観的更新用の一時ID
}

// サーバー → クライアント（送信者）
interface MessageSentEvent {
  tempId?: string
  message: MessageDetail
}

// サーバー → ルーム内の他のメンバー
interface MessageReceivedEvent {
  roomId: number
  message: MessageDetail
}
```

#### メッセージ編集
```typescript
// クライアント → サーバー
interface EditMessageEvent {
  roomId: number
  messageId: number
  content: string
}

// サーバー → ルーム内全メンバー
interface MessageEditedEvent {
  roomId: number
  message: MessageDetail
}
```

#### メッセージ削除
```typescript
// クライアント → サーバー
interface DeleteMessageEvent {
  roomId: number
  messageId: number
}

// サーバー → ルーム内全メンバー
interface MessageDeletedEvent {
  roomId: number
  messageId: number
  deletedAt: string
}
```

### 拡張機能イベント（Phase 2）

#### タイピング状態
```typescript
// クライアント → サーバー
interface TypingStartEvent {
  roomId: number
}

interface TypingStopEvent {
  roomId: number
}

// サーバー → ルーム内の他のメンバー
interface UserTypingEvent {
  roomId: number
  userId: number
  userName: string
  isTyping: boolean
}
```

#### オンライン状態
```typescript
// サーバー → 接続中の全クライアント
interface UserOnlineStatusEvent {
  userId: number
  isOnline: boolean
  lastSeenAt?: string
}
```

#### 既読機能
```typescript
// クライアント → サーバー
interface MarkAsReadEvent {
  roomId: number
  messageId: number  // この時点までのメッセージを既読
}

// サーバー → ルーム内の他のメンバー
interface MessageReadEvent {
  roomId: number
  userId: number
  lastReadMessageId: number
  readAt: string
}
```

## エラーハンドリング

### REST APIエラーコード

```typescript
enum ApiErrorCode {
  // 認証・認可
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // リクエスト検証
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  
  // リソース
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // ビジネスロジック
  ROOM_ACCESS_DENIED = 'ROOM_ACCESS_DENIED',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  INVALID_ROOM_TYPE = 'INVALID_ROOM_TYPE',
  MEMBER_LIMIT_EXCEEDED = 'MEMBER_LIMIT_EXCEEDED',
  
  // レート制限
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // システムエラー
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

### WebSocketエラーコード

```typescript
enum SocketErrorCode {
  // 認証
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  INVALID_SESSION = 'INVALID_SESSION',
  
  // ルーム操作
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_ACCESS_DENIED = 'ROOM_ACCESS_DENIED',
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  
  // メッセージ
  MESSAGE_VALIDATION_ERROR = 'MESSAGE_VALIDATION_ERROR',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_EDIT_DENIED = 'MESSAGE_EDIT_DENIED',
  
  // システム
  SERVER_ERROR = 'SERVER_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR'
}
```

### エラーレスポンス例

#### REST API
```json
{
  "success": false,
  "error": {
    "code": "MESSAGE_TOO_LONG",
    "message": "メッセージは10000文字以内で入力してください",
    "details": {
      "maxLength": 10000,
      "actualLength": 15000
    }
  },
  "meta": {
    "timestamp": "2025-08-10T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

#### WebSocket
```typescript
interface SocketErrorEvent {
  error: true
  code: SocketErrorCode
  message: string
  details?: any
  eventId?: string
}
```

## レート制限

### REST API制限
```typescript
interface RateLimit {
  '/chat/rooms': '100 requests/hour'         // ルーム一覧・作成
  '/chat/rooms/:id': '200 requests/hour'     // ルーム詳細
  '/chat/*/messages': '1200 requests/hour'   // メッセージ関連（20req/min）
  '/chat/*/members': '60 requests/hour'      // メンバー管理
}
```

### WebSocket制限
```typescript
interface SocketRateLimit {
  'send_message': '20 messages/minute'       // メッセージ送信
  'join_room': '30 joins/hour'               // ルーム参加
  'typing': '60 events/minute'               // タイピング通知
}
```

### 制限超過時のレスポンス
```typescript
interface RateLimitResponse {
  success: false
  error: {
    code: 'RATE_LIMIT_EXCEEDED'
    message: 'レート制限に達しました。しばらくお待ちください'
    details: {
      limit: number
      remaining: number
      resetAt: string
    }
  }
}
```

## セキュリティ仕様

### 入力検証
```typescript
interface ValidationRules {
  chatRoom: {
    name: 'max:100, min:1, no_html'
    description: 'max:500, optional, no_html'
    memberIds: 'array, max:50, integer'
  }
  message: {
    content: 'max:10000, min:1, html_escape'
    messageType: 'enum:TEXT,IMAGE,FILE'
  }
}
```

### XSS対策
- メッセージ内容のHTMLエスケープ
- CSP（Content Security Policy）設定
- サニタイゼーション

### CSRF対策
- SameSite Cookie使用
- Origin検証

### WebSocket認証
```typescript
interface SocketAuth {
  sessionValidation: 'every_request'      // 毎リクエスト検証
  tokenExpiry: '24 hours'                 // トークン有効期限
  maxConnections: 5                       // ユーザー当たり最大接続数
}
```

## パフォーマンス最適化

### キャッシュ戦略
```typescript
interface CacheStrategy {
  chatRoomList: 'Redis, TTL: 5 minutes'   // ルーム一覧
  userProfile: 'Redis, TTL: 1 hour'       // ユーザー情報
  messageHistory: 'In-Memory, LRU'        // メッセージ履歴
}
```

### データベースクエリ最適化
- インデックス利用率100%
- N+1問題の解決
- ページネーション最適化

### WebSocket最適化
```typescript
interface SocketOptimization {
  messageCompression: true                // メッセージ圧縮
  heartbeatInterval: 30000               // ハートビート間隔
  maxPayloadSize: '1MB'                  // 最大ペイロードサイズ
}
```

## API使用例

### チャットルーム作成
```typescript
// 1対1チャット作成
const response = await fetch('/api/v1/chat/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'DIRECT',
    memberIds: [123]
  })
})

// グループチャット作成
const response = await fetch('/api/v1/chat/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'GROUP',
    name: '開発チーム',
    description: 'プロジェクト開発用',
    memberIds: [123, 456, 789]
  })
})
```

### WebSocket接続とメッセージ送信
```typescript
import { io } from 'socket.io-client'

const socket = io('ws://localhost:3000')

// 認証
socket.emit('authenticate', { sessionToken })

// ルーム参加
socket.emit('join_room', { roomId: 1 })

// メッセージ送信
socket.emit('send_message', {
  roomId: 1,
  content: 'こんにちは！',
  tempId: 'temp_123'
})

// メッセージ受信
socket.on('message_received', (data) => {
  console.log('新しいメッセージ:', data.message)
})
```

## テスト仕様

### 単体テスト
- 各エンドポイントの正常系・異常系
- バリデーション機能
- ビジネスロジック

### 統合テスト
- API間の連携
- WebSocket通信
- データベース整合性

### 負荷テスト
- 同時接続数: 1000
- メッセージ送信レート: 100/sec
- レスポンス時間: 95%ile < 200ms

---

**更新履歴:**
- 2025-08-10: 初回作成（architecture-specialist）
- 2025-08-10: WebSocketイベント仕様詳細化
- 2025-08-10: セキュリティ仕様追加
- 2025-08-10: エラーハンドリング強化