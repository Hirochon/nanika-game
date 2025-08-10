# アーキテクチャ移行仕様書

## 概要
現在のReact Router v7中心の実装において、既存のSSRサーバー内でDDD（Domain-Driven Design）とクリーンアーキテクチャを適用し、mock-auth.server.tsを真のドメイン駆動実装に置き換える。

## 要件

### 機能要件
- 現在のログイン・ログアウト機能の完全な互換性維持
- React Router v7 SSRサーバー内でのDDD実装
- 既存のHTTPOnlyクッキーセッション管理の継続
- loader/action関数を活用したController層の実装

### 非機能要件
- **アーキテクチャ**: DDD + クリーンアーキテクチャの厳格な適用
- **テスト性**: 各レイヤーが独立してテスト可能
- **保守性**: 依存関係の方向性を内側（Domain）に向ける
- **継続性**: React Router v7の既存機能を最大限活用

## 現状分析と問題点

### 現在の実装状況
```
現在の認証フロー:
React Router v7 SSRサーバー:
├── loader/action (Controller層相当)
├── mock-auth.server.ts (モックロジック)
└── HTTPOnlyクッキー設定 ✅動作中
```

### 主要な問題点
1. **アーキテクチャ違反**
   - mock-auth.server.tsに認証ビジネスロジックが直接実装
   - ドメインエンティティ（User, Session）の概念が欠如
   - 値オブジェクト（Email, Password）が未定義

2. **依存関係の逆転未実装**
   - loader/action内で直接mock-auth.server.tsを呼び出し
   - インターフェース（リポジトリ）を介さないDB操作
   - テスト困難な密結合構造

3. **スケーラビリティの問題**
   - ビジネスロジックの散在
   - 新機能追加時の影響範囲が不明確
   - ドメインサービスの未分離

## DDD境界コンテキスト定義

### 1. Authentication Context（認証コンテキスト）
**責務**: ユーザー認証・認可・セッション管理

**エンティティ**:
- `User` - ユーザーの基本情報と認証状態
- `Session` - セッション情報と有効期限管理

**値オブジェクト**:
- `Email` - メールアドレスの形式検証
- `Password` - パスワード強度とハッシュ化
- `SessionToken` - セッショントークンの生成・検証

**ドメインサービス**:
- `AuthenticationService` - 認証ロジック
- `SessionService` - セッション管理ロジック

**リポジトリ**:
- `IUserRepository` - ユーザーデータの永続化
- `ISessionRepository` - セッションデータの永続化

### 2. User Management Context（将来拡張）
**責務**: ユーザープロフィール管理、登録処理

### 3. Game Context（将来拡張） 
**責務**: ゲーム機能、スコア管理

## React Router v7内でのクリーンアーキテクチャ層設計

### Domain層（app/domain/）
```typescript
// エンティティ例
export class User {
  private constructor(
    private readonly id: UserId,
    private readonly email: Email,
    private readonly hashedPassword: Password,
    private readonly createdAt: Date
  ) {}

  static create(email: string, password: string): User {
    return new User(
      UserId.generate(),
      Email.create(email),
      Password.create(password),
      new Date()
    );
  }

  authenticate(password: string): boolean {
    return this.hashedPassword.verify(password);
  }
}
```

### Application層（app/application/）
```typescript
// ユースケース例
export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private sessionService: ISessionService
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(command.email);
    
    if (!user || !user.authenticate(command.password)) {
      throw new AuthenticationError('Invalid credentials');
    }

    const session = this.sessionService.createSession(user);
    return LoginResult.success(session);
  }
}
```

### Infrastructure層（app/infrastructure/）
```typescript
// リポジトリ実装例
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: Email): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email: email.value }
    });
    
    return userData ? User.reconstruct(userData) : null;
  }
}
```

### Controller層（React Router loader/action）
```typescript
// app/routes/login.tsx - action関数
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const command = LoginCommand.fromFormData(formData);
    
    // DIコンテナから取得
    const loginUseCase = container.resolve(LoginUseCase);
    const result = await loginUseCase.execute(command);
    
    // React Router v7のリダイレクト
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': `session=${result.sessionToken}; HttpOnly; SameSite=Lax`
      }
    });
  } catch (error) {
    return { error: error.message };
  }
}
```

## 段階的移行計画

### Phase 1: Domain層基盤整備（1週間）
1. **📋 ディレクトリ構造の整備**
   - app/domain/, app/application/, app/infrastructure/ 作成
   - tsconfig.json パス設定更新

2. **📋 Domain層の実装**
   - User, Session エンティティ
   - Email, Password, UserId 値オブジェクト
   - AuthenticationService ドメインサービス
   - IUserRepository, ISessionRepository インターフェース

3. **📋 Domain層テストの実装**
   - エンティティ・値オブジェクトの単体テスト

### Phase 2: Application層実装（1週間）
1. **📋 ユースケースの実装**
   - LoginUseCase, LogoutUseCase
   - Command, Result オブジェクト

2. **📋 DIコンテナ設定**
   - tsyringe設定
   - 依存関係注入の実装

3. **📋 Application層テスト**
   - ユースケースの単体テスト・統合テスト

### Phase 3: Infrastructure層実装（1週間）
1. **📋 Prisma設定**
   - 既存PostgreSQL用スキーマ定義
   - リポジトリ実装（PrismaUserRepository）

2. **📋 Infrastructure層テスト**
   - リポジトリの統合テスト

### Phase 4: React Router統合（1週間）
1. **📋 loader/action関数の更新**
   - 既存のloginアクションをUseCaseパターンに変更
   - DIコンテナからの依存性取得

