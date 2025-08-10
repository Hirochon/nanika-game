# テスト戦略・TDD設計

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトのテスト戦略とTDD（Test-Driven Development）設計について詳述します。DDDアーキテクチャの各レイヤーに適した包括的なテストアプローチと、継続的品質改善を実現するテストプロセスを定義し、高品質で保守しやすいゲームアプリケーションの開発を支援します。

## 現在の実装状況

- **Vitest**: 高速なテスト実行環境の構築完了
- **ドメインテスト**: User Entity、Email Value Object、認証サービスの単体テスト実装済み
- **ユースケーステスト**: ログイン・ログアウト機能のテスト実装済み
- **フロントエンドテスト**: ダッシュボード、ログイン画面の基本テスト実装済み
- **モックインフラ**: 認証機能のモック実装済み
- **バリデーションテスト**: フォーム入力検証のテスト実装済み

## TDD基本原則

### Red-Green-Refactorサイクル

```mermaid
graph LR
    A[🔴 Red<br/>失敗するテスト作成] --> B[🟢 Green<br/>テストを通すための<br/>最小限の実装]
    B --> C[🔵 Refactor<br/>コードの改善<br/>テストは保持]
    C --> A
    
    style A fill:#ffcccc
    style B fill:#ccffcc
    style C fill:#ccccff
```

**Red フェーズ:**
- 新機能・要求に対する失敗するテストを作成
- テストが確実に失敗することを確認
- テスト自体の品質を確保

**Green フェーズ:**
- テストを通すための最小限の実装
- 美しいコードよりも動くコードを優先
- すべてのテストが通ることを確認

**Refactor フェーズ:**
- コードの構造・設計を改善
- テストが引き続き通ることを確認
- 重複除去、可読性向上、パフォーマンス改善

## テストレベル戦略

### 1. 単体テスト（Unit Tests）

**対象**: 個別のクラス・関数・コンポーネント  
**実行速度**: 高速（< 100ms/test）  
**カバレッジ目標**: 90%以上  
**依存関係**: モック・スタブで隔離  

#### ドメイン層のテスト

```typescript
// app/domain/entities/user.entity.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { User } from './user.entity';
import { UserId } from '../value-objects/user-id.vo';
import { Email } from '../value-objects/email.vo';

describe('User Entity', () => {
  let validUserData: any;

  beforeEach(() => {
    validUserData = {
      id: UserId.create(1),
      name: 'Test User',
      email: Email.create('test@example.com'),
      passwordHash: 'hashed-password',
      createdAt: new Date('2024-01-01')
    };
  });

  describe('作成', () => {
    it('有効なデータでユーザーを作成できる', () => {
      const user = new User(
        validUserData.id,
        validUserData.name,
        validUserData.email,
        validUserData.passwordHash,
        validUserData.createdAt
      );

      expect(user.getId()).toEqual(validUserData.id);
      expect(user.getName()).toBe(validUserData.name);
      expect(user.getEmail()).toEqual(validUserData.email);
      expect(user.getCreatedAt()).toEqual(validUserData.createdAt);
    });

    it('空の名前でユーザー作成時にエラーをthrowする', () => {
      expect(() => {
        new User(
          validUserData.id,
          '', // 空文字
          validUserData.email,
          validUserData.passwordHash,
          validUserData.createdAt
        );
      }).toThrow('User name cannot be empty');
    });
  });

  describe('パスワード検証', () => {
    it('正しいパスワードでtrueを返す', () => {
      const user = new User(
        validUserData.id,
        validUserData.name,
        validUserData.email,
        // bcryptでハッシュ化された'password123'
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        validUserData.createdAt
      );

      const isValid = user.validatePassword('password123');
      expect(isValid).toBe(true);
    });

    it('間違ったパスワードでfalseを返す', () => {
      const user = new User(
        validUserData.id,
        validUserData.name,
        validUserData.email,
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        validUserData.createdAt
      );

      const isValid = user.validatePassword('wrongpassword');
      expect(isValid).toBe(false);
    });
  });

  describe('プロフィール更新', () => {
    it('メールアドレスを変更できる', () => {
      const user = new User(
        validUserData.id,
        validUserData.name,
        validUserData.email,
        validUserData.passwordHash,
        validUserData.createdAt
      );

      const newEmail = Email.create('newemail@example.com');
      user.changeEmail(newEmail);

      expect(user.getEmail()).toEqual(newEmail);
    });

    it('無効なメールアドレスでの変更はエラーをthrowする', () => {
      const user = new User(
        validUserData.id,
        validUserData.name,
        validUserData.email,
        validUserData.passwordHash,
        validUserData.createdAt
      );

      expect(() => {
        user.changeEmail(Email.create('invalid-email'));
      }).toThrow('Invalid email format');
    });
  });
});
```

