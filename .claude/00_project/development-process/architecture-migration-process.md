# アーキテクチャ移行 開発プロセス

## 📋 プログレス記号システム
- ✅ **完了** - 作業が完全に終了し、テスト済み
- 🔄 **作業中** - 現在進行中の作業（**同時に複数は禁止**）
- 📋 **実装予定** - 計画済みで順次実装予定の作業
- ⏸️ **実装保留** - 特定の理由により実装を保留中の作業
- ❌ **失敗/エラー** - 問題が発生した作業
- 🔍 **調査中** - 技術調査や設計検討中

## Phase 1: 基盤整備（1-2週間）

### 技術調査・設計フェーズ
1. ✅ アーキテクチャ移行仕様書作成 (`docs/architecture-migration-spec.md`)
2. 🔍 monorepo構造の技術調査（Lerna vs Nx vs pnpm workspace）
3. 🔍 DIコンテナ選定調査（tsyringe vs inversify vs awilix）
4. 🔍 Prisma + PostgreSQL移行パス調査
5. 🔍 Express vs Fastify パフォーマンス比較

### ディレクトリ構造再編成
1. 📋 ルートpackage.jsonの workspace設定
2. 📋 apps/web/ ディレクトリ作成と既存app/移動
3. 📋 apps/api/ ディレクトリ構造作成
4. 📋 packages/core/ ディレクトリ構造作成
5. 📋 各パッケージのpackage.json設定
6. 📋 TypeScript設定ファイルの整理
7. 📋 ビルド・開発スクリプトの更新

### Domain層実装（packages/core/src/domain）
1. 📋 値オブジェクト実装
   - `Email` (packages/core/src/domain/value-objects/email.vo.ts)
   - `Password` (packages/core/src/domain/value-objects/password.vo.ts)
   - `UserId` (packages/core/src/domain/value-objects/user-id.vo.ts)
   - `SessionToken` (packages/core/src/domain/value-objects/session-token.vo.ts)

2. 📋 エンティティ実装
   - `User` (packages/core/src/domain/entities/user.entity.ts)
   - `Session` (packages/core/src/domain/entities/session.entity.ts)

3. 📋 ドメインサービス実装
   - `AuthenticationService` (packages/core/src/domain/services/authentication.service.ts)
   - `SessionService` (packages/core/src/domain/services/session.service.ts)

4. 📋 リポジトリインターフェース定義
   - `IUserRepository` (packages/core/src/domain/repositories/user.repository.ts)
   - `ISessionRepository` (packages/core/src/domain/repositories/session.repository.ts)

5. 📋 ドメインエラー定義
   - `DomainError` (packages/core/src/shared/errors/domain.error.ts)
   - `AuthenticationError` (packages/core/src/shared/errors/authentication.error.ts)

### テスト実装（Domain層）
1. 📋 値オブジェクトのテスト
   - `Email` バリデーションテスト
   - `Password` 強度・ハッシュ化テスト
   - `UserId` 生成テスト

2. 📋 エンティティのテスト
   - `User` 作成・認証テスト
   - `Session` 期限管理テスト

3. 📋 ドメインサービスのテスト
   - `AuthenticationService` 認証ロジックテスト
   - `SessionService` セッション管理テスト

## Phase 2: Application層実装（1週間）

### ユースケース実装（apps/api/src/application）
1. 📋 コマンド・レスポンス定義
   - `LoginCommand` (apps/api/src/application/commands/login.command.ts)
   - `LogoutCommand` (apps/api/src/application/commands/logout.command.ts)
   - `LoginResult` (apps/api/src/application/results/login.result.ts)

2. 📋 ユースケース実装
   - `LoginUseCase` (apps/api/src/application/use-cases/login.use-case.ts)
   - `LogoutUseCase` (apps/api/src/application/use-cases/logout.use-case.ts)