2. **📋 既存Mock削除**
   - mock-auth.server.ts削除
   - 関連テストの更新

3. **📋 統合テスト**
   - E2E認証フローテスト

### Phase 5: 最終調整・最適化（1週間）
1. **📋 パフォーマンス確認**
   - 既存機能との性能比較
   - 必要に応じた最適化

2. **📋 文書更新**
   - アーキテクチャ図更新
   - 開発者ガイド作成

## 技術スタック選定

### React Router v7 SSRサーバー内技術選定
- **SSRサーバー**: React Router v7（既存・継続利用）
- **ORM**: Prisma（型安全・開発効率）
- **Database**: PostgreSQL（既存Docker環境）
- **DI**: tsyringe（軽量・Microsoft製）
- **Validation**: zod（型安全なバリデーション）

### 開発環境
- **Language**: TypeScript（全体）
- **Testing**: Vitest（既存・継続）
- **Linting**: Biome（既存・継続）
- **Container**: Docker Compose（既存・継続）

## ディレクトリ構造（移行後）

```
/
├── docs/
│   ├── api/                          # API仕様書
│   │   ├── authentication-api-spec.md
│   │   └── user-management-api-spec.md
│   └── web/                          # フロントエンド仕様書
│       ├── user-login-spec.md
│       └── logout-spec.md
├── development-process/
│   ├── api/                          # API開発プロセス
│   └── web/                          # フロントエンド開発プロセス
├── apps/
│   ├── web/                          # React Router v7 アプリ
│   │   ├── app/
│   │   │   ├── routes/              # ページコンポーネント
│   │   │   ├── components/          # 共通コンポーネント
│   │   │   └── services/            # API クライアント
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── api/                          # バックエンド API
│       ├── src/
│       │   ├── main.ts              # エントリーポイント
│       │   ├── application/         # ユースケース層
│       │   │   ├── use-cases/
│       │   │   │   ├── login.use-case.ts
│       │   │   │   └── logout.use-case.ts
│       │   │   ├── commands/
│       │   │   └── results/
│       │   ├── controllers/         # HTTP Controller
│       │   │   ├── auth.controller.ts
│       │   │   └── health.controller.ts
│       │   ├── infrastructure/      # インフラ層
│       │   │   ├── persistence/
│       │   │   │   ├── prisma/
│       │   │   │   ├── repositories/
│       │   │   │   └── migrations/
│       │   │   └── services/
│       │   ├── middlewares/         # Express middleware
│       │   ├── dtos/               # Data Transfer Objects
│       │   └── config/             # 設定
│       ├── prisma/
│       │   └── schema.prisma
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── core/                        # 共有ドメイン
│       ├── src/
│       │   ├── domain/              # ドメイン層
│       │   │   ├── entities/
│       │   │   │   ├── user.entity.ts
│       │   │   │   └── session.entity.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── email.vo.ts
│       │   │   │   ├── password.vo.ts
│       │   │   │   └── user-id.vo.ts
│       │   │   ├── services/
│       │   │   │   ├── authentication.service.ts
│       │   │   │   └── session.service.ts
│       │   │   └── repositories/
│       │   │       ├── user.repository.ts
│       │   │       └── session.repository.ts
│       │   └── shared/              # 共有ユーティリティ
│       │       ├── errors/
│       │       │   ├── domain.error.ts
│       │       │   └── authentication.error.ts
│       │       ├── types/
│       │       └── utils/
│       ├── package.json
│       └── tsconfig.json
├── oas/                             # OpenAPI仕様
│   └── authentication.yaml
├── docker-compose.yml
├── package.json                     # ルートパッケージ
└── tsconfig.json                   # 共通TypeScript設定
```

## マイグレーション戦略

### データマイグレーション
- 現在のPostgreSQL Dockerデータベースをそのまま活用
- Prismaスキーマで既存テーブル構造を定義
- 段階的データ移行（必要に応じて）

### フロントエンド移行
- React Router v7のloader/actionから独立したAPIクライアントに変更
- `/api/*` エンドポイントへのHTTP呼び出し
- エラーハンドリングの統一

### 後方互換性
- フロントエンドUIは現在の機能を完全維持
- ユーザー体験への影響を最小限に抑制

## リスク管理

### 技術的リスク
1. **複雑性の増加** → 段階的移行とシンプルな実装から開始
2. **パフォーマンス劣化** → 適切なキャッシング戦略
3. **開発速度の低下** → 十分なテスト実装で品質担保

### ビジネスリスク
1. **機能停止** → Blue-Green deploymentでリスク最小化
2. **学習コスト** → 詳細な設計文書とサンプル実装

## 成功基準

### 技術的成功基準
- [ ] 全てのドメインロジックがフレームワーク非依存
- [ ] 依存関係が内側（Domain）に向いている
- [ ] 各レイヤーが独立してテスト可能
- [ ] 新機能追加時の変更範囲が限定的

### 機能的成功基準
- [ ] 現在のログイン・ログアウト機能が完全動作
- [ ] レスポンス時間が現在と同等以上
- [ ] セキュリティレベルの向上

## 次のステップ

1. **この仕様書のレビューと承認**
2. **development-process/architecture-migration-process.md の作成**
3. **Phase 1 の詳細実装計画策定**
4. **PoC実装の開始**

---

この移行により、nanika-gameは真のエンタープライズレベルのアーキテクチャを持つアプリケーションとして成長し、長期的な保守性とスケーラビリティを獲得できます。