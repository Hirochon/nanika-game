# チャット機能 仕様書

## 概要
ユーザー間でリアルタイムにメッセージを送受信できるチャット機能を提供する。
1対1チャットとグループチャットの両方をサポートし、**WebSocket**を使用してリアルタイム通信を実現する。

**実装方針**：**Socket.io**をWebSocketライブラリとして使用し、PostgreSQLデータベースでメッセージの永続化を行う。

## 実装済み機能（2025年8月現在）

### ✅ 完成済み機能
- WebSocketによるリアルタイムメッセージ送受信
- グループチャット機能（General Chat、Game Discussion）
- チャットルーム一覧表示
- メッセージ履歴の表示と永続化
- 日本語入力対応（Ctrl+Enterで送信）
- ユーザー識別（管理者、ユーザー1、ユーザー2、ゲスト）
- オンライン状態管理
- タイピング状態表示
- セッションベース認証
- 自動再接続機能

### 🔧 技術的実装
- **フロントエンド**: React + TypeScript + Zustand
- **バックエンド**: Express + Socket.io + Prisma
- **データベース**: PostgreSQL（Prismaマイグレーション済み）
- **セッション管理**: Redis + express-session
- **WebSocket**: Socket.io（polling/WebSocket両対応）

## 要件

### 機能要件

#### 1対1チャット
- ユーザーは他のユーザーと1対1でチャットできる
- チャット相手をユーザー一覧から選択できる
- 過去のメッセージ履歴を表示する
- 未読メッセージ数を表示する
- メッセージの送信時刻を表示する
- オンライン/オフライン状態を表示する

#### グループチャット
- ユーザーはグループチャットルームを作成できる
- グループに他のユーザーを招待できる
- グループメンバーの一覧を表示する
- グループ名と説明を設定できる
- グループの管理者権限を設定できる
- グループから退出できる

#### リアルタイム機能
- メッセージの送受信をリアルタイムで行う
- ユーザーのオンライン状態をリアルタイムで更新
- 入力中（typing）状態の表示
- メッセージの既読状態表示

### 非機能要件
- メッセージは1000文字以内とする
- 過去のメッセージは50件ずつページングで取得する
- WebSocket接続の自動再接続機能
- メッセージの配信確認（送信済み、配信済み、既読）
- プッシュ通知（将来実装）

## インターフェース

### 入力

#### メッセージ送信
```typescript
interface SendMessageRequest {
  chatRoomId: string;
  content: string;
  type: 'text' | 'image' | 'file'; // Phase1では'text'のみ
}
```

#### チャットルーム作成
```typescript
interface CreateChatRoomRequest {
  name?: string; // グループチャットの場合のみ
  description?: string; // グループチャットの場合のみ
  type: 'direct' | 'group';
  memberIds: string[]; // 初期メンバーのユーザーID
}
```

#### グループメンバー招待
```typescript
interface InviteMemberRequest {
  chatRoomId: string;
  userIds: string[];
}
```

### 出力

#### メッセージ（WebSocket）
```typescript
interface MessageEvent {
  id: string;
  chatRoomId: string;
  userId: string;
  userName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
}
```

#### チャットルーム一覧
```typescript
interface ChatRoom {
  id: string;
  name?: string; // グループチャットの場合のみ
  type: 'direct' | 'group';
  lastMessage?: {
    content: string;
    createdAt: string;
    userName: string;
  };
  unreadCount: number;
  members: {
    userId: string;
    userName: string;
    isOnline: boolean;
  }[];
}
```

## データベーススキーマ

### chat_roomsテーブル
```sql
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100), -- グループチャットの場合のみ
  description TEXT, -- グループチャットの場合のみ
  type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### chat_membersテーブル
```sql
CREATE TABLE chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP,
  UNIQUE(chat_room_id, user_id)
);
```

### messagesテーブル
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### message_statusテーブル
```sql
CREATE TABLE message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);
```

### インデックス
```sql
-- チャットルーム内のメッセージ取得用
CREATE INDEX idx_messages_chat_room_created_at ON messages(chat_room_id, created_at DESC);

-- ユーザーのチャットルーム一覧取得用
CREATE INDEX idx_chat_members_user_id ON chat_members(user_id);