3. 📋 DIコンテナ設定
   - `Container` (apps/api/src/application/container.ts)
   - 依存関係注入の設定

### アプリケーション層テスト
1. 📋 ユースケースのテスト
   - `LoginUseCase` 正常系・異常系テスト
   - `LogoutUseCase` 正常系・異常系テスト

2. 📋 統合テスト（モックリポジトリ使用）
   - 認証フロー統合テスト
   - エラーハンドリングテスト

## Phase 3: Infrastructure層実装（1-2週間）

### データベース設定
1. 📋 Prisma設定とスキーマ定義
   - `schema.prisma` (apps/api/prisma/schema.prisma)
   - 既存PostgreSQLテーブルとの整合性確認

2. 📋 マイグレーション作成
   - 初期マイグレーション生成
   - 既存データとの整合性テスト

### リポジトリ実装（apps/api/src/infrastructure）
1. 📋 Prismaリポジトリ実装
   - `PrismaUserRepository` (apps/api/src/infrastructure/persistence/repositories/prisma-user.repository.ts)
   - `PrismaSessionRepository` (apps/api/src/infrastructure/persistence/repositories/prisma-session.repository.ts)

2. 📋 インフラ設定
   - データベース接続設定
   - 環境変数管理

### HTTP API実装（apps/api/src/controllers）
1. 📋 Express設定
   - `main.ts` サーバー設定
   - ミドルウェア設定（CORS、Cookie Parser等）

2. 📋 Controller実装
   - `AuthController` (apps/api/src/controllers/auth.controller.ts)
   - `HealthController` (apps/api/src/controllers/health.controller.ts)

3. 📋 DTO実装
   - `LoginDto` (apps/api/src/dtos/login.dto.ts)
   - `LogoutDto` (apps/api/src/dtos/logout.dto.ts)

4. 📋 ミドルウェア実装
   - `AuthenticationMiddleware` (apps/api/src/middlewares/auth.middleware.ts)
   - `ValidationMiddleware` (apps/api/src/middlewares/validation.middleware.ts)

### Infrastructure層テスト
1. 📋 リポジトリテスト（実DB使用）
   - Prismaリポジトリの統合テスト
   - データベース操作テスト

2. 📋 API統合テスト
   - HTTP エンドポイントテスト
   - Cookie設定・削除テスト

## Phase 4: フロントエンド接続（1週間）

### APIクライアント実装（apps/web）
1. 📋 API クライアント作成
   - `AuthApiClient` (apps/web/app/services/auth-api.client.ts)
   - HTTP リクエスト・エラーハンドリング

2. 📋 React Router統合
   - loader/actionからAPIクライアント呼び出しに変更
   - エラー処理の統一

### フロントエンド更新
1. 📋 既存コンポーネント更新
   - `login.tsx` APIクライアント使用に変更
   - `dashboard.tsx` APIクライアント使用に変更

2. 📋 エラーハンドリング改善
   - API エラーレスポンス処理
   - ユーザーフレンドリーなエラーメッセージ

### E2Eテスト実装
1. 📋 統合テストシナリオ
   - ログイン→ダッシュボード→ログアウト フロー
   - エラーケースの確認

## Phase 5: 移行完了・最適化（1週間）

### 既存実装クリーンアップ
1. 📋 Mock実装削除
   - `mock-auth.server.ts` 削除
   - `mock-auth.ts` 削除
   - `mock-auth.test.ts` 削除

2. 📋 不要ファイル削除
   - 旧構造の清理
   - 未使用依存関係の削除

### パフォーマンス最適化
1. 📋 キャッシング実装
   - セッション情報のキャッシング
   - データベースクエリ最適化

2. 📋 セキュリティ強化
   - HTTPS強制設定
   - セキュリティヘッダー追加
   - レート制限実装

### 最終テスト・検証
1. 📋 全機能動作確認
   - 新アーキテクチャでの動作テスト
   - パフォーマンス測定

