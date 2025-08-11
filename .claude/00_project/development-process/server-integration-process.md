# サーバー統合開発プロセス

## 📋 プログレス記号システム
- ✅ **完了** - 作業が完全に終了し、テスト済み
- 🔄 **作業中** - 現在進行中の作業（**同時に複数は禁止**）
- 📋 **実装予定** - 計画済みで順次実装予定の作業
- ⏸️ **実装保留** - 特定の理由により実装を保留中の作業
- ❌ **失敗/エラー** - 問題が発生した作業
- 🔍 **調査中** - 技術調査や設計検討中

## 技術調査・設計フェーズ
1. ✅ 現在のプロジェクト構造調査 - 既存実装を確認済み
2. ✅ パッケージ依存関係確認 - Express、Socket.io等必要な依存関係が既に追加済み
3. ✅ React Router設定確認 - SSR設定済み
4. 📋 Express + React Router統合方法調査
5. 📋 セッションベース認証設計
6. 📋 WebSocket認証フロー設計

## 実装ステップ

### Phase 1: Express統合とパッケージ更新
1. 📋 必要なパッケージの依存関係確認と追加 (`package.json`)
2. 📋 Express + React Routerハイブリッドサーバー実装 (`app/server.ts`)
3. 📋 静的ファイル配信とSSRの設定
4. 📋 基本的なヘルスチェックエンドポイント実装

### Phase 2: 認証システム統合
1. 📋 セッションストア設定（Redis使用）
2. 📋 認証ミドルウェア実装 (`app/api/middlewares/auth.ts`)
3. 📋 セッション管理ミドルウェア実装 (`app/api/middlewares/session.ts`)
4. 📋 CSRF対策ミドルウェア実装
5. 📋 既存認証コントローラーとの統合

### Phase 3: APIルーティング統合
1. 📋 Expressルーター設定 (`app/api/routes/index.ts`)
2. 📋 チャット関連APIの統合
3. 📋 ユーザー認証APIの統合
4. 📋 エラーハンドリングミドルウェア実装

### Phase 4: WebSocket統合
1. 📋 認証付きSocket.ioサーバー実装 (`app/api/infrastructure/websocket-server.ts`)
2. 📋 WebSocket認証ハンドラー統合
3. 📋 チャットソケットハンドラー統合
4. 📋 Redisアダプター設定

### Phase 5: セキュリティ強化
1. 📋 Helmetによるセキュリティヘッダー設定
2. 📋 CORS設定の適正化
3. 📋 HTTPS対応（プロダクション環境）
4. 📋 セッションセキュリティ強化

### Phase 6: 統合とテスト
1. 📋 開発環境での動作確認
2. 📋 認証フローの統合テスト
3. 📋 WebSocket接続テスト
4. 📋 セッション管理テスト

## テストケース

### 正常系テスト
- 📋 Express サーバーの起動と基本動作
- 📋 React Router SSRとの統合
- 📋 認証フローの正常動作
- 📋 WebSocket接続と認証
- 📋 セッション管理の正常動作

### 異常系テスト  
- 📋 認証失敗時のハンドリング
- 📋 セッション期限切れ時の処理
- 📋 WebSocket認証失敗の処理
- 📋 不正アクセス時のブロック処理

### セキュリティテスト
- 📋 CSRF攻撃の防御確認
- 📋 XSS攻撃の防御確認
- 📋 セッション固定攻撃の防御
- 📋 セキュリティヘッダーの確認

### パフォーマンステスト
- 📋 同時WebSocket接続数テスト
- 📋 セッションストアのパフォーマンス
- 📋 APIレスポンス時間測定

## 実装順序（厳守）
1. 📋 技術調査・設計フェーズ完了
2. 📋 パッケージ依存関係の更新
3. 📋 Express統合の基本実装
4. 📋 認証システムの統合
5. 📋 APIルーティング統合
6. 📋 WebSocket統合
7. 📋 セキュリティ強化
8. 📋 統合テスト実行

## 技術スタック
- **サーバー**: Express.js 4.x + React Router 7.x
- **WebSocket**: Socket.io 4.x
- **認証**: express-session + Redis
- **セキュリティ**: Helmet, CORS, CSRF対策
- **データベース**: PostgreSQL + Prisma
- **キャッシュ**: Redis（セッション・WebSocketアダプター）

## セキュリティ要件
- 📋 **HTTPS対応**: プロダクション環境での強制HTTPS
- 📋 **セッションセキュリティ**: セキュアクッキー、SameSite設定
- 📋 **CSRF対策**: CSRFトークンによる保護
- 📋 **XSS対策**: Content Security Policy設定
- 📋 **セキュリティヘッダー**: Helmet.jsによる包括的設定

## パフォーマンス目標
- **サーバー起動時間**: 3秒以内
- **APIレスポンス時間**: 200ms以内（目標）
- **WebSocket接続時間**: 100ms以内
- **同時接続数**: 1000まで対応

## 環境変数設定
```env
# サーバー設定
PORT=3000
NODE_ENV=development

# セッション設定
SESSION_SECRET=your-secret-key-here

# Redis設定（オプション）
REDIS_URL=redis://localhost:6379

# CORS設定
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# セキュリティ設定
HTTPS_ONLY=false # プロダクションではtrue
```

## 既知のリスクと対策
- 📋 **リスク1**: React RouterとExpressの統合複雑性 → **対策**: 段階的実装とテスト
- 📋 **リスク2**: WebSocket認証の複雑性 → **対策**: セッション共有の確実な実装
- 📋 **リスク3**: セッションストアのパフォーマンス → **対策**: Redis使用と適切な設定
- 📋 **リスク4**: CSRF攻撃のリスク → **対策**: CSRFトークンとSameSiteクッキー

## 変更履歴
- 2025-08-10: プロセス計画作成（プログレス管理開始）

## 依存関係管理
### 新規追加予定パッケージ
- express: Express.jsフレームワーク
- express-session: セッション管理
- connect-redis: Redisセッションストア
- cors: CORS対策
- @types/express: Express型定義
- @types/express-session: express-session型定義

### 既存パッケージの活用
- helmet: セキュリティヘッダー（既存）
- socket.io: WebSocketサーバー（既存）
- ioredis: Redis接続（既存）
- @react-router/node: React Router SSR（既存）

## 実装の注意点
1. **既存コードとの統合**: 既存のDIコンテナとクリーンアーキテクチャを維持
2. **セッション共有**: WebSocketとAPIで同一セッションを使用
3. **エラーハンドリング**: 統一されたエラーレスポンス形式の維持
4. **テスト環境**: 実際のRedis接続を使用したテスト設計
5. **開発体験**: ホットリロードとSSRの両立