#### 値オブジェクトのテスト

```typescript
// app/domain/value-objects/email.vo.test.ts
import { describe, it, expect } from 'vitest';
import { Email } from './email.vo';
import { DomainError } from '~/shared/errors/domain.error';

describe('Email Value Object', () => {
  describe('作成', () => {
    it.each([
      'test@example.com',
      'user.name@domain.co.jp',
      'admin+test@site.org',
      'info@sub.domain.com'
    ])('有効なメールアドレス "%s" で作成成功', (validEmail) => {
      const email = Email.create(validEmail);
      expect(email.getValue()).toBe(validEmail);
    });

    it.each([
      '',
      'invalid-email',
      '@example.com',
      'test@',
      'test@.com',
      'test..test@example.com',
      'test@example..com'
    ])('無効なメールアドレス "%s" で作成時にエラー', (invalidEmail) => {
      expect(() => {
        Email.create(invalidEmail);
      }).toThrow(DomainError);
    });
  });

  describe('等価性', () => {
    it('同じメールアドレスのインスタンスは等価', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('異なるメールアドレスのインスタンスは非等価', () => {
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');

      expect(email1.equals(email2)).toBe(false);
    });
  });

  describe('ドメイン情報', () => {
    it('ドメイン部分を正しく抽出', () => {
      const email = Email.create('user@example.com');
      expect(email.getDomain()).toBe('example.com');
    });

    it('ローカル部分を正しく抽出', () => {
      const email = Email.create('user@example.com');
      expect(email.getLocalPart()).toBe('user');
    });
  });
});
```

### 2. 統合テスト（Integration Tests）

**対象**: レイヤー間の協調動作  
**実行速度**: 中速（< 1s/test）  
**カバレッジ目標**: 80%以上  
**依存関係**: 実際のDB・外部サービス  

#### ユースケースと永続化層の統合テスト

