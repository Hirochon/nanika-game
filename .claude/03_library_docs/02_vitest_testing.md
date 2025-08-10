# Vitest テストパターン集

## 概要
このドキュメントは、Nanika GameプロジェクトにおけるVitestを使用したテストパターンとベストプラクティスを定義します。TDD（テスト駆動開発）の原則に従い、テストファーストアプローチを推奨します。

## 目次
1. [基本セットアップ](#基本セットアップ)
2. [テストファイル構造](#テストファイル構造)
3. [モックパターン](#モックパターン)
4. [単体テスト](#単体テスト)
5. [統合テスト](#統合テスト)
6. [非同期テスト](#非同期テスト)
7. [テストカバレッジ](#テストカバレッジ)
8. [ベストプラクティス](#ベストプラクティス)

## 基本セットアップ

### vite.config.ts設定
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./app/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'app/test/',
        '*.config.ts',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    include: ['app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.react-router'],
  },
});
```

### テストセットアップファイル
```typescript
// app/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 各テスト後にDOMをクリーンアップ
afterEach(() => {
  cleanup();
});

// グローバルモックの設定
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});
```

## テストファイル構造

### ファイル命名規則
- 単体テスト: `*.test.ts` または `*.spec.ts`
- 統合テスト: `*.integration.test.ts`
- E2Eテスト: `*.e2e.test.ts`

### テストの基本構造
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('テスト対象の名前', () => {
  // セットアップ
  beforeEach(() => {
    // テスト前の初期化
  });

  afterEach(() => {
    // テスト後のクリーンアップ
  });

  describe('機能グループ', () => {
    it('正常系: 期待される動作の説明', () => {
      // Arrange（準備）
      const input = 'test';
      
      // Act（実行）
      const result = functionUnderTest(input);
      
      // Assert（検証）
      expect(result).toBe('expected');
    });

    it('異常系: エラーケースの説明', () => {
      // エラーケースのテスト
      expect(() => functionUnderTest(null)).toThrow('Error message');
    });
  });
});
```

## モックパターン

### 基本的なモック
```typescript
import { vi } from 'vitest';

// 関数のモック
const mockFunction = vi.fn();
mockFunction.mockReturnValue('mocked value');
mockFunction.mockResolvedValue('async mocked value');

// モジュールのモック
vi.mock('./module', () => ({
  default: vi.fn(),
  namedExport: vi.fn(),
}));
```

### リポジトリのモック実装
```typescript
import type { IUserRepository } from '@domain/repositories/user.repository';
import { User } from '@domain/entities/user.entity';

class MockUserRepository implements IUserRepository {
  private users: User[] = [];

  async findById(id: UserId): Promise<User | null> {
    return this.users.find((user) => user.id.equals(id)) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return this.users.find((user) => user.email.equals(email)) || null;
  }

  async save(user: User): Promise<void> {
    const existingIndex = this.users.findIndex((u) => u.id.equals(user.id));
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
  }

  async delete(id: UserId): Promise<void> {
    this.users = this.users.filter((user) => !user.id.equals(id));
  }

  // テスト用メソッド
  clear(): void {
    this.users = [];
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}
```

### 外部APIのモック
```typescript
import { vi } from 'vitest';

// fetch APIのモック
global.fetch = vi.fn();

beforeEach(() => {
  (global.fetch as any).mockReset();
});

it('外部APIを呼び出すテスト', async () => {
  const mockResponse = { data: 'test' };
  
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse,
  });

  const result = await fetchData();
  
  expect(global.fetch).toHaveBeenCalledWith(
    'https://api.example.com/data',
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    })
  );
  
  expect(result).toEqual(mockResponse);
});
```

## 単体テスト

### ドメインエンティティのテスト
```typescript
import { describe, it, expect } from 'vitest';
import { User } from '@domain/entities/user.entity';
import { Email } from '@domain/value-objects/email.vo';
import { Password } from '@domain/value-objects/password.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

describe('User Entity', () => {
  it('should create a user with valid data', () => {
    const userId = UserId.generate();
    const email = Email.create('test@example.com');
    const password = Password.create('ValidPass123!');
    
    const user = new User(userId, 'Test User', email, password);
    
    expect(user.id).toBe(userId);
    expect(user.name).toBe('Test User');
    expect(user.email).toBe(email);
    expect(user.isActive).toBe(true);
  });

  it('should throw error with invalid email', () => {
    expect(() => Email.create('invalid-email')).toThrow('Invalid email format');
  });

  it('should verify password correctly', async () => {
    const password = await Password.hash('TestPassword123!');
    const user = new User(
      UserId.generate(),
      'Test User',
      Email.create('test@example.com'),
      password
    );
    
    const isValid = await user.verifyPassword('TestPassword123!');
    expect(isValid).toBe(true);
    
    const isInvalid = await user.verifyPassword('WrongPassword');
    expect(isInvalid).toBe(false);
  });
});
```

### バリデーション関数のテスト
```typescript
import { describe, it, expect } from 'vitest';
import { validateLoginForm } from '~/web/utils/validation';

describe('Login Form Validation', () => {
  it('should validate correct login data', () => {
    const validData = {
      email: 'admin@example.com',
      password: 'Admin123',
    };

    const result = validateLoginForm(validData);

    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'Admin123',
    };

    const result = validateLoginForm(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Invalid email format');
  });

  it('should reject weak passwords', () => {
    const invalidData = {
      email: 'admin@example.com',
      password: 'weak',
    };

    const result = validateLoginForm(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('Password must be at least 8 characters');
  });
});
```

### カスタムフックのテスト
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter Hook', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    
    expect(result.current.count).toBe(0);
  });

  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10));
    
    expect(result.current.count).toBe(10);
  });
});
```

## 統合テスト

### サービス層のテスト
```typescript
import { beforeEach, describe, it, expect } from 'vitest';
import { AuthenticationService } from '@domain/services/authentication.service';
import { MockUserRepository } from './mocks/MockUserRepository';
import { Email } from '@domain/value-objects/email.vo';
import { Password } from '@domain/value-objects/password.vo';

