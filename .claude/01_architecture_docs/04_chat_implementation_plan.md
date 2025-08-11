# チャット機能 実装ファイル構成・実装計画書

## 概要

本ドキュメントは、チャット機能実装における詳細なファイル構成と実装の進行計画を定義します。各レイヤーのファイル配置、依存関係、実装順序を明確化し、開発者が迷わずに実装できるガイドを提供します。

## 全体ファイル構成

```
app/
├── domain/                           # ドメイン層
│   ├── entities/
│   │   ├── ChatRoom.ts              # チャットルームエンティティ
│   │   ├── Message.ts               # メッセージエンティティ
│   │   └── ChatMember.ts            # チャットメンバーエンティティ
│   ├── value-objects/
│   │   ├── ChatRoomId.ts            # チャットルームID
│   │   ├── MessageId.ts             # メッセージID
│   │   ├── ChatMemberId.ts          # チャットメンバーID
│   │   └── MessageContent.ts        # メッセージ内容
│   ├── repositories/
│   │   ├── IChatRoomRepository.ts   # チャットルームリポジトリI/F
│   │   ├── IMessageRepository.ts    # メッセージリポジトリI/F
│   │   └── IChatMemberRepository.ts # メンバーリポジトリI/F
│   └── services/
│       └── ChatDomainService.ts     # チャットドメインサービス
├── api/                             # API層（バックエンド）
│   ├── application/
│   │   ├── commands/
│   │   │   ├── CreateChatRoomCommand.ts
│   │   │   ├── SendMessageCommand.ts
│   │   │   ├── JoinChatRoomCommand.ts
│   │   │   └── LeaveChatRoomCommand.ts
│   │   ├── results/
│   │   │   ├── CreateChatRoomResult.ts
│   │   │   ├── SendMessageResult.ts
│   │   │   └── ChatRoomListResult.ts
│   │   └── use-cases/
│   │       ├── CreateChatRoomUseCase.ts
│   │       ├── SendMessageUseCase.ts
│   │       ├── GetChatRoomsUseCase.ts
│   │       ├── GetMessagesUseCase.ts
│   │       ├── JoinChatRoomUseCase.ts
│   │       └── LeaveChatRoomUseCase.ts
│   ├── controllers/
│   │   ├── ChatRoomController.ts
│   │   ├── MessageController.ts
│   │   └── ChatMemberController.ts
│   ├── infrastructure/
│   │   ├── persistence/repositories/
│   │   │   ├── PrismaChatRoomRepository.ts
│   │   │   ├── PrismaMessageRepository.ts
│   │   │   └── PrismaChatMemberRepository.ts
│   │   ├── services/
│   │   │   ├── SocketService.ts
│   │   │   ├── RoomManagerService.ts
│   │   │   └── MessageBroadcastService.ts
│   │   └── websocket/
│   │       ├── SocketAuthMiddleware.ts
│   │       ├── MessageHandler.ts
│   │       ├── RoomHandler.ts
│   │       └── ConnectionHandler.ts
│   ├── routes/
│   │   └── chat-routes.ts
│   └── websocket-server.ts
├── web/                             # フロントエンド層
│   ├── components/chat/
│   │   ├── ChatRoomList.tsx
│   │   ├── ChatRoom.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageForm.tsx
│   │   └── UserSelectModal.tsx
│   ├── hooks/
│   │   ├── useSocket.ts
│   │   ├── useChatRooms.ts
│   │   ├── useMessages.ts
│   │   └── useRealtimeUpdates.ts
│   ├── stores/
│   │   └── chat-store.ts
│   ├── services/
│   │   └── socket-client.ts
│   ├── routes/
│   │   ├── chat.tsx
│   │   ├── chat.$roomId.tsx
│   │   └── chat.new.tsx
│   ├── types/
│   │   └── chat-types.ts
│   └── utils/
│       └── chat-utils.ts
├── shared/                          # 共有レイヤー
│   ├── errors/
│   │   └── chat.error.ts
│   └── types/
│       └── chat-types.ts
├── prisma/
│   ├── migrations/
│   │   └── [timestamp]_add_chat_tables/
│   │       └── migration.sql
│   ├── schema.prisma               # 更新済み
│   └── seed.ts                     # チャットデータ追加
└── __tests__/                      # テストファイル
    ├── unit/
    │   ├── domain/entities/
    │   │   ├── ChatRoom.test.ts
    │   │   ├── Message.test.ts
    │   │   └── ChatMember.test.ts
    │   ├── domain/value-objects/
    │   │   ├── MessageContent.test.ts
    │   │   └── ChatRoomId.test.ts
    │   ├── application/usecases/
    │   │   ├── CreateChatRoomUseCase.test.ts
    │   │   └── SendMessageUseCase.test.ts
    │   └── infrastructure/repositories/
    │       ├── PrismaChatRoomRepository.test.ts
    │       └── PrismaMessageRepository.test.ts
    ├── integration/
    │   ├── api/
    │   │   ├── chat-rooms.test.ts
    │   │   └── messages.test.ts
    │   └── websocket/
    │       ├── connection.test.ts
    │       └── messaging.test.ts
    ├── ui/
    │   ├── ChatRoomList.test.tsx
    │   ├── MessageForm.test.tsx
    │   └── realtime-updates.test.tsx
    └── fixtures/
        ├── chat.factory.ts
        └── mock-data.ts
```