```typescript
// app/application/use-cases/login.use-case.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { LoginUseCase } from './login.use-case';
import { LoginCommand } from '../commands/login.command';
import { IUserRepository } from '~/domain/repositories/user.repository';
import { ISessionRepository } from '~/domain/repositories/session.repository';
import { testDatabase } from '~/tests/helpers/test-database';
import { createTestUser } from '~/tests/factories/user.factory';
import { Email } from '~/domain/value-objects/email.vo';

describe('LoginUseCase 統合テスト', () => {
  let useCase: LoginUseCase;
  let userRepository: IUserRepository;
  let sessionRepository: ISessionRepository;

  beforeEach(async () => {
    // テスト用データベースの初期化
    await testDatabase.reset();
    
    // DIコンテナから依存関係を取得
    useCase = container.resolve(LoginUseCase);
    userRepository = container.resolve<IUserRepository>('IUserRepository');
    sessionRepository = container.resolve<ISessionRepository>('ISessionRepository');
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  describe('正常系', () => {
    it('有効な認証情報でログイン成功', async () => {
      // Arrange
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });
      await userRepository.save(testUser);

      const command = new LoginCommand(
        Email.create('test@example.com'),
        'password123',
        false,
        new Date(),
        'test-request-id'
      );

      // Act
      const result = await useCase.execute(command);

      // Assert
      expect(result.isSuccess()).toBe(true);
      
      if (result.isSuccess()) {
        const loginResult = result.getValue();
        expect(loginResult.user.id).toEqual(testUser.getId());
        expect(loginResult.sessionToken).toBeDefined();
        
        // セッションが永続化されていることを確認
        const session = await sessionRepository.findByToken(loginResult.sessionToken);
        expect(session).not.toBeNull();
        expect(session!.getUserId()).toEqual(testUser.getId());
      }
    });
  });

  describe('異常系', () => {
    it('存在しないユーザーでログイン失敗', async () => {
      // Arrange
      const command = new LoginCommand(
        Email.create('nonexistent@example.com'),
        'password123',
        false,
        new Date(),
        'test-request-id'
      );

      // Act
      const result = await useCase.execute(command);

      // Assert
      expect(result.isFailure()).toBe(true);
      
      if (result.isFailure()) {
        const error = result.getError();
        expect(error.code).toBe('INVALID_CREDENTIALS');
        expect(error.getDisplayMessage()).toContain('メールアドレスまたはパスワードが正しくありません');
      }
    });

    it('間違ったパスワードでログイン失敗', async () => {
      // Arrange
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });
      await userRepository.save(testUser);

      const command = new LoginCommand(
        Email.create('test@example.com'),
        'wrongpassword',
        false,
        new Date(),
        'test-request-id'
      );

      // Act
      const result = await useCase.execute(command);

      // Assert
      expect(result.isFailure()).toBe(true);
      
      if (result.isFailure()) {
        const error = result.getError();
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('境界値・特殊ケース', () => {
    it('最大長のパスワードでログイン成功', async () => {
      const longPassword = 'a'.repeat(128); // 最大長パスワード
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: longPassword
      });
      await userRepository.save(testUser);

      const command = new LoginCommand(
        Email.create('test@example.com'),
        longPassword,
        false,
        new Date(),
        'test-request-id'
      );

      const result = await useCase.execute(command);
      expect(result.isSuccess()).toBe(true);
    });
  });
});
```

### 3. フロントエンドテスト

#### React Routerコンポーネントテスト

```typescript
// app/web/routes/login.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import Login, { action } from './login';

// モック設定
vi.mock('~/infrastructure/config/container', () => ({
  container: {
    resolve: vi.fn()
  }
}));

describe('Login Route', () => {
  function createTestRouter(initialEntries = ['/login']) {
    return createMemoryRouter([
      {
        path: '/login',
        Component: Login,
        action: action,
      },
      {
        path: '/dashboard',
        element: <div>Dashboard Page</div>,
      }
    ], {
      initialEntries
    });
  }

  describe('UI描画', () => {
    it('ログインフォームが正しく描画される', () => {
      const router = createTestRouter();
      render(<RouterProvider router={router} />);

      expect(screen.getByRole('heading', { name: /ログイン/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/メールアドレス/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/パスワード/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /アカウントを作成/i })).toBeInTheDocument();
    });

    it('初期状態ではエラーメッセージが表示されない', () => {
      const router = createTestRouter();
      render(<RouterProvider router={router} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('フォーム操作', () => {
    it('入力フィールドに値を入力できる', async () => {
      const router = createTestRouter();
      render(<RouterProvider router={router} />);

      const emailInput = screen.getByLabelText(/メールアドレス/i);
      const passwordInput = screen.getByLabelText(/パスワード/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('未入力でフォーム送信時にHTML5バリデーションが動作', async () => {
      const router = createTestRouter();
      render(<RouterProvider router={router} />);

      const submitButton = screen.getByRole('button', { name: /ログイン/i });
      fireEvent.click(submitButton);

      const emailInput = screen.getByLabelText(/メールアドレス/i);
      expect(emailInput).toBeInvalid();
    });
  });

  describe('フォーム送信', () => {
    it('有効な入力でフォーム送信できる', async () => {
      // モックの設定
      const mockLoginUseCase = {
        execute: vi.fn().mockResolvedValue({
          isSuccess: () => true,
          getValue: () => ({
            user: { id: 1, name: 'Test User', email: 'test@example.com' },
            sessionToken: 'mock-session-token'
          })
        })
      };

      vi.mocked(container.resolve).mockReturnValue(mockLoginUseCase);

      const router = createTestRouter();
      render(<RouterProvider router={router} />);

      // フォーム入力
      const emailInput = screen.getByLabelText(/メールアドレス/i);
      const passwordInput = screen.getByLabelText(/パスワード/i);
      const submitButton = screen.getByRole('button', { name: /ログイン/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // ダッシュボードにリダイレクトされることを確認
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });
  });
});
```

