# API実装ガイドライン

## 目的と概要

このドキュメントは、API設計（`.claude/01_architecture_docs/05_api_design.md`）に基づいて、実際のAPI実装を行う際の技術的な詳細とベストプラクティスを提供します。api-specialistエージェントがAPI実装を担当する際の参考資料です。

## 実装上の責務

api-specialistエージェントは以下の実装責務を持ちます：

### 1. API実装の責務
- React Router ActionsとLoadersの実装
- バリデーション処理の実装
- エラーハンドリングの実装
- レスポンス形式の統一
- セッション管理の実装
- 認証・認可処理の実装

### 2. テストの責務
- APIエンドポイントのユニットテスト
- 統合テスト
- エラーケースのテスト
- パフォーマンステスト

### 3. パフォーマンス最適化
- データベースクエリの最適化
- キャッシュ戦略の実装
- ページネーションの実装
- N+1問題の解決

## 実装パターンとコード例

### 1. React Router Actionの実装パターン

```typescript
// app/web/routes/[endpoint].tsx
import { ActionFunctionArgs, json, redirect } from '@remix-run/node';
import { container } from '~/di/container';
import { validateRequest, handleError } from '~/utils/api-helpers';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. リクエストデータの取得
    const formData = await request.formData();
    
    // 2. バリデーション
    const validationResult = await validateRequest(formData, ValidationSchema);
    if (!validationResult.success) {
      return json({ 
        success: false, 
        error: validationResult.error 
      }, { status: 400 });
    }

    // 3. ユースケース実行
    const useCase = container.resolve(UseCaseClass);
    const result = await useCase.execute(validationResult.data);

    // 4. レスポンス処理
    if (result.isSuccess()) {
      return json({ 
        success: true, 
        data: result.getValue() 
      });
    }

    return json({ 
      success: false, 
      error: result.getError() 
    }, { status: 400 });
    
  } catch (error) {
    return handleError(error);
  }
}
```

### 2. Loaderの実装パターン

```typescript
// app/web/routes/[endpoint].tsx
import { LoaderFunctionArgs, json } from '@remix-run/node';
import { requireAuth } from '~/utils/auth';
import { cacheResponse } from '~/utils/cache';

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. 認証チェック（必要な場合）
    const user = await requireAuth(request);
    
    // 2. キャッシュチェック
    const cacheKey = `data:${params.id}`;
    const cached = await cacheResponse.get(cacheKey);
    if (cached) {
      return json(cached);
    }
    
    // 3. データ取得
    const useCase = container.resolve(GetDataUseCase);
    const result = await useCase.execute({ userId: user.id, ...params });
    
    // 4. キャッシュ設定
    await cacheResponse.set(cacheKey, result.getValue(), { ttl: 300 });
    
    // 5. レスポンス
    return json({
      success: true,
      data: result.getValue()
    });
    
  } catch (error) {
    return handleError(error);
  }
}
```

### 3. バリデーション実装

```typescript
// app/web/utils/validation.ts
import { z } from 'zod';

// バリデーションスキーマ定義
export const CreateGameSchema = z.object({
  name: z.string()
    .min(1, '名前は必須です')
    .max(100, '名前は100文字以内で入力してください'),
  maxPlayers: z.number()
    .min(2, '最小プレイヤー数は2人です')
    .max(10, '最大プレイヤー数は10人です'),
  gameMode: z.enum(['classic', 'speed', 'custom']),
  timeLimit: z.number().optional(),
  difficulty: z.enum(['easy', 'normal', 'hard'])
});

// バリデーション実行
export async function validateRequest<T>(
  data: FormData | Record<string, any>,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: any }> {
  try {
    const parsed = await schema.parseAsync(
      data instanceof FormData ? Object.fromEntries(data) : data
    );
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラー',
          details: error.errors
        }
      };
    }
    throw error;
  }
}
```

### 4. エラーハンドリング実装

```typescript
// app/web/utils/error-handler.ts
import { json } from '@remix-run/node';
import { DomainError, ValidationError, AuthenticationError } from '~/shared/errors';

export function handleError(error: unknown) {
  // ドメインエラー
  if (error instanceof DomainError) {
    return json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }, { status: 400 });
  }

  // 認証エラー
  if (error instanceof AuthenticationError) {
    return json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: error.message
      }
    }, { status: 401 });
  }

  // バリデーションエラー
  if (error instanceof ValidationError) {
    return json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: error.details
      }
    }, { status: 422 });
  }

  // 予期しないエラー
  console.error('Unexpected error:', error);
  return json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'サーバー内部エラーが発生しました'
    }
  }, { status: 500 });
}
```