## 実装優先度と依存関係

### Phase 1: 基盤実装（必須）

#### 1. ドメイン層 (app/domain/)
**実装順序: 1番目**
**依存関係: なし（純粋なTypeScript）**

```typescript
// 実装ファイルリスト
1. app/domain/value-objects/ChatRoomId.ts           ✅ 基本的な値オブジェクト
2. app/domain/value-objects/MessageId.ts            ✅ 基本的な値オブジェクト
3. app/domain/value-objects/ChatMemberId.ts         ✅ 基本的な値オブジェクト
4. app/domain/value-objects/MessageContent.ts       ✅ バリデーション付き値オブジェクト
5. app/domain/entities/ChatMember.ts                ✅ メンバーエンティティ
6. app/domain/entities/Message.ts                   ✅ メッセージエンティティ
7. app/domain/entities/ChatRoom.ts                  ✅ ルームエンティティ（最重要）
8. app/domain/repositories/IChatRoomRepository.ts   ✅ リポジトリインターフェース
9. app/domain/repositories/IMessageRepository.ts    ✅ リポジトリインターフェース
10. app/domain/repositories/IChatMemberRepository.ts ✅ リポジトリインターフェース
11. app/domain/services/ChatDomainService.ts         ✅ ドメインサービス
```

**テストファイル:**
```typescript
- __tests__/unit/domain/entities/ChatRoom.test.ts     ✅ 最優先テスト
- __tests__/unit/domain/entities/Message.test.ts      ✅ 重要テスト
- __tests__/unit/domain/value-objects/MessageContent.test.ts ✅ バリデーションテスト
```

#### 2. インフラ層 - データベース (app/api/infrastructure/persistence/)
**実装順序: 2番目**
**依存関係: Domain層、Prismaクライアント**

```typescript
// 実装ファイルリスト
12. app/api/infrastructure/persistence/PrismaChatRoomRepository.ts   ✅ ルームDB実装
13. app/api/infrastructure/persistence/PrismaMessageRepository.ts    ✅ メッセージDB実装  
14. app/api/infrastructure/persistence/PrismaChatMemberRepository.ts ✅ メンバーDB実装
```

**テストファイル:**
```typescript
- __tests__/unit/infrastructure/PrismaChatRoomRepository.test.ts   ✅ DB操作テスト
- __tests__/unit/infrastructure/PrismaMessageRepository.test.ts    ✅ DB操作テスト
```

#### 3. アプリケーション層 (app/api/application/)
**実装順序: 3番目**
**依存関係: Domain層、Infrastructure層**

