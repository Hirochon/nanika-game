# アーキテクチャ設計

## 目的と概要

このドキュメントは、Nanｉka Game プロジェクトのアーキテクチャ設計について詳述します。本プロジェクトはDDD（Domain-Driven Design）とClean Architectureの原則に基づいて設計されており、保守性、拡張性、テストしやすさを重視したゲームアプリケーションです。

## 現在の実装状況

- DDDとClean Architectureの基本レイヤー構成を実装済み
- 認証機能（ログイン、ログアウト、ユーザー登録、セッション管理）を実装
- DIコンテナ（tsyringe）による依存性注入を実装
- Repository Patternによるデータアクセス抽象化を実装
- Value Objectによるドメイン値の型安全性を確保

## アーキテクチャ原則

### 1. Clean Architectureの依存性ルール

依存関係は常に内側（ドメイン層）に向かいます：

```
Infrastructure Layer → Application Layer → Domain Layer
     ↓                     ↓                    ↓
外部システム              ユースケース        ビジネスロジック
（DB、Web等）           （オーケストレーション）  （ドメインルール）
```

**許可される依存関係:**
- ✅ Application → Domain
- ✅ Infrastructure → Domain
- ✅ Infrastructure → Application

**禁止される依存関係:**
- ❌ Domain → Application
- ❌ Domain → Infrastructure
- ❌ Application → Infrastructure

### 2. DDDの戦術的パターン

#### Entity（エンティティ）
アイデンティティを持つドメインオブジェクト

```typescript
// app/domain/entities/user.entity.ts の例
export class User {
  constructor(
    private _id: UserId,
    private _name: string,
    private _email: Email,
    private _passwordHash: string,
    private _createdAt: Date
  ) {}

  public getId(): UserId {
    return this._id;
  }

  public changeEmail(newEmail: Email): void {
    // ビジネスルールをここに実装
    this._email = newEmail;
  }

  // ビジネスロジックをメソッドとして実装
  public validatePassword(plainPassword: string): boolean {
    return bcrypt.compareSync(plainPassword, this._passwordHash);
  }
}
```

#### Value Object（値オブジェクト）
不変で等価性によって比較されるオブジェクト

```typescript
// app/domain/value-objects/email.vo.ts の例
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    if (!this.isValid(email)) {
      throw new DomainError('Invalid email format');
    }
    return new Email(email);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

#### Repository（リポジトリ）
ドメインオブジェクトの永続化を抽象化

```typescript
// app/domain/repositories/user.repository.ts
export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
```

#### Domain Service（ドメインサービス）
複数のエンティティにまたがるビジネスロジック

```typescript
// app/domain/services/authentication.service.ts
export class AuthenticationService {
  validateCredentials(email: Email, password: string, user: User): boolean {
    return user.validatePassword(password);
  }

  isEmailAvailable(email: Email, userRepository: IUserRepository): Promise<boolean> {
    return userRepository.findByEmail(email).then(user => !user);
  }
}
```

## レイヤー構成

### 1. Domain Layer（app/domain/）

**責務**: ビジネスロジックとルールの中核
**依存**: なし（純粋なTypeScript）

```
app/domain/
├── entities/          # エンティティ（User, Game, Character等）
├── repositories/      # リポジトリインターフェース
├── services/         # ドメインサービス
└── value-objects/    # 値オブジェクト（Email, Password等）
```

**設計原則:**
- フレームワーク非依存
- 外部ライブラリへの依存を最小化
- ビジネスルールをコードで表現
- 不変性と副作用の制御

### 2. Application Layer（app/application/）

**責務**: ユースケースの実装とオーケストレーション
**依存**: Domain Layer

```
app/application/
├── commands/         # コマンドオブジェクト（入力）
├── results/         # リザルトオブジェクト（出力）
└── use-cases/       # ユースケース実装
```

**パターン例:**

```typescript
// app/application/use-cases/login.use-case.ts
export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private authService: AuthenticationService
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // 1. ドメインロジックの実行
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      return LoginResult.failure('User not found');
    }

    // 2. ビジネスルールの適用
    const isValid = this.authService.validateCredentials(
      command.email,
      command.password,
      user
    );
    if (!isValid) {
      return LoginResult.failure('Invalid credentials');
    }

    // 3. セッション作成
    const session = Session.create(user.getId());
    await this.sessionRepository.save(session);

    return LoginResult.success(session.getToken());
  }
}
```

### 3. Infrastructure Layer（app/infrastructure/）

**責務**: 外部システムとの統合
**依存**: Application Layer, Domain Layer

```
app/infrastructure/
├── config/                    # DIコンテナ設定
└── persistence/
    └── repositories/         # リポジトリ実装（Prisma）