### 5. 認証・認可実装

```typescript
// app/web/utils/auth.ts
import { redirect } from '@remix-run/node';
import { container } from '~/di/container';
import { ISessionRepository } from '~/domain/repositories';

export async function requireAuth(request: Request) {
  const cookie = request.headers.get('Cookie');
  const sessionToken = parseCookie(cookie)?.session;

  if (!sessionToken) {
    throw redirect('/login');
  }

  const sessionRepo = container.resolve<ISessionRepository>('ISessionRepository');
  const session = await sessionRepo.findByToken(sessionToken);

  if (!session || session.isExpired()) {
    throw redirect('/login');
  }

  return session.getUser();
}

export async function requireRole(request: Request, role: string) {
  const user = await requireAuth(request);
  
  if (!user.hasRole(role)) {
    throw new AuthorizationError(`権限がありません: ${role}`);
  }
  
  return user;
}
```

### 6. キャッシュ実装

```typescript
// app/web/utils/cache.ts
interface CacheOptions {
  ttl?: number; // seconds
  tags?: string[];
}

class CacheManager {
  private cache = new Map<string, { data: any; expires: number }>();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  async set(key: string, data: any, options: CacheOptions = {}) {
    const ttl = options.ttl || 300; // デフォルト5分
    const expires = Date.now() + (ttl * 1000);
    
    this.cache.set(key, { data, expires });
  }

  async invalidate(pattern: string | RegExp) {
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cacheResponse = new CacheManager();
```

## テスト実装ガイドライン

### 1. APIエンドポイントテスト

```typescript
// __tests__/api/games.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { action, loader } from '~/routes/api/games';
import { container } from '~/di/container';

describe('Games API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/games', () => {
    it('should create a new game with valid data', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Game');
      formData.append('maxPlayers', '4');
      formData.append('gameMode', 'classic');

      const request = new Request('http://localhost/api/games', {
        method: 'POST',
        body: formData
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
    });

    it('should return validation error for invalid data', async () => {
      const formData = new FormData();
      formData.append('name', ''); // 空の名前

      const request = new Request('http://localhost/api/games', {
        method: 'POST',
        body: formData
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/games', () => {
    it('should return paginated games list', async () => {
      const request = new Request('http://localhost/api/games?limit=10&offset=0');

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('games');
      expect(data.data).toHaveProperty('pagination');
    });
  });
});
```

### 2. 統合テスト

```typescript
// __tests__/integration/game-flow.test.ts
import { describe, it, expect } from 'vitest';
import { setupTestDb, cleanupTestDb } from '~/test/utils';

describe('Game Flow Integration', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb();
  });

  it('should complete full game flow', async () => {
    // 1. ユーザー登録
    const registerResponse = await fetch('/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!'
      })
    });
    expect(registerResponse.ok).toBe(true);

    // 2. ログイン
    const loginResponse = await fetch('/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!'
      })
    });
    expect(loginResponse.ok).toBe(true);

    // 3. ゲーム作成
    const createGameResponse = await fetch('/api/games', {
      method: 'POST',
      headers: {
        'Cookie': loginResponse.headers.get('Set-Cookie')
      },
      body: JSON.stringify({
        name: 'Test Game',
        maxPlayers: 4
      })
    });
    const gameData = await createGameResponse.json();
    expect(gameData.success).toBe(true);

    // 4. ゲーム参加
    const joinResponse = await fetch(`/api/games/${gameData.data.id}/join`, {
      method: 'POST',
      headers: {
        'Cookie': loginResponse.headers.get('Set-Cookie')
      }
    });
    expect(joinResponse.ok).toBe(true);
  });
});
```

## パフォーマンス最適化実装

### 1. データベースクエリ最適化