```typescript
// Commands & Results
15. app/api/application/commands/CreateChatRoomCommand.ts    ✅ コマンドオブジェクト
16. app/api/application/commands/SendMessageCommand.ts       ✅ コマンドオブジェクト
17. app/api/application/results/CreateChatRoomResult.ts      ✅ 結果オブジェクト
18. app/api/application/results/SendMessageResult.ts        ✅ 結果オブジェクト

// Use Cases (最重要)
19. app/api/application/use-cases/CreateChatRoomUseCase.ts   ✅ ルーム作成ユースケース
20. app/api/application/use-cases/SendMessageUseCase.ts      ✅ メッセージ送信ユースケース
21. app/api/application/use-cases/GetChatRoomsUseCase.ts     ✅ ルーム一覧取得
22. app/api/application/use-cases/GetMessagesUseCase.ts      ✅ メッセージ取得
23. app/api/application/use-cases/JoinChatRoomUseCase.ts     ✅ ルーム参加
```

**テストファイル:**
```typescript
- __tests__/unit/application/CreateChatRoomUseCase.test.ts   ✅ 最重要テスト
- __tests__/unit/application/SendMessageUseCase.test.ts     ✅ 最重要テスト
```

#### 4. コントローラー層 (app/api/controllers/)
**実装順序: 4番目**
**依存関係: Application層**

```typescript
24. app/api/controllers/ChatRoomController.ts               ✅ REST API実装
25. app/api/controllers/MessageController.ts                ✅ REST API実装
26. app/api/controllers/ChatMemberController.ts             ✅ REST API実装
27. app/api/routes/chat-routes.ts                          ✅ ルーティング設定
```

**テストファイル:**
```typescript
- __tests__/integration/api/chat-rooms.test.ts             ✅ API統合テスト
- __tests__/integration/api/messages.test.ts               ✅ API統合テスト
```

#### 5. WebSocket実装 (app/api/infrastructure/websocket/)
**実装順序: 5番目**
**依存関係: Application層、Socket.io**

```typescript
28. app/api/infrastructure/websocket/SocketAuthMiddleware.ts  ✅ WebSocket認証
29. app/api/infrastructure/websocket/ConnectionHandler.ts     ✅ 接続管理
30. app/api/infrastructure/websocket/RoomHandler.ts          ✅ ルーム操作
31. app/api/infrastructure/websocket/MessageHandler.ts       ✅ メッセージ処理
32. app/api/infrastructure/services/SocketService.ts         ✅ WebSocketサービス
33. app/api/websocket-server.ts                             ✅ サーバー設定
```

**テストファイル:**
```typescript
- __tests__/integration/websocket/connection.test.ts       ✅ WebSocket接続テスト
- __tests__/integration/websocket/messaging.test.ts        ✅ メッセージ配信テスト
```

#### 6. フロントエンド基盤 (app/web/)
**実装順序: 6番目**
**依存関係: Socket.ioクライアント、Zustand**

```typescript
// Types & Services
34. app/web/types/chat-types.ts                            ✅ フロントエンド型定義
35. app/web/services/socket-client.ts                      ✅ Socket.ioクライアント
36. app/web/stores/chat-store.ts                           ✅ Zustand状態管理
37. app/web/utils/chat-utils.ts                            ✅ ユーティリティ関数

// Custom Hooks
38. app/web/hooks/useSocket.ts                             ✅ WebSocket管理フック
39. app/web/hooks/useChatRooms.ts                          ✅ ルーム状態管理フック
40. app/web/hooks/useMessages.ts                           ✅ メッセージ状態管理フック
41. app/web/hooks/useRealtimeUpdates.ts                    ✅ リアルタイム更新フック
```

#### 7. UIコンポーネント (app/web/components/)
**実装順序: 7番目**
**依存関係: React、フロントエンド基盤**

```typescript
// Core Components
42. app/web/components/chat/MessageItem.tsx                ✅ 個別メッセージ表示
43. app/web/components/chat/MessageList.tsx                ✅ メッセージ一覧
44. app/web/components/chat/MessageForm.tsx                ✅ メッセージ送信フォーム
45. app/web/components/chat/ChatRoom.tsx                   ✅ チャットルーム詳細
46. app/web/components/chat/ChatRoomList.tsx               ✅ チャットルーム一覧
47. app/web/components/chat/UserSelectModal.tsx            ✅ ユーザー選択モーダル
```