2. 📋 文書更新
   - README更新
   - APIドキュメント生成

## 実装順序（厳守）
1. ✅ 仕様書・プロセス文書作成
2. 🔍 技術調査フェーズ完了
3. 📋 ディレクトリ構造整備
4. 📋 Domain層実装（Inside-Out）
5. 📋 Application層実装
6. 📋 Infrastructure層実装
7. 📋 React Router統合
8. 📋 移行完了・最適化

## 技術スタック

### React Router v7 SSRサーバー
- **Framework**: React Router v7 SSR
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 15
- **DI Container**: tsyringe 4.x
- **Validation**: zod 3.x
- **Testing**: Vitest
- **Language**: TypeScript 5.x
- **Linting**: Biome

## セキュリティ要件
- ✅ HTTPOnlyクッキーによるセッション管理（現在と同等）
- 📋 CSRF対策（SameSite=Lax設定）
- 📋 SQL Injection対策（Prismaによる自動対策）
- 📋 XSS対策（適切なレスポンスヘッダー）
- 📋 レート制限実装（認証エンドポイント）

## パフォーマンス目標
- **loader/action応答時間**: 現在のmock-auth.server.tsと同等以下（50ms以内）
- **フロントエンド遷移時間**: 現在と同等（200ms以内）
- **データベース接続**: コネクションプール活用で高速化
- **SSRサーバーメモリ**: 現在の+15%以内に抑制

## 既知のリスクと対策
- 📋 **リスク1**: DDD複雑性増加による開発速度低下 → **対策**: 段階的実装と十分なテスト実装
- 📋 **リスク2**: DIコンテナの学習コスト → **対策**: シンプルな実装から開始
- 📋 **リスク3**: 新アーキテクチャでのバグ混入 → **対策**: 包括的テストと段階的ロールアウト

## マイルストーン

### Week 1: Phase 1（Domain層基盤整備）
- [ ] ディレクトリ構造完了
- [ ] Domain層実装完了
- [ ] Domain層テスト完了

### Week 2: Phase 2（Application層）
- [ ] ユースケース実装完了
- [ ] DI設定完了
- [ ] Application層テスト完了

### Week 3: Phase 3（Infrastructure層）
- [ ] Prisma設定完了
- [ ] リポジトリ実装完了
- [ ] Infrastructure層テスト完了

### Week 4: Phase 4（React Router統合）
- [ ] loader/action関数更新完了
- [ ] 既存コンポーネント更新完了
- [ ] E2Eテスト完了

### Week 5: Phase 5（移行完了）
- [ ] クリーンアップ完了
- [ ] パフォーマンス最適化完了
- [ ] 全テスト通過確認
- [ ] 文書更新完了

## 変更履歴
- 2025-08-09: 初回プロセス計画作成（プログレス管理開始）
- 2025-08-09: DDD + クリーンアーキテクチャ移行プロセス策定
- 2025-08-09: React Router v7 SSRサーバー内DDDアプローチへ修正
- 2025-08-09 18:42: Phase 1-3完了 (Domain/Application/Infrastructure層実装完了)

## 現在の実装状況 (2025-08-09 18:42)

### ✅ 完了済み
- **Phase 1**: Domain層（エンティティ、値オブジェクト、サービス、リポジトリIF）
- **Phase 2**: Application層（ユースケース、コマンド/レスポンス、DIコンテナ）  
- **Phase 3**: Infrastructure層（Prismaリポジトリ実装、DB設定）
- **テスト**: Domain層の基本テスト（29テスト中28パス、1修正済み）

### 🔄 作業中  
- **Phase 4**: React Router統合 - login.tsx action関数のLoginUseCase対応

### 📋 次の予定
1. login.tsx action関数をLoginUseCase使用に変更
2. dashboard.tsx loader/action関数をUseCase統合
3. エラーハンドリング改善
4. E2Eテスト実装
5. Mock実装クリーンアップ