### 4. E2Eテスト（将来実装）

**対象**: ユーザーシナリオ全体  
**実行速度**: 低速（> 5s/test）  
**カバレッジ目標**: 主要フロー100%  
**依存関係**: 本番同等環境  

```typescript
// tests/e2e/user-authentication.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('ユーザー認証フロー', () => {
  test('新規ユーザー登録からログインまでの完全フロー', async ({ page }) => {
    // ホームページ訪問
    await page.goto('/');
    await expect(page).toHaveTitle(/Nanika Game/);

    // 新規登録ページに移動
    await page.click('text=今すぐ始める');
    await expect(page).toHaveURL(/\/register/);

    // 新規登録フォーム入力
    await page.fill('[name="name"]', 'E2E Test User');
    await page.fill('[name="email"]', 'e2e@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.fill('[name="confirmPassword"]', 'password123');
    await page.check('[name="acceptTerms"]');

    // 登録実行
    await page.click('button[type="submit"]');
    
    // ダッシュボードにリダイレクト確認
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=こんにちは、E2E Test Userさん')).toBeVisible();

    // ログアウト
    await page.click('text=ログアウト');
    await expect(page).toHaveURL('/');

    // ログイン
    await page.click('text=ログイン');
    await page.fill('[name="email"]', 'e2e@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // ログイン成功確認
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=こんにちは、E2E Test Userさん')).toBeVisible();
  });
});
```

## テストファクトリー・ヘルパー

### 1. ファクトリーパターン

```typescript
// tests/factories/user.factory.ts
import { User } from '~/domain/entities/user.entity';
import { UserId } from '~/domain/value-objects/user-id.vo';
import { Email } from '~/domain/value-objects/email.vo';
import bcrypt from 'bcrypt';

export interface CreateTestUserOptions {
  id?: number;
  name?: string;
  email?: string;
  password?: string;
  createdAt?: Date;
}

export async function createTestUser(options: CreateTestUserOptions = {}): Promise<User> {
  const {
    id = Math.floor(Math.random() * 10000),
    name = `Test User ${id}`,
    email = `test${id}@example.com`,
    password = 'password123',
    createdAt = new Date()
  } = options;

  const passwordHash = await bcrypt.hash(password, 10);

  return new User(
    UserId.create(id),
    name,
    Email.create(email),
    passwordHash,
    createdAt
  );
}

// tests/factories/game.factory.ts
export interface CreateTestGameOptions {
  id?: string;
  name?: string;
  maxPlayers?: number;
  createdBy?: UserId;
  status?: GameStatus;
}

export function createTestGame(options: CreateTestGameOptions = {}): GameEntity {
  const {
    id = crypto.randomUUID(),
    name = `Test Game ${Math.random()}`,
    maxPlayers = 4,
    createdBy = UserId.create(1),
    status = GameStatus.WAITING
  } = options;

  return new GameEntity(
    GameId.create(id),
    name,
    status,
    maxPlayers,
    {
      gameMode: 'classic',
      difficulty: 'normal',
      allowSpectators: true,
      isPrivate: false
    },
    createdBy,
    new Date()
  );
}
```

### 2. テストヘルパー