**テストファイル:**
```typescript
- __tests__/ui/MessageForm.test.tsx                        ✅ フォームテスト
- __tests__/ui/ChatRoomList.test.tsx                       ✅ 一覧表示テスト
- __tests__/ui/realtime-updates.test.tsx                   ✅ リアルタイム更新テスト
```

#### 8. ページ・ルーティング (app/web/routes/)
**実装順序: 8番目（最後）**
**依存関係: UIコンポーネント、React Router**

```typescript
48. app/web/routes/chat.tsx                                ✅ チャット一覧ページ
49. app/web/routes/chat.$roomId.tsx                        ✅ チャットルーム詳細ページ
50. app/web/routes/chat.new.tsx                            ✅ 新規チャット作成ページ
51. app/routes.ts (チャットルート追加)                      ✅ ルーティング設定
```

## 詳細な実装ガイド

### 1. ドメイン層実装ガイド

#### ChatRoom エンティティ実装のポイント
```typescript
// app/domain/entities/ChatRoom.ts
// ✅ 実装時の重要ポイント
export class ChatRoom {
  // ✅ 1. プライベートフィールドで不変性保証
  private constructor(/*...*/) {}
  
  // ✅ 2. ファクトリーメソッドでビジネスルール適用
  static create(type: ChatRoomType, name?: string): ChatRoom {
    // バリデーションロジック
    if (type === ChatRoomType.GROUP && !name) {
      throw new DomainError('グループチャットには名前が必要です')
    }
  }
  
  // ✅ 3. ビジネスロジックをメソッドに集約
  canSendMessage(userId: UserId): boolean {
    return this.isActive && this.isMember(userId)
  }
}
```

#### MessageContent 値オブジェクト実装のポイント
```typescript
// app/domain/value-objects/MessageContent.ts
export class MessageContent {
  // ✅ 1. 作成時にバリデーション実行
  private constructor(private readonly _value: string) {
    this.validate() // コンストラクタで必ずバリデーション
  }
  
  // ✅ 2. XSS対策メソッドの提供
  sanitized(): string {
    return this._value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
```

### 2. インフラ層実装ガイド

#### Prismaリポジトリ実装のポイント
```typescript
// app/api/infrastructure/persistence/PrismaChatRoomRepository.ts
export class PrismaChatRoomRepository implements IChatRoomRepository {
  // ✅ 1. ドメインエンティティ ↔ Prismaオブジェクト変換
  async findById(id: ChatRoomId): Promise<ChatRoom | null> {
    const prismaRoom = await this.prisma.chatRoom.findUnique({
      where: { id: id.value },
      include: { 
        members: { include: { user: true } },
        messages: { take: 50, orderBy: { sentAt: 'desc' } }
      }
    })
    
    if (!prismaRoom) return null
    
    // ✅ 2. reconstruct メソッドでエンティティ復元
    return ChatRoom.reconstruct(/* ... */)
  }
  
  // ✅ 3. ページネーション対応
  async findByUserIdWithPagination(
    userId: UserId, 
    limit: number, 
    cursor?: Date
  ): Promise<{ rooms: ChatRoom[], hasNext: boolean, nextCursor?: Date }> {
    // Cursor-based pagination実装
  }
}
```

### 3. アプリケーション層実装ガイド

#### UseCase実装のポイント
```typescript
// app/api/application/use-cases/CreateChatRoomUseCase.ts
export class CreateChatRoomUseCase {
  // ✅ 1. 依存性注入でリポジトリ受け取り
  constructor(
    private readonly chatRoomRepository: IChatRoomRepository,
    private readonly chatDomainService: ChatDomainService
  ) {}
  
  async execute(command: CreateChatRoomCommand): Promise<CreateChatRoomResult> {
    // ✅ 2. ドメインサービスでビジネスルール検証
    if (command.type === 'DIRECT') {
      const canCreate = await this.chatDomainService.canCreateDirectChat(
        command.creatorId, command.memberIds[0]
      )
      if (!canCreate) {
        throw new DomainError('既存のダイレクトチャットが存在します')
      }
    }
    
    // ✅ 3. ドメインエンティティでビジネスロジック実行
    const chatRoom = await this.chatDomainService.createChatRoom(/*...*/)
    
    // ✅ 4. リポジトリで永続化
    await this.chatRoomRepository.save(chatRoom)
    
    // ✅ 5. 結果オブジェクトで返却
    return CreateChatRoomResult.success(chatRoom)
  }
}
```