```

**実装例:**

```typescript
// app/infrastructure/persistence/repositories/prisma-user.repository.ts
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { id: id.getValue() }
    });
    
    return userData ? this.toDomain(userData) : null;
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.getId().getValue() },
      create: this.toPersistence(user),
      update: this.toPersistence(user)
    });
  }

  private toDomain(data: any): User {
    return new User(
      new UserId(data.id),
      data.name,
      Email.create(data.email),
      data.passwordHash,
      data.createdAt
    );
  }

  private toPersistence(user: User): any {
    return {
      id: user.getId().getValue(),
      name: user.getName(),
      email: user.getEmail().getValue(),
      passwordHash: user.getPasswordHash(),
      createdAt: user.getCreatedAt()
    };
  }
}
```

### 4. Presentation Layer（app/web/routes/）

**責務**: React Router v7を使用したUI実装
**依存**: Application Layer（DIコンテナ経由）

```typescript
// app/web/routes/login.tsx
export default function LoginRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1>ログイン</h1>
      <Form method="post">
        <input name="email" type="email" required />
        <input name="password" type="password" required />
        <button type="submit">ログイン</button>
      </Form>
      {actionData?.error && <p>{actionData.error}</p>}
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const command = new LoginCommand(
    Email.create(formData.get('email') as string),
    formData.get('password') as string
  );

  // DIコンテナからユースケースを取得
  const loginUseCase = container.resolve(LoginUseCase);
  const result = await loginUseCase.execute(command);

  if (result.isSuccess()) {
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': createSessionCookie(result.getToken())
      }
    });
  }

  return json({ error: result.getError() });
}
```

## 依存性注入（DI）

### DIコンテナ設定

```typescript
// app/infrastructure/config/container.ts
import { container } from 'tsyringe';

// リポジトリの登録
container.register<IUserRepository>('IUserRepository', {
  useClass: PrismaUserRepository
});

container.register<ISessionRepository>('ISessionRepository', {
  useClass: PrismaSessionRepository
});

// ドメインサービスの登録
container.registerSingleton(AuthenticationService);

// ユースケースの登録
container.register(LoginUseCase);
container.register(LogoutUseCase);

export { container };
```

### 注入の例

```typescript
// app/application/use-cases/login.use-case.ts
@injectable()
export class LoginUseCase {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject('ISessionRepository') private sessionRepository: ISessionRepository,
    private authService: AuthenticationService
  ) {}
}
```

## エラーハンドリング戦略

### ドメインエラー

```typescript
// app/shared/errors/domain.error.ts
export class DomainError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// app/shared/errors/authentication.error.ts
export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
  }
}
```

### レイヤー間のエラー処理

- **Domain Layer**: DomainErrorをthrow
- **Application Layer**: ドメインエラーをキャッチしてResultオブジェクトに変換
- **Infrastructure Layer**: 外部システムエラーをDomainErrorに変換
- **Presentation Layer**: Resultオブジェクトの成功/失敗でUI制御

## テスト戦略

### 単体テストのレイヤー別方針

```typescript
// Domain Layer - 純粋関数のテスト
describe('User Entity', () => {
  test('should validate password correctly', () => {
    const user = new User(/* ... */);
    expect(user.validatePassword('correct')).toBe(true);
    expect(user.validatePassword('wrong')).toBe(false);
  });
});

// Application Layer - ユースケースのテスト
describe('LoginUseCase', () => {
  test('should return success when credentials are valid', async () => {
    const mockUserRepo = mock<IUserRepository>();
    const useCase = new LoginUseCase(mockUserRepo, /* ... */);
    
    const result = await useCase.execute(validCommand);
    expect(result.isSuccess()).toBe(true);
  });
});

// Infrastructure Layer - 統合テスト
describe('PrismaUserRepository', () => {
  test('should save and retrieve user correctly', async () => {
    const repository = new PrismaUserRepository(testPrisma);
    const user = new User(/* ... */);
    
    await repository.save(user);
    const retrieved = await repository.findById(user.getId());
    
    expect(retrieved).toEqual(user);
  });
});
```

## パフォーマンス考慮事項

### ドメインオブジェクトの最適化

- Value Objectのイミュータブル設計
- Entityの遅延ローディング
- Repository層でのクエリ最適化

### メモリ効率

- DIコンテナのスコープ管理（Singleton vs Transient）
- 大量データ処理時のStreamingパターン
- オブジェクトプールの活用（必要に応じて）

## 今後の拡張計画

### ゲーム機能の追加

1. **Game Entity**の実装
   - ゲームセッション管理
   - プレイヤー管理
   - スコア計算ロジック

2. **Character Entity**の実装
   - キャラクター特性
   - レベリングシステム
   - アイテム管理

3. **Achievement System**
   - 実績エンティティ
   - 進捗追跡
   - 報酬システム

### マイクロサービス化への準備

- ドメイン境界の明確化
- イベント駆動アーキテクチャの導入
- CQRS（Command Query Responsibility Segregation）パターンの適用

### 非同期処理とイベント

```typescript
// 将来のイベント駆動設計例
export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  occurredOn: Date;
  version: number;
}

export class UserRegisteredEvent implements DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly occurredOn: Date,
    public readonly version: number
  ) {}
}
```

## ベストプラクティス

### 1. ドメイン中心設計
- ビジネスロジックをドメイン層に集約
- データベーススキーマではなくドメインモデルを優先
- 技術的関心事とビジネス関心事の分離

### 2. 型安全性の確保
- Value Objectによる原始的強迫の回避
- 戻り値の型にnullを使わずOptionalパターン
- エラー状態の型による表現

### 3. テスタビリティ
- 依存性注入によるモック化容易性
- 純粋関数によるサイドエフェクトの制御
- 各レイヤーの独立したテスト可能性

### 4. 保守性と可読性
- 明示的な命名規則
- 単一責任原則の徹底
- インターフェースによる実装の隠蔽

## まとめ

本アーキテクチャはDDDとClean Architectureの原則に基づき、ビジネスロジックの中央集権化、技術的関心事の分離、高いテスタビリティを実現しています。ゲームアプリケーションとして必要な拡張性と保守性を確保しながら、現実的な実装パスを提供します。

継続的な改善と実装を通じて、このアーキテクチャをゲームドメインの要求に合わせて進化させていきます。