describe('AuthenticationService Integration', () => {
  let authService: AuthenticationService;
  let mockUserRepository: MockUserRepository;

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    authService = new AuthenticationService(mockUserRepository);
  });

  it('should register a new user', async () => {
    const email = 'newuser@example.com';
    const password = 'SecurePass123!';
    const name = 'New User';

    const user = await authService.register(email, password, name);

    expect(user).toBeDefined();
    expect(user.email.value).toBe(email);
    expect(user.name).toBe(name);

    // リポジトリに保存されたことを確認
    const savedUser = await mockUserRepository.findByEmail(Email.create(email));
    expect(savedUser).toBeDefined();
    expect(savedUser?.id).toEqual(user.id);
  });

  it('should authenticate valid credentials', async () => {
    // 事前にユーザーを登録
    await authService.register('user@example.com', 'ValidPass123!', 'Test User');

    // 認証テスト
    const result = await authService.authenticate('user@example.com', 'ValidPass123!');
    
    expect(result).toBeDefined();
    expect(result.email.value).toBe('user@example.com');
  });

  it('should reject invalid credentials', async () => {
    await authService.register('user@example.com', 'ValidPass123!', 'Test User');

    await expect(
      authService.authenticate('user@example.com', 'WrongPassword')
    ).rejects.toThrow('Authentication failed');
  });

  it('should prevent duplicate registration', async () => {
    await authService.register('user@example.com', 'Pass123!', 'User 1');

    await expect(
      authService.register('user@example.com', 'Pass456!', 'User 2')
    ).rejects.toThrow('User already exists');
  });
});
```

### React Routerアクションのテスト
```typescript
import { describe, it, expect, vi } from 'vitest';
import { action } from './login';
import { container } from '@api/infrastructure/config/container';

vi.mock('@api/infrastructure/config/container', () => ({
  container: {
    resolve: vi.fn(),
  },
  TOKENS: {
    LoginUseCase: Symbol('LoginUseCase'),
  },
}));

describe('Login Action', () => {
  it('should handle successful login', async () => {
    const mockLoginUseCase = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com' },
        session: { token: 'session-token' },
      }),
    };

    (container.resolve as any).mockReturnValue(mockLoginUseCase);

    const formData = new FormData();
    formData.set('email', 'test@example.com');
    formData.set('password', 'ValidPass123');

    const request = new Request('http://localhost/login', {
      method: 'POST',
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} });

    expect(response.status).toBe(302); // Redirect
    expect(response.headers.get('Location')).toBe('/dashboard');
    expect(response.headers.get('Set-Cookie')).toContain('nanika_game_user=');
  });

  it('should handle login failure', async () => {
    const mockLoginUseCase = {
      execute: vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      }),
    };

    (container.resolve as any).mockReturnValue(mockLoginUseCase);

    const formData = new FormData();
    formData.set('email', 'test@example.com');
    formData.set('password', 'WrongPass');

    const request = new Request('http://localhost/login', {
      method: 'POST',
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('ログインに失敗しました');
  });
});
```

## 非同期テスト

### Promiseのテスト
```typescript
import { describe, it, expect } from 'vitest';

describe('Async Operations', () => {
  it('should handle async operations with async/await', async () => {
    const fetchData = async () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve('data'), 100);
      });
    };

    const result = await fetchData();
    expect(result).toBe('data');
  });

  it('should handle promise rejection', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    await expect(failingOperation()).rejects.toThrow('Operation failed');
  });
});
```

### タイマーのテスト
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Timer Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call function after delay', () => {
    const callback = vi.fn();
    
    setTimeout(callback, 1000);
    
    expect(callback).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(1000);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle interval functions', () => {
    const callback = vi.fn();
    
    setInterval(callback, 500);
    
    vi.advanceTimersByTime(1500);
    
    expect(callback).toHaveBeenCalledTimes(3);
  });
});
```

## テストカバレッジ