### 4. WebSocket実装ガイド

#### Socket.io設定のポイント
```typescript
// app/api/websocket-server.ts
export class WebSocketServer {
  private io: Server
  
  constructor() {
    // ✅ 1. CORS設定と認証設定
    this.io = new Server(httpServer, {
      cors: { origin: process.env.CLIENT_URL },
      transports: ['websocket', 'polling']
    })
    
    // ✅ 2. 認証ミドルウェア適用
    this.io.use(SocketAuthMiddleware.authenticate)
    
    // ✅ 3. イベントハンドラー登録
    this.io.on('connection', this.handleConnection.bind(this))
  }
  
  private async handleConnection(socket: AuthenticatedSocket) {
    // ✅ 4. 各種ハンドラーに処理を委譲
    new MessageHandler(socket, this.messageService).register()
    new RoomHandler(socket, this.roomService).register()
  }
}
```

### 5. フロントエンド実装ガイド

#### Zustand状態管理のポイント
```typescript
// app/web/stores/chat-store.ts
export const useChatStore = create<ChatState>()((set, get) => ({
  // ✅ 1. 正規化された状態構造
  rooms: {},              // Record<roomId, ChatRoom>
  messages: {},           // Record<roomId, Message[]>
  activeRoomId: null,
  
  // ✅ 2. 楽観的更新対応
  sendMessage: async (roomId: number, content: string, tempId: string) => {
    // 即座にUIに反映（楽観的更新）
    set(state => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), {
          id: tempId, // 一時ID
          content,
          status: 'pending'
        }]
      }
    }))
    
    // サーバーに送信
    socketClient.sendMessage(roomId, content, tempId)
  },
  
  // ✅ 3. WebSocketイベント受信時の状態更新
  onMessageReceived: (message: Message) => {
    set(state => ({
      messages: {
        ...state.messages,
        [message.chatRoomId]: [...(state.messages[message.chatRoomId] || []), message]
      }
    }))
  }
}))
```

#### React Router設定のポイント
```typescript
// app/web/routes/chat.$roomId.tsx
import { LoaderFunctionArgs } from 'react-router'

// ✅ 1. loaderでデータ事前取得
export async function loader({ params }: LoaderFunctionArgs) {
  const roomId = Number(params.roomId)
  
  // 権限チェック
  const hasAccess = await checkChatRoomAccess(roomId)
  if (!hasAccess) {
    throw new Response('Not Found', { status: 404 })
  }
  
  // チャットルーム情報とメッセージ履歴を並列取得
  const [room, messages] = await Promise.all([
    getChatRoom(roomId),
    getMessages(roomId, { limit: 50 })
  ])
  
  return { room, messages }
}

// ✅ 2. ErrorBoundaryでエラーハンドリング
export function ErrorBoundary() {
  return (
    <div className="chat-error">
      <h2>チャットルームが見つかりません</h2>
      <Link to="/chat">チャット一覧に戻る</Link>
    </div>
  )
}
```

## 実装時のチェックリスト

### ドメイン層チェックリスト
- [ ] エンティティは不変性を保っているか
- [ ] ビジネスルールがドメインエンティティに集約されているか
- [ ] 値オブジェクトでバリデーションが適切に行われているか
- [ ] リポジトリインターフェースがドメイン指向になっているか
- [ ] ドメインサービスで複雑なビジネスルールを処理しているか

### インフラ層チェックリスト
- [ ] リポジトリ実装がインターフェースを正しく実装しているか
- [ ] Prismaエンティティ ↔ ドメインエンティティの変換が適切か
- [ ] データベースクエリが最適化されているか
- [ ] WebSocket認証が適切に実装されているか
- [ ] エラーハンドリングが包括的に行われているか