```typescript
// app/api/infrastructure/repositories/game-repository.ts
export class GameRepository implements IGameRepository {
  async findWithParticipants(gameId: string): Promise<Game> {
    // N+1問題を避けるため、関連データを一度に取得
    const gameData = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            },
            character: {
              select: { id: true, name: true, level: true }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    return GameMapper.toDomain(gameData);
  }

  async findManyWithPagination(params: PaginationParams): Promise<PaginatedResult<Game>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    
    // 並列実行で高速化
    const [items, total] = await Promise.all([
      prisma.game.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.game.count()
    ]);

    return {
      items: items.map(GameMapper.toDomain),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
```

### 2. レート制限実装

```typescript
// app/web/utils/rate-limit.ts
class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  async checkLimit(
    identifier: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000
  ): Promise<{ allowed: boolean; remainingAttempts: number; resetAt: number }> {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt || now > attempt.resetAt) {
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + windowMs
      });
      return { allowed: true, remainingAttempts: maxAttempts - 1, resetAt: now + windowMs };
    }

    if (attempt.count >= maxAttempts) {
      return { allowed: false, remainingAttempts: 0, resetAt: attempt.resetAt };
    }

    attempt.count++;
    return { 
      allowed: true, 
      remainingAttempts: maxAttempts - attempt.count,
      resetAt: attempt.resetAt 
    };
  }
}

export const rateLimiter = new RateLimiter();

// 使用例
export async function loginAction({ request }: ActionFunctionArgs) {
  const clientIp = request.headers.get('X-Forwarded-For') || 'unknown';
  const { allowed, remainingAttempts } = await rateLimiter.checkLimit(
    `login:${clientIp}`,
    5,
    15 * 60 * 1000
  );

  if (!allowed) {
    return json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'ログイン試行回数が上限に達しました。後でお試しください。'
      }
    }, { status: 429 });
  }

  // ログイン処理...
}
```

## モニタリングとログ実装

### 1. APIメトリクス収集

```typescript
// app/web/utils/metrics.ts
interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
}

class MetricsCollector {
  private metrics: ApiMetrics[] = [];

  record(metric: ApiMetrics) {
    this.metrics.push(metric);
    
    // バッチで外部サービスに送信（例：DataDog, New Relic）
    if (this.metrics.length >= 100) {
      this.flush();
    }
  }

  async flush() {
    if (this.metrics.length === 0) return;
    
    const batch = [...this.metrics];
    this.metrics = [];
    
    // 外部サービスへの送信
    await sendToMonitoringService(batch);
  }

  getStats(endpoint: string, timeRange: { from: Date; to: Date }) {
    const filtered = this.metrics.filter(m => 
      m.endpoint === endpoint &&
      m.timestamp >= timeRange.from &&
      m.timestamp <= timeRange.to
    );

    return {
      totalRequests: filtered.length,
      averageDuration: filtered.reduce((sum, m) => sum + m.duration, 0) / filtered.length,
      errorRate: filtered.filter(m => m.statusCode >= 400).length / filtered.length,
      p95Duration: this.calculatePercentile(filtered.map(m => m.duration), 95)
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

export const metricsCollector = new MetricsCollector();
```

### 2. 構造化ログ

```typescript
// app/web/utils/logger.ts
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      }
    });
  }
}

export const logger = new Logger();
```

## セキュリティ実装

### 1. CSRF対策

```typescript
// app/web/utils/csrf.ts
import crypto from 'crypto';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCsrfToken(request: Request, token: string): boolean {
  const formData = await request.formData();
  const submittedToken = formData.get('_csrf');
  
  return submittedToken === token;
}

// 使用例
export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request);
  const csrfToken = session.get('csrfToken');
  
  if (!validateCsrfToken(request, csrfToken)) {
    return json({
      success: false,
      error: { code: 'CSRF_ERROR', message: 'Invalid CSRF token' }
    }, { status: 403 });
  }
  
  // 処理続行...
}
```

### 2. 入力サニタイズ

```typescript
// app/web/utils/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>'"]/g, '')
    .slice(0, 1000); // 最大長制限
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '_');
}
```

## まとめ

このドキュメントは、api-specialistエージェントがAPI実装を行う際の技術的な詳細とベストプラクティスを提供します。API設計（`.claude/01_architecture_docs/05_api_design.md`）と連携して、高品質で保守性の高いAPI実装を実現します。

各実装パターンは実際のコード例と共に提供され、テスト、パフォーマンス最適化、セキュリティの観点も含めて包括的にカバーしています。