```typescript
// tests/helpers/test-database.ts
import { PrismaClient } from '@prisma/client';

class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });
  }

  async reset(): Promise<void> {
    // トランザクション内でテーブルをクリア
    await this.prisma.$transaction([
      this.prisma.session.deleteMany(),
      this.prisma.user.deleteMany(),
      // 他のテーブルも順次追加
    ]);
  }

  async cleanup(): Promise<void> {
    await this.reset();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // 特定のテーブルのレコード数確認
  async count(table: string): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM ${table}
    `;
    return Number(result[0].count);
  }
}

export const testDatabase = new TestDatabase();

// グローバルセットアップ・クリーンアップ
export async function setupTestDatabase(): Promise<void> {
  await testDatabase.reset();
}

export async function teardownTestDatabase(): Promise<void> {
  await testDatabase.disconnect();
}
```

### 3. モックヘルパー

```typescript
// tests/helpers/mock-helpers.ts
import { vi } from 'vitest';

export class MockRepository<T, TId> {
  private data: Map<TId, T> = new Map();
  private callCounts: Map<string, number> = new Map();

  findById = vi.fn(async (id: TId): Promise<T | null> => {
    this.incrementCallCount('findById');
    return this.data.get(id) || null;
  });

  save = vi.fn(async (entity: T): Promise<void> => {
    this.incrementCallCount('save');
    // エンティティのIDを取得して保存（実装は型に依存）
    const id = (entity as any).getId();
    this.data.set(id, entity);
  });

  delete = vi.fn(async (id: TId): Promise<void> => {
    this.incrementCallCount('delete');
    this.data.delete(id);
  });

  // テスト用ヘルパーメソッド
  __setData(entities: T[]): void {
    this.data.clear();
    entities.forEach(entity => {
      const id = (entity as any).getId();
      this.data.set(id, entity);
    });
  }

  __clearData(): void {
    this.data.clear();
  }

  __getCallCount(method: string): number {
    return this.callCounts.get(method) || 0;
  }

  private incrementCallCount(method: string): void {
    const current = this.callCounts.get(method) || 0;
    this.callCounts.set(method, current + 1);
  }
}

// 使用例
export function createMockUserRepository(): MockRepository<UserEntity, UserId> {
  return new MockRepository<UserEntity, UserId>();
}
```

## テスト設定・環境

### 1. Vitest設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 実行環境
    environment: 'jsdom', // React コンポーネント用
    
    // セットアップファイル
    setupFiles: [
      './tests/setup.ts'
    ],
    
    // グローバル設定
    globals: true,
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'app/**/*.ts',
        'app/**/*.tsx'
      ],
      exclude: [
        'app/**/*.test.ts',
        'app/**/*.test.tsx',
        'app/**/*.d.ts',
        'tests/**/*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'app/domain/**/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // 並列実行設定
    threads: true,
    maxThreads: 4,
    
    // タイムアウト
    testTimeout: 5000,
    hookTimeout: 10000,
    
    // レポーター
    reporter: ['verbose', 'html', 'junit'],
    outputFile: {
      html: './coverage/test-results.html',
      junit: './coverage/junit.xml'
    },
    
    // ファイル監視（開発時）
    watch: true,
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**'
    ]
  },
  
  // パスエイリアス
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './'),
      'tests': resolve(__dirname, './tests')
    }
  }
});
```

### 2. テストセットアップ

```typescript
// tests/setup.ts
import { beforeAll, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-database';
import '@testing-library/jest-dom'; // DOM assertions

// グローバルセットアップ
beforeAll(async () => {
  // データベース初期化
  await setupTestDatabase();
  
  // 日時のモック（一貫性のあるテスト結果のため）
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  
  // 環境変数設定
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-key';
});

// グローバルクリーンアップ
afterAll(async () => {
  await teardownTestDatabase();
  vi.useRealTimers();
});

// コンソール出力の制御（テスト実行中のログを削減）
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // テスト中の期待されるエラーは出力しない
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalConsoleError(...args);
  };
  
  console.warn = vi.fn(); // 警告をミュート
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
```