### アプリケーション層チェックリスト
- [ ] UseCaseがビジネス要件を正しく実装しているか
- [ ] 依存性注入が適切に行われているか
- [ ] エラーハンドリングが適切に行われているか
- [ ] トランザクション境界が適切に設定されているか
- [ ] ログ出力が適切に行われているか

### フロントエンド層チェックリスト
- [ ] 状態管理が正規化された構造になっているか
- [ ] 楽観的更新が適切に実装されているか
- [ ] WebSocket接続の自動再接続が実装されているか
- [ ] エラーハンドリングとユーザーフィードバックが適切か
- [ ] レスポンシブデザインが適用されているか

## パフォーマンス考慮事項

### データベースクエリ最適化
```sql
-- ✅ 1. インデックスを活用したクエリ
-- チャットルーム一覧取得（ユーザー参加ルームのみ）
SELECT cr.*, COUNT(m.id) as message_count
FROM chat_rooms cr
JOIN chat_members cm ON cr.id = cm.chat_room_id
LEFT JOIN messages m ON cr.id = m.chat_room_id AND m.sent_at > cm.last_read_at
WHERE cm.user_id = ? AND cm.is_active = true
GROUP BY cr.id
ORDER BY cr.updated_at DESC;

-- ✅ 2. 使用インデックス確認
EXPLAIN (ANALYZE, BUFFERS) [上記クエリ];
```

### フロントエンド最適化
```typescript
// ✅ 1. 仮想化リスト（長いメッセージ履歴）
import { FixedSizeList as List } from 'react-window'

const MessageList = ({ messages }) => (
  <List
    height={600}
    itemCount={messages.length}
    itemSize={80}
    itemData={messages}
  >
    {MessageItem}
  </List>
)

// ✅ 2. メモ化によるレンダリング最適化
const MessageItem = React.memo(({ message, style }) => (
  <div style={style}>
    {/* メッセージ表示 */}
  </div>
))
```

## トラブルシューティングガイド

### よくある実装エラーと対策

#### 1. ドメイン層のエラー
```typescript
// ❌ 悪い例：エンティティの直接操作
chatRoom.members.push(newMember) // 不変性を破壊

// ✅ 良い例：エンティティメソッド経由
chatRoom.addMember(userId, MemberRole.MEMBER) // ビジネスルール適用
```

#### 2. WebSocketエラー
```typescript
// ❌ 悪い例：認証なしメッセージ送信
socket.on('send_message', async (data) => {
  // 認証チェックなし
  await saveMessage(data)
})

// ✅ 良い例：認証チェック付き
socket.on('send_message', async (data) => {
  if (!socket.authenticated) {
    socket.emit('error', { code: 'UNAUTHORIZED' })
    return
  }
  await saveMessage(data)
})
```

#### 3. フロントエンド状態管理エラー
```typescript
// ❌ 悪い例：状態の直接変更
state.messages[roomId].push(newMessage) // イミュータブル違反

// ✅ 良い例：イミュータブル更新
set(state => ({
  messages: {
    ...state.messages,
    [roomId]: [...(state.messages[roomId] || []), newMessage]
  }
}))
```

## 次のフェーズへの準備

### Phase 2準備事項
- [ ] Phase 1の全テストが通過している
- [ ] 基本的な1対1チャット機能が動作している
- [ ] WebSocket接続が安定している
- [ ] データベースパフォーマンスが要求を満たしている
- [ ] フロントエンドのレスポンシブデザインが完成している

### Phase 2実装項目（参考）
- グループチャット機能拡張
- タイピング状態表示
- 既読・未読機能
- オンライン状態表示
- メンバー管理UI

---

**更新履歴:**
- 2025-08-10: 初回作成（architecture-specialist）
- 2025-08-10: 実装順序と依存関係の詳細化
- 2025-08-10: パフォーマンス考慮事項追加
- 2025-08-10: トラブルシューティングガイド追加