-- 未読メッセージカウント用
CREATE INDEX idx_message_status_user_status ON message_status(user_id, status);
```

## ビジネスルール

### バリデーション規則
1. **メッセージ内容**: 1-1000文字、XSS対策のためHTMLタグをエスケープ
2. **グループ名**: 1-100文字（グループチャットの場合）
3. **グループ説明**: 0-500文字（グループチャットの場合）
4. **メンバー数**: グループチャットは最大100人まで

### チャットルール
1. **1対1チャット**：既存のチャットルームがある場合は新規作成しない
2. **グループチャット**：作成者が自動的に管理者となる
3. **メッセージ削除**：送信者のみが自分のメッセージを削除可能
4. **退出処理**：グループの最後の管理者が退出する場合は他のメンバーに管理者権限を移譲

### セキュリティ規則
1. ユーザーは自分が参加しているチャットルームのメッセージのみ閲覧可能
2. WebSocket接続時に認証トークンで認証
3. メッセージの送信レート制限（1分間に20メッセージまで）
4. 不適切なコンテンツフィルタリング（将来実装）

## WebSocket設計

### イベント設計

#### クライアント → サーバー
```typescript
// メッセージ送信
socket.emit('send_message', {
  chatRoomId: string,
  content: string,
  type: 'text'
});

// チャットルーム参加
socket.emit('join_room', { chatRoomId: string });

// チャットルーム退出
socket.emit('leave_room', { chatRoomId: string });

// タイピング状態送信
socket.emit('typing_start', { chatRoomId: string });
socket.emit('typing_stop', { chatRoomId: string });
```

#### サーバー → クライアント
```typescript
// 新しいメッセージ受信
socket.on('new_message', (message: MessageEvent) => {});

// ユーザーのオンライン状態変更
socket.on('user_status_change', {
  userId: string,
  isOnline: boolean
});

// タイピング状態受信
socket.on('user_typing', {
  userId: string,
  userName: string,
  chatRoomId: string,
  isTyping: boolean
});

// メッセージ配信確認
socket.on('message_delivered', {
  messageId: string,
  chatRoomId: string
});
```

### 認証フロー
1. WebSocket接続時にクッキーからセッション情報を取得
2. セッション検証後、ユーザーIDとSocket IDを関連付け
3. ユーザーが参加しているチャットルームに自動参加
4. オンライン状態を他のユーザーに通知

## API設計（REST API）

### チャットルーム管理
```
GET    /api/chat-rooms          # チャットルーム一覧取得
POST   /api/chat-rooms          # チャットルーム作成
GET    /api/chat-rooms/:id      # チャットルーム詳細取得
PUT    /api/chat-rooms/:id      # チャットルーム更新（グループのみ）
DELETE /api/chat-rooms/:id      # チャットルーム削除

POST   /api/chat-rooms/:id/members    # メンバー招待
DELETE /api/chat-rooms/:id/members/:userId # メンバー削除
```

### メッセージ管理
```
GET    /api/chat-rooms/:id/messages   # メッセージ履歴取得（ページング）
POST   /api/messages/:id/read         # メッセージ既読マーク
DELETE /api/messages/:id              # メッセージ削除
```

### ユーザー管理
```
GET    /api/users/search              # ユーザー検索（招待用）
GET    /api/users/online              # オンラインユーザー一覧
```

## エラーケース

### バリデーションエラー
- **E001**: メッセージが空または1000文字を超過
- **E002**: チャットルーム名が空または100文字を超過
- **E003**: 無効なメッセージタイプ
- **E004**: 無効なチャットルームタイプ

### 権限エラー
- **E101**: チャットルームへのアクセス権限なし
- **E102**: メッセージの削除権限なし
- **E103**: グループの管理者権限なし
- **E104**: WebSocket認証失敗

### リソースエラー
- **E201**: チャットルームが存在しない
- **E202**: メッセージが存在しない
- **E203**: ユーザーが存在しない
- **E204**: メンバー数制限超過

### システムエラー
- **E301**: WebSocket接続エラー
- **E302**: データベース接続エラー
- **E303**: メッセージ配信エラー
- **E304**: レート制限超過

## セキュリティ考慮事項
- WebSocket認証（セッションベース）
- メッセージの暗号化（将来実装）
- XSS対策（メッセージ内容のエスケープ）
- レート制限（送信頻度制御）
- 不適切コンテンツフィルタリング（将来実装）
- チャットログの保存期間制限（将来実装）

## パフォーマンス要件
- メッセージ送信の応答時間：100ms以内
- 同時WebSocket接続数：1000接続まで対応
- メッセージ履歴の取得：500ms以内
- リアルタイム配信の遅延：200ms以内

## Phase別実装計画

### Phase 1（MVP）
- 1対1チャット
- テキストメッセージ送受信
- リアルタイム通信（WebSocket）
- 基本的なUIコンポーネント

### Phase 2（機能拡張）
- グループチャット
- オンライン状態表示
- タイピング状態表示
- メッセージ既読機能

### Phase 3（高度な機能）
- ファイル・画像送信
- メッセージ検索
- プッシュ通知
- 不適切コンテンツフィルタリング