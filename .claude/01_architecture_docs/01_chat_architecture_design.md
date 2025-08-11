# チャット機能 アーキテクチャ設計書

## 概要

本ドキュメントは、Nanika Gameプラットフォームにおけるリアルタイムチャット機能のシステムアーキテクチャを定義します。DDDとクリーンアーキテクチャの原則に基づき、スケーラブルで保守性の高いチャットシステムを構築します。

## アーキテクチャ原則

### 1. クリーンアーキテクチャ準拠
- **Domain層**: ビジネスロジック（チャットルール、メッセージ検証）
- **Application層**: ユースケース（メッセージ送信、チャットルーム管理）
- **Infrastructure層**: 外部システム連携（WebSocket、データベース）
- **Presentation層**: UI表示とユーザー操作

### 2. 依存性の方向
```
Presentation → Application → Domain ← Infrastructure
```

## システム全体構成

### アーキテクチャ概要図
```
┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Web Client    │
│  (React + WSC)  │    │  (React + WSC)  │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │ WebSocket
         ┌───────────▼────────────┐
         │    Socket.io Server    │
         │  (Authentication +     │
         │   Room Management)     │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │    Application Layer   │
         │     (Use Cases)        │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │     Domain Layer       │
         │   (Business Rules)     │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │  Infrastructure Layer  │
         │   (Database Access)    │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │    PostgreSQL DB       │
         │   + Prisma ORM         │
         └────────────────────────┘
```

## WebSocket通信アーキテクチャ

### 1. 接続管理
```typescript
interface SocketConnection {
  socketId: string
  userId: number
  sessionToken: string
  connectedAt: Date
  lastActivity: Date
  currentRooms: string[]
}
```

### 2. Room管理
```typescript
interface ChatRoomSocket {
  roomId: string
  roomType: 'DIRECT' | 'GROUP'
  members: SocketConnection[]
  messageHistory: Message[]
}
```

### 3. メッセージ配信フロー
```
1. Client A → Socket Server: message送信
2. Socket Server → Application Layer: UseCase実行
3. Application Layer → Domain Layer: ビジネスルール検証
4. Domain Layer → Infrastructure Layer: DB保存
5. Infrastructure Layer → Socket Server: 成功レスポンス
6. Socket Server → Room Members: リアルタイム配信
```

## ドメインモデル設計

### 1. ChatRoom (チャットルームエンティティ)
```typescript
interface ChatRoom {
  id: ChatRoomId
  type: ChatRoomType  // 'DIRECT' | 'GROUP'
  name?: string       // グループチャットの場合のみ
  description?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // ビジネスロジック
  addMember(userId: UserId): void
  removeMember(userId: UserId): void
  canSendMessage(userId: UserId): boolean
  validateMessage(content: string): boolean
}
```

### 2. Message (メッセージエンティティ)
```typescript
interface Message {
  id: MessageId
  chatRoomId: ChatRoomId
  senderId: UserId
  content: MessageContent
  messageType: MessageType  // 'TEXT' | 'IMAGE' | 'SYSTEM'
  sentAt: Date
  editedAt?: Date
  isDeleted: boolean
  
  // ビジネスロジック
  canEdit(userId: UserId): boolean
  canDelete(userId: UserId): boolean
  markAsRead(userId: UserId): void
}
```

### 3. ChatMember (チャットメンバーエンティティ)
```typescript
interface ChatMember {
  id: ChatMemberId
  chatRoomId: ChatRoomId
  userId: UserId
  role: MemberRole      // 'MEMBER' | 'ADMIN' | 'OWNER'
  joinedAt: Date
  lastReadAt: Date
  isActive: boolean
  
  // ビジネスロジック
  canInviteOthers(): boolean
  canRemoveMembers(): boolean
  canManageRoom(): boolean
}
```

## レイヤー別責務定義

### Domain層 (app/domain/)
```
entities/
├── ChatRoom.ts          # チャットルームエンティティ
├── Message.ts           # メッセージエンティティ
└── ChatMember.ts        # チャットメンバーエンティティ

value-objects/
├── ChatRoomId.ts        # チャットルームID値オブジェクト
├── MessageId.ts         # メッセージID値オブジェクト
├── MessageContent.ts    # メッセージ内容値オブジェクト
└── ChatRoomType.ts      # チャットルームタイプ値オブジェクト

repositories/
├── IChatRoomRepository.ts   # チャットルームリポジトリI/F
├── IMessageRepository.ts    # メッセージリポジトリI/F
└── IChatMemberRepository.ts # メンバーリポジトリI/F

services/
└── ChatDomainService.ts     # チャット関連ドメインサービス
```

