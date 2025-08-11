# サーバー統合仕様書

## 概要
React Routerアプリケーションに適したExpress + Socket.ioサーバー統合と認証システムを実装し、チャット機能の接続問題を解決する。

## 実装済み機能（2025年8月現在）

### ✅ 完成済み機能

#### サーバー統合
- **app/server.ts**: Express + Socket.io統合サーバー
- **app/integration-server.ts**: React Router統合サーバー
- HTTP/WebSocket両対応のハイブリッドサーバー
- 開発環境と本番環境の自動切り替え

#### 認証システム
- セッションベース認証（express-session + Redis）
- テストユーザー4名でのログイン機能
  - admin@example.com / admin123
  - user1@example.com / password123
  - user2@example.com / password123
  - guest@example.com / guest123
- WebSocket認証（セッション検証）
- オプショナル認証ミドルウェア

#### セキュリティ機能
- Helmet.jsによるセキュリティヘッダー
- CORS設定（GitHub Codespaces対応）
- レート制限（15分間で100リクエスト）
- コンテンツタイプ検証
- リクエストサイズ制限（10MB）
- セキュリティログ記録

#### WebSocket機能
- Socket.io実装（polling/WebSocket両対応）
- Redisアダプター設定（スケーリング対応）
- 自動再接続機能
- ルーム管理（join/leave）
- リアルタイムメッセージ配信
- ユーザー状態管理（オンライン/タイピング）

#### APIエンドポイント
- **/health**: ヘルスチェック
- **/api/health**: APIヘルスチェック
- **/api/session-stats**: セッション統計
- **/api/auth/login**: ログイン
- **/api/auth/logout**: ログアウト
- **/api/users/search**: ユーザー検索
- **/api/chat/rooms**: チャットルーム一覧
- **/api/chat/rooms/:id/messages**: メッセージ履歴
- **/api/chat/rooms**: チャットルーム作成

### 🔧 技術スタック
- **サーバー**: Express 4.x + TypeScript
- **WebSocket**: Socket.io 4.x
- **セッション**: express-session + connect-redis
- **セキュリティ**: Helmet, CORS, レート制限
- **DI**: tsyringe + reflect-metadata
- **データベース**: Prisma + PostgreSQL
- **キャッシュ**: Redis (ioredis)

## 要件

### 機能要件
1. **Express + React Routerハイブリッドサーバー構築**
   - Expressサーバーを設定してReact Routerと統合
   - 開発環境とプロダクション環境の両対応
   - SSRモードでのサーバーサイドレンダリング対応

2. **認証システム統合**
   - セッションベース認証の実装
   - 既存のログイン機能との統合
   - WebSocket認証の実装
   - CSRF保護の実装

3. **Socket.ioサーバー統合** 
   - Express サーバーにSocket.ioを統合
   - 認証付きWebSocketサーバーの実装
   - Redis アダプターによるスケーリング対応

4. **APIエンドポイント統合**
   - 既存のAPIコントローラーをExpressルートに統合
   - エラーハンドリングミドルウェア実装
   - CORS、セキュリティヘッダー設定

### 非機能要件
1. **パフォーマンス**
   - WebSocketコネクションの効率的な管理
   - セッションストレージの最適化
   - 静的ファイル配信の最適化

2. **セキュリティ**
   - HTTPS対応
   - セッションセキュリティ
   - CSRF対策
   - XSS対策

3. **スケーラビリティ**
   - Redisによるセッション共有
   - WebSocketのクラスター対応

## インターフェース

### サーバー構成
```typescript
interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production';
  sessionSecret: string;
  redisUrl?: string;
  corsOrigins: string[];
}
```

### 認証セッション
```typescript
interface AuthenticatedSession {
  userId: string;
  email: string;
  isAuthenticated: boolean;
  createdAt: Date;
  expiresAt: Date;
}
```

### WebSocket認証
```typescript
interface SocketAuthData {
  userId: string;
  sessionToken: string;
  roomPermissions: string[];
}
```

## ビジネスルール

### 認証ルール
1. すべてのAPIエンドポイントは認証が必要（公開エンドポイントを除く）
2. WebSocketコネクションは有効なセッション必須
3. セッションは24時間で自動期限切れ
4. 認証失敗時は適切なHTTPステータスコードを返却

### WebSocketルール
1. 認証なしでのWebSocket接続は拒否
2. 同一ユーザーの複数接続を許可
3. ルーム参加には適切な権限が必要
4. 切断時は適切なクリーンアップを実行

### セッション管理ルール
1. セッションはRedisに保存（利用可能な場合）
2. セッション更新は自動的に行う
3. 不正なセッションは即座に無効化

## エラーケース

### 認証エラー
- `401 Unauthorized`: 未認証アクセス
- `403 Forbidden`: 権限不足
- `419 Authentication Timeout`: セッション期限切れ

### WebSocketエラー
- `WEBSOCKET_AUTH_FAILED`: WebSocket認証失敗
- `WEBSOCKET_ROOM_ACCESS_DENIED`: ルームアクセス拒否
- `WEBSOCKET_CONNECTION_LIMIT`: 接続数制限

### サーバーエラー
- `500 Internal Server Error`: サーバー内部エラー
- `503 Service Unavailable`: サービス利用不可
- `504 Gateway Timeout`: ゲートウェイタイムアウト

## 技術制約

### 依存関係
- Express.js 4.x
- Socket.io 4.x
- React Router 7.x
- Redis（オプション）
- Helmet（セキュリティヘッダー）
- express-session

### 環境変数
- `PORT`: サーバーポート（デフォルト: 3000）
- `NODE_ENV`: 環境（development/production）
- `SESSION_SECRET`: セッション秘密鍵
- `REDIS_URL`: Redis接続URL（オプション）
- `CORS_ORIGINS`: CORS許可オリジン

### パフォーマンス制約
- 最大同時WebSocket接続数: 1000
- セッション有効期限: 24時間
- APIレスポンス時間: 200ms以内（目標）

## セキュリティ要件

### HTTPS対応
- プロダクション環境ではHTTPS必須
- HTTP Strict Transport Securityヘッダー設定

### セッションセキュリティ
- セッションIDの定期的な再生成
- セキュアクッキー設定
- SameSite属性の適切な設定

### CSRF対策
- CSRFトークンの実装
- SameSiteクッキーによる保護

## 実装アプローチ

### フェーズ1: Express統合
1. Expressサーバーの基本設定
2. React Routerとの統合
3. 静的ファイル配信設定

### フェーズ2: 認証システム
1. セッションミドルウェア実装
2. 認証エンドポイント統合
3. 保護されたルート実装

### フェーズ3: WebSocket統合
1. Socket.ioサーバー統合
2. 認証付きWebSocket実装
3. Redisアダプター設定

### フェーズ4: セキュリティ強化
1. セキュリティヘッダー設定
2. CORS設定
3. CSRF対策実装

## テスト要件

### 単体テスト
- 認証ミドルウェアのテスト
- WebSocketハンドラーのテスト
- セッション管理のテスト

### 統合テスト
- APIエンドポイントの認証テスト
- WebSocket認証フローのテスト
- セッション管理の統合テスト

### E2Eテスト
- ログインからチャット参加までのフロー
- WebSocket接続と認証のフロー
- セッション期限切れ時の挙動