## テスト実行・CI統合

### 1. npm scripts

```json
{
  "scripts": {
    // 基本テスト実行
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    
    // レイヤー別テスト
    "test:unit": "vitest run app/**/*.test.ts",
    "test:integration": "vitest run tests/integration/**/*.test.ts",
    "test:e2e": "playwright test",
    
    // 継続的実行
    "test:watch": "vitest",
    "test:watch:coverage": "vitest --coverage",
    
    // CI用
    "test:ci": "vitest run --reporter=junit --coverage",
    "test:ci:e2e": "playwright test --reporter=junit",
    
    // 特定テスト実行
    "test:domain": "vitest run app/domain/**/*.test.ts",
    "test:application": "vitest run app/application/**/*.test.ts",
    "test:web": "vitest run app/web/**/*.test.tsx"
  }
}
```

### 2. GitHub Actions統合（将来実装）

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Build application
        run: npm run build
      
      - name: Start services
        run: |
          docker compose up -d
          npm run db:setup
      
      - name: Run E2E tests
        run: npm run test:ci:e2e
      
      - name: Upload E2E test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-report
          path: playwright-report/
```

## テスト品質管理

### 1. メトリクス・品質基準

**カバレッジ目標:**
- ドメイン層: 95%以上（ビジネスロジックの完全カバー）
- アプリケーション層: 90%以上（ユースケースの完全カバー）
- インフラ層: 80%以上（技術的詳細に重点）
- プレゼンテーション層: 80%以上（ユーザーインタラクション重点）

**パフォーマンス目標:**
- 単体テスト平均実行時間: < 50ms
- 統合テスト平均実行時間: < 500ms
- 全テストスイート実行時間: < 2分

**品質指標:**
- テストの重複排除
- アサーション数（1テストあたり平均3-5個）
- テスト可読性スコア
- Mutation Testing Score（将来導入）

### 2. テストレビュー基準

**必須チェック項目:**
- [ ] AAA（Arrange-Act-Assert）パターンに従っている
- [ ] テスト名が仕様を正確に表現している
- [ ] 正常系・異常系・境界値テストが存在する
- [ ] 外部依存がモック・スタブで適切に隔離されている
- [ ] テストデータがランダム性を排除して決定論的である
- [ ] セットアップ・クリーンアップが適切に実装されている

**推奨改善項目:**
- [ ] テストの実行時間が適切（単体 < 100ms）
- [ ] データ駆動テスト（it.each）の活用
- [ ] テストファクトリーの活用でコード重複排除
- [ ] エラーメッセージが分かりやすい

## 今後の拡張計画

### Phase 1: テストインフラ強化（3ヶ月）
1. **Mutation Testing**: テスト品質の客観的評価
2. **Visual Regression Testing**: UI変更の自動検出  
3. **Performance Testing**: 負荷・ストレステスト統合
4. **Property-based Testing**: ランダム入力による堅牢性テスト

### Phase 2: 高度なテスト技法（6ヶ月）
1. **Contract Testing**: API間の整合性保証
2. **Chaos Engineering**: 障害注入によるレジリエンステスト
3. **Security Testing**: 自動化されたセキュリティテスト
4. **Accessibility Testing**: 自動アクセシビリティ検証

### Phase 3: AI支援テスト（12ヶ月）
1. **テスト自動生成**: AIによるテストケース提案
2. **テストメンテナンス**: コード変更に伴うテスト更新提案
3. **Bug Prediction**: コード分析による潜在的バグ予測
4. **テストオラクル**: 期待値の自動推論

## まとめ

本テスト戦略は、TDDの原則に基づき、DDDアーキテクチャの各レイヤーに最適化された包括的なテストアプローチを提供します。単体テストから統合テスト、E2Eテストまでの完全なテストピラミッドにより、高品質で保守しやすいゲームアプリケーションの開発を支援します。

継続的なテスト品質の改善とメトリクス監視により、開発速度と品質のバランスを取りながら、信頼性の高いソフトウェアを提供していきます。