### Application層 (app/api/application/)
```
commands/
├── CreateChatRoomCommand.ts
├── SendMessageCommand.ts
├── JoinChatRoomCommand.ts
└── LeaveChatRoomCommand.ts

results/
├── CreateChatRoomResult.ts
├── SendMessageResult.ts
└── ChatRoomListResult.ts

use-cases/
├── CreateChatRoomUseCase.ts     # チャットルーム作成
├── SendMessageUseCase.ts        # メッセージ送信
├── GetChatRoomsUseCase.ts       # チャットルーム一覧取得
├── GetMessagesUseCase.ts        # メッセージ履歴取得
├── JoinChatRoomUseCase.ts       # チャットルーム参加
└── LeaveChatRoomUseCase.ts      # チャットルーム退出
```

### Infrastructure層 (app/api/infrastructure/)
```
persistence/repositories/
├── PrismaChatRoomRepository.ts    # チャットルームDB実装
├── PrismaMessageRepository.ts     # メッセージDB実装
└── PrismaChatMemberRepository.ts  # メンバーDB実装

services/
├── SocketService.ts               # WebSocket管理サービス
├── RoomManagerService.ts          # ルーム管理サービス
└── MessageBroadcastService.ts     # メッセージ配信サービス

websocket/
├── SocketAuthMiddleware.ts        # WebSocket認証
├── MessageHandler.ts              # メッセージ処理
├── RoomHandler.ts                 # ルーム操作処理
└── ConnectionHandler.ts           # 接続管理処理
```

### Presentation層 (app/web/)
```
components/chat/
├── ChatRoomList.tsx               # チャットルーム一覧
├── ChatRoom.tsx                   # チャットルーム詳細
├── MessageList.tsx                # メッセージ一覧
├── MessageItem.tsx                # 個別メッセージ
├── MessageForm.tsx                # メッセージ送信フォーム
└── UserSelectModal.tsx            # ユーザー選択モーダル

hooks/
├── useSocket.ts                   # WebSocket接続管理
├── useChatRooms.ts               # チャットルーム状態管理
├── useMessages.ts                 # メッセージ状態管理
└── useRealtimeUpdates.ts         # リアルタイム更新処理

stores/
└── chat-store.ts                  # チャット関連状態（Zustand）

services/
└── socket-client.ts               # Socket.ioクライアント設定
```

## データフロー設計

### 1. メッセージ送信フロー
```
1. User Input (MessageForm.tsx)
   ↓
2. useSocket.sendMessage()
   ↓
3. Socket Client → Socket Server
   ↓
4. SocketAuthMiddleware (認証)
   ↓
5. MessageHandler → SendMessageUseCase
   ↓
6. SendMessageUseCase → ChatRoom.canSendMessage()
   ↓
7. Message.create() (ドメインエンティティ)
   ↓
8. PrismaMessageRepository.save()
   ↓
9. MessageBroadcastService.broadcast()
   ↓
10. Socket Server → Room Members
    ↓
11. Client受信 → useChatStore.addMessage()
    ↓
12. MessageList.tsx再レンダリング
```

### 2. チャットルーム作成フロー
```
1. User Action (NewChatPage)
   ↓
2. CreateChatRoomUseCase
   ↓
3. ChatRoom.create() (ドメインエンティティ)
   ↓
4. PrismaChatRoomRepository.save()
   ↓
5. ChatMember.create() (作成者をメンバーに追加)
   ↓
6. PrismaChatMemberRepository.save()
   ↓
7. WebSocketでルーム参加通知
   ↓
8. クライアント側でルーム一覧更新
```

## セキュリティ設計

### 1. WebSocket認証
```typescript
// JWT Token validation
interface SocketAuthPayload {
  userId: number
  sessionToken: string
  expiresAt: Date
}

// 認証フロー
1. WebSocket接続時にsessionTokenを送信
2. SocketAuthMiddleware でトークン検証
3. 有効な場合のみ接続を維持
4. 無効な場合は接続を拒否
```

### 2. チャットルームアクセス制御
```typescript
// アクセス権限チェック
interface AccessControl {
  canJoinRoom(userId: UserId, roomId: ChatRoomId): boolean
  canSendMessage(userId: UserId, roomId: ChatRoomId): boolean
  canInviteMembers(userId: UserId, roomId: ChatRoomId): boolean
  canManageRoom(userId: UserId, roomId: ChatRoomId): boolean
}
```

### 3. メッセージ検証
```typescript
// XSS対策・内容検証
interface MessageValidation {
  sanitizeContent(content: string): string
  validateLength(content: string): boolean
  checkForSpam(content: string, userId: UserId): boolean
  applyRateLimit(userId: UserId): boolean
}
```

## パフォーマンス設計

### 1. データベース最適化
```sql
-- インデックス設計
CREATE INDEX idx_messages_chat_room_sent_at ON messages(chat_room_id, sent_at DESC);
CREATE INDEX idx_chat_members_user_room ON chat_members(user_id, chat_room_id);
CREATE INDEX idx_chat_rooms_type_active ON chat_rooms(type, is_active);
```

### 2. メッセージページネーション
```typescript
interface MessagePagination {
  limit: number        // 20件/ページ
  cursor: Date         // sent_at基準
  direction: 'before' | 'after'
}
```

### 3. WebSocket接続最適化
```typescript
interface ConnectionOptimization {
  heartbeatInterval: 30000    // 30秒間隔
  reconnectAttempts: 5        // 最大5回再試行
  maxConnections: 1000        // サーバー当たり最大接続数
}
```

## エラーハンドリング設計

### 1. WebSocketエラー
```typescript
enum SocketErrorCode {
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

### 2. エラーレスポンス形式
```typescript
interface SocketErrorResponse {
  success: false
  error: {
    code: SocketErrorCode
    message: string
    details?: any
  }
  timestamp: Date
}
```

### 3. 自動復旧機能
```typescript
interface ErrorRecovery {
  autoReconnect: boolean       // 自動再接続
  messageQueueing: boolean     // オフライン時メッセージキュー
  stateSync: boolean          // 再接続時状態同期
}
```

## スケーラビリティ考慮事項

### 1. 水平スケール対応（将来実装）
```typescript
// Redis Adapter使用
interface ScalabilityPlan {
  redisAdapter: 'ioredis'      // Socket.io Redis Adapter
  loadBalancing: 'sticky-sessions'  // セッション固定
  clustering: 'pm2-cluster'    // プロセスクラスタリング
}
```

### 2. メッセージ配信最適化
```typescript
interface MessageDelivery {
  broadcastOptimization: boolean   // Room単位最適化
  messageCompression: boolean      // メッセージ圧縮
  batchDelivery: boolean          // バッチ配信（将来）
}
```

## 監視・ログ設計

### 1. パフォーマンス監視
```typescript
interface PerformanceMetrics {
  activeConnections: number        // 同時接続数
  messageLatency: number          // メッセージ遅延（ms）
  roomCount: number               // アクティブルーム数
  messagesPerSecond: number       // 秒間メッセージ数
}
```

### 2. ログ出力設計
```typescript
interface ChatLogs {
  connection: 'info'              // 接続・切断ログ
  message: 'info'                 // メッセージ送信ログ
  error: 'error'                  // エラーログ
  security: 'warn'               // セキュリティ関連
}
```

## 実装フェーズ計画

### Phase 1: MVP実装
- 1対1チャット機能
- リアルタイムメッセージング
- 基本的なUI/UX

### Phase 2: 機能拡張
- グループチャット機能
- メンバー管理機能
- 既読機能・オンライン状態表示

### Phase 3: スケーラビリティ
- Redis Adapter導入
- パフォーマンス最適化
- 監視・ログ強化

## 技術的な決定事項

### 1. WebSocketライブラリ: Socket.io v4
**選定理由:**
- 自動再接続機能
- Room管理機能内蔵
- TypeScript対応
- 豊富な実績とコミュニティ

### 2. 状態管理: Zustand
**選定理由:**
- 軽量でシンプル
- TypeScript親和性
- React Router v7との相性
- 学習コストの低さ

### 3. データベース設計: 正規化重視
**選定理由:**
- データ整合性の保証
- 拡張性の確保
- パフォーマンス最適化の柔軟性

## 今後の拡張計画

### 1. リッチメディア対応
- 画像・ファイル送信
- 音声・動画通話
- 絵文字・リアクション

### 2. AI機能統合
- 自動翻訳
- スマート返信提案
- 不適切コンテンツ検出

### 3. 外部連携
- 通知システム
- メール連携
- モバイルアプリ対応

---

**更新履歴:**
- 2025-08-10: 初回作成（architecture-specialist）
- 2025-08-10: WebSocket認証設計追加
- 2025-08-10: スケーラビリティ設計詳細化