### カバレッジ設定
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### カバレッジ目標
- ドメイン層: 90%以上
- アプリケーション層: 80%以上
- インフラストラクチャ層: 70%以上
- コントローラー層: 60%以上
- UIコンポーネント: 70%以上

### カバレッジレポートの確認
```bash
# カバレッジを測定して実行
npm run test:coverage

# HTMLレポートを開く
open coverage/index.html
```

## ベストプラクティス

### 1. テストの独立性
```typescript
// 良い例: 各テストが独立している
describe('UserService', () => {
  let service: UserService;
  
  beforeEach(() => {
    service = new UserService();
  });
  
  it('test1', () => {
    // このテストは他のテストに依存しない
  });
  
  it('test2', () => {
    // このテストも他のテストに依存しない
  });
});

// 悪い例: テスト間に依存関係がある
let counter = 0;

it('test1', () => {
  counter++;
  expect(counter).toBe(1);
});

it('test2', () => {
  // test1に依存している
  expect(counter).toBe(1);
});
```

### 2. 明確なテスト名
```typescript
// 良い例: 何をテストしているか明確
it('should return user data when valid ID is provided', () => {});
it('should throw NotFoundError when user does not exist', () => {});

// 悪い例: 曖昧なテスト名
it('works', () => {});
it('test user', () => {});
```

### 3. AAA (Arrange-Act-Assert) パターン
```typescript
it('should calculate total price with tax', () => {
  // Arrange（準備）
  const items = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 },
  ];
  const taxRate = 0.1;
  
  // Act（実行）
  const total = calculateTotal(items, taxRate);
  
  // Assert（検証）
  expect(total).toBe(275); // (200 + 50) * 1.1
});
```

### 4. エラーケースのテスト
```typescript
describe('Error Cases', () => {
  it('should handle null input', () => {
    expect(() => process(null)).toThrow('Input cannot be null');
  });
  
  it('should handle empty array', () => {
    const result = process([]);
    expect(result).toEqual([]);
  });
  
  it('should handle network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(fetchData(mockFetch)).rejects.toThrow('Network error');
  });
});
```

### 5. テストデータビルダー
```typescript
// テストデータビルダークラス
class UserBuilder {
  private data = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    age: 25,
  };
  
  withId(id: string): this {
    this.data.id = id;
    return this;
  }
  
  withName(name: string): this {
    this.data.name = name;
    return this;
  }
  
  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }
  
  build(): User {
    return new User(this.data);
  }
}

// 使用例
it('should process user data', () => {
  const user = new UserBuilder()
    .withName('John Doe')
    .withEmail('john@example.com')
    .build();
  
  const result = processUser(user);
  expect(result).toBeDefined();
});
```

### 6. スナップショットテスト
```typescript
import { expect, it } from 'vitest';

it('should match snapshot', () => {
  const component = {
    type: 'button',
    props: {
      className: 'btn btn-primary',
      children: 'Click me',
    },
  };
  
  expect(component).toMatchSnapshot();
});

// 更新が必要な場合: vitest -u
```

### 7. パラメータ化テスト
```typescript
import { describe, it, expect } from 'vitest';

describe('Parameterized Tests', () => {
  const testCases = [
    { input: 1, expected: 2 },
    { input: 2, expected: 4 },
    { input: 3, expected: 6 },
    { input: 4, expected: 8 },
  ];
  
  testCases.forEach(({ input, expected }) => {
    it(`should double ${input} to ${expected}`, () => {
      expect(double(input)).toBe(expected);
    });
  });
});

// または it.each を使用
it.each([
  ['admin@example.com', true],
  ['user@test.com', true],
  ['invalid-email', false],
  ['@example.com', false],
])('should validate email %s as %s', (email, expected) => {
  expect(isValidEmail(email)).toBe(expected);
});
```

## デバッグとトラブルシューティング

### デバッグモード
```bash
# Node.jsデバッガーを使用
node --inspect-brk ./node_modules/.bin/vitest

# VS Codeデバッグ設定
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### よくある問題と解決策

#### 1. モジュール解決エラー
```typescript
// vitest.config.tsでエイリアスを設定
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@domain': path.resolve(__dirname, './app/domain'),
    '@api': path.resolve(__dirname, './app/api'),
  },
}
```

#### 2. 環境変数のモック
```typescript
import { vi } from 'vitest';

// 環境変数をモック
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test');

// テスト後にリセット
afterEach(() => {
  vi.unstubAllEnvs();
});
```

#### 3. グローバル変数のモック
```typescript
// setup.tsでグローバル設定
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
```

## まとめ

Vitestを使用する際の重要なポイント：

1. **TDD実践**: テストを先に書いてから実装
2. **モック活用**: 外部依存を適切にモック化
3. **カバレッジ確認**: 定期的にカバレッジをチェック
4. **独立性保持**: テスト間の依存を避ける
5. **明確な命名**: テストの意図が分かる名前を付ける
6. **エラーケース**: 正常系だけでなく異常系もテスト
7. **保守性重視**: テストコードも本番コードと同じ品質で

これらのパターンとベストプラクティスに従うことで、信頼性の高いテストスイートを構築できます。