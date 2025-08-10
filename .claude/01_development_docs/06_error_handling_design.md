# エラーハンドリング設計

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトのエラーハンドリング戦略について詳述します。DDDアーキテクチャとReact Router v7の特性を活かし、ユーザビリティを損なうことなく、システムの安定性と開発者の生産性を向上させる包括的なエラーハンドリングシステムを設計します。

## 現在の実装状況

- **基本エラークラス**: DomainError, AuthenticationErrorを実装済み
- **バリデーションエラー**: フォーム入力検証とエラー表示
- **React Routerエラーバウンダリー**: 基本的なエラーページ
- **Try-catch**: ユースケース層でのエラーキャッチ
- **ログ出力**: console.errorによる基本的なログ

## エラーハンドリング原則

### 1. レイヤー別責任

**Domain Layer（ドメイン層）:**
- ビジネスルール違反をDomainErrorとしてthrow
- 不正な値オブジェクト作成をValidationErrorとしてthrow
- 外部依存なし、純粋なエラー表現

**Application Layer（アプリケーション層）:**
- ドメインエラーをキャッチしてResultパターンで返却
- 複数のエラーを集約して統一的に処理
- ログ記録の実行

**Infrastructure Layer（インフラ層）:**
- 外部システムエラーをDomainErrorに変換
- データベース接続エラー、ネットワークエラーの処理
- リトライ処理の実装

**Presentation Layer（プレゼンテーション層）:**
- ユーザーフレンドリーなエラーメッセージ表示
- フォームバリデーションエラーの視覚的表現
- エラー状態でのUIの適切な制御

### 2. エラーの分類体系

```typescript
// app/shared/errors/error-codes.ts
export enum ErrorCode {
  // Domain Errors (1000番台)
  DOMAIN_VALIDATION = 'ERR_1001',
  BUSINESS_RULE_VIOLATION = 'ERR_1002',
  INVALID_OPERATION = 'ERR_1003',
  
  // Authentication/Authorization (2000番台)
  INVALID_CREDENTIALS = 'ERR_2001',
  ACCESS_DENIED = 'ERR_2002',
  SESSION_EXPIRED = 'ERR_2003',
  ACCOUNT_LOCKED = 'ERR_2004',
  
  // Game Logic (3000番台)
  GAME_NOT_FOUND = 'ERR_3001',
  GAME_FULL = 'ERR_3002',
  INVALID_MOVE = 'ERR_3003',
  GAME_ALREADY_ENDED = 'ERR_3004',
  
  // Resource (4000番台)
  USER_NOT_FOUND = 'ERR_4001',
  CHARACTER_NOT_FOUND = 'ERR_4002',
  INSUFFICIENT_RESOURCES = 'ERR_4003',
  
  // External System (5000番台)
  DATABASE_CONNECTION = 'ERR_5001',
  EXTERNAL_API_ERROR = 'ERR_5002',
  NETWORK_TIMEOUT = 'ERR_5003',
  
  // System (9000番台)
  UNKNOWN_ERROR = 'ERR_9000',
  CONFIGURATION_ERROR = 'ERR_9001',
  RATE_LIMIT_EXCEEDED = 'ERR_9002',
}
```

## エラークラス実装

### 1. 基底エラークラス

```typescript
// app/shared/errors/base.error.ts
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;
    
    // スタックトレースを正しく設定
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }

  public getDisplayMessage(): string {
    // ユーザー向けメッセージのデフォルト実装
    return 'システムエラーが発生しました。時間をおいて再度お試しください。';
  }
}
```

### 2. ドメインエラー

```typescript
// app/shared/errors/domain.error.ts
export class DomainError extends BaseError {
  constructor(
    message: string,
    code: string = ErrorCode.BUSINESS_RULE_VIOLATION,
    context?: Record<string, any>
  ) {
    super(message, code, context);
  }

  public getDisplayMessage(): string {
    switch (this.code) {
      case ErrorCode.BUSINESS_RULE_VIOLATION:
        return 'この操作は許可されていません。';
      case ErrorCode.INVALID_OPERATION:
        return '無効な操作です。';
      default:
        return super.getDisplayMessage();
    }
  }
}

// app/shared/errors/validation.error.ts
export class ValidationError extends BaseError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(
    message: string,
    fieldErrors: Record<string, string[]> = {},
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.DOMAIN_VALIDATION, context);
    this.fieldErrors = fieldErrors;
  }

  public hasFieldError(field: string): boolean {
    return field in this.fieldErrors && this.fieldErrors[field].length > 0;
  }

  public getFieldError(field: string): string[] {
    return this.fieldErrors[field] || [];
  }

  public getDisplayMessage(): string {
    return '入力内容に不備があります。修正してください。';
  }
}
```

### 3. ビジネス固有エラー

```typescript
// app/shared/errors/authentication.error.ts
export class AuthenticationError extends BaseError {
  constructor(
    message: string,
    code: string = ErrorCode.INVALID_CREDENTIALS,
    context?: Record<string, any>
  ) {
    super(message, code, context);
  }

  public getDisplayMessage(): string {
    switch (this.code) {
      case ErrorCode.INVALID_CREDENTIALS:
        return 'メールアドレスまたはパスワードが正しくありません。';
      case ErrorCode.SESSION_EXPIRED:
        return 'セッションの有効期限が切れました。再度ログインしてください。';
      case ErrorCode.ACCOUNT_LOCKED:
        return 'アカウントがロックされています。管理者にお問い合わせください。';
      default:
        return super.getDisplayMessage();
    }
  }
}

// app/shared/errors/game.error.ts
export class GameError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, any>
  ) {
    super(message, code, context);
  }

  public getDisplayMessage(): string {
    switch (this.code) {
      case ErrorCode.GAME_NOT_FOUND:
        return 'ゲームが見つかりません。';
      case ErrorCode.GAME_FULL:
        return 'ゲームの参加人数が上限に達しています。';
      case ErrorCode.INVALID_MOVE:
        return '無効な手です。別の手をお試しください。';
      case ErrorCode.GAME_ALREADY_ENDED:
        return 'このゲームは既に終了しています。';
      default:
        return super.getDisplayMessage();
    }
  }
}
```

## Resultパターン実装

### 1. Result型定義

```typescript
// app/shared/result.ts
export abstract class Result<T, E extends BaseError = BaseError> {
  protected constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  public static success<T>(value: T): Result<T> {
    return new SuccessResult(value);
  }

  public static failure<E extends BaseError>(error: E): Result<never, E> {
    return new FailureResult(error);
  }

  public isSuccess(): boolean {
    return this._isSuccess;
  }

  public isFailure(): boolean {
    return !this._isSuccess;
  }

  public getValue(): T {
    if (!this.isSuccess()) {
      throw new Error('Cannot get value from failure result');
    }
    return this._value!;
  }

  public getError(): E {
    if (this.isSuccess()) {
      throw new Error('Cannot get error from success result');
    }
    return this._error!;
  }

  public map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure()) {
      return Result.failure(this.getError());
    }
    return Result.success(fn(this.getValue()));
  }

  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure()) {
      return Result.failure(this.getError());
    }
    return fn(this.getValue());
  }
}

class SuccessResult<T> extends Result<T> {
  constructor(value: T) {
    super(true, value);
  }
}

class FailureResult<E extends BaseError> extends Result<never, E> {
  constructor(error: E) {
    super(false, undefined, error);
  }
}
```

### 2. ユースケース層での使用例

```typescript
// app/application/use-cases/login.use-case.ts
export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private authService: AuthenticationService,
    private logger: ILogger
  ) {}

  async execute(command: LoginCommand): Promise<Result<LoginResult, AuthenticationError>> {
    try {
      // 1. ユーザー存在確認
      const user = await this.userRepository.findByEmail(command.email);
      if (!user) {
        this.logger.warn('Login attempt with non-existent email', {
          email: command.email.getValue(),
          timestamp: new Date().toISOString()
        });
        return Result.failure(
          new AuthenticationError(
            'Invalid credentials',
            ErrorCode.INVALID_CREDENTIALS,
            { email: command.email.getValue() }
          )
        );
      }

      // 2. パスワード検証
      const isPasswordValid = this.authService.validateCredentials(
        command.email,
        command.password,
        user
      );

      if (!isPasswordValid) {
        this.logger.warn('Login attempt with invalid password', {
          userId: user.getId().getValue(),
          email: command.email.getValue(),
          timestamp: new Date().toISOString()
        });
        return Result.failure(
          new AuthenticationError(
            'Invalid credentials',
            ErrorCode.INVALID_CREDENTIALS,
            { userId: user.getId().getValue() }
          )
        );
      }

      // 3. セッション作成
      const session = Session.create(user.getId());
      await this.sessionRepository.save(session);

      this.logger.info('User logged in successfully', {
        userId: user.getId().getValue(),
        sessionId: session.getId(),
        timestamp: new Date().toISOString()
      });

      return Result.success(
        new LoginResult(user, session.getToken())
      );

    } catch (error) {
      this.logger.error('Unexpected error during login', {
        error: error.message,
        stack: error.stack,
        email: command.email.getValue(),
        timestamp: new Date().toISOString()
      });

      return Result.failure(
        new AuthenticationError(
          'Login failed due to system error',
          ErrorCode.UNKNOWN_ERROR,
          { originalError: error.message }
        )
      );
    }
  }
}
```

## React Routerでのエラーハンドリング

### 1. グローバルエラーバウンダリー

```typescript
// app/web/components/ErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse } from '@react-router/react';

export function RootErrorBoundary() {
  const error = useRouteError();
  
  // React Router エラーレスポンスの処理
  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="mb-4">
            <h1 className="text-6xl font-bold text-red-500 mb-2">
              {error.status}
            </h1>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {getErrorTitle(error.status)}
            </h2>
            <p className="text-gray-600">
              {getErrorMessage(error.status)}
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >              ページを更新
            </button>
            <a
              href="/"
              className="block w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >              ホームに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 予期しないエラーの処理
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          予期しないエラーが発生しました
        </h1>
        <p className="text-gray-600 mb-6">
          システム管理者に連絡してください
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-red-50 p-4 rounded mb-6">
            <summary className="cursor-pointer font-medium text-red-800">
              エラー詳細（開発環境のみ）
            </summary>
            <pre className="mt-2 text-xs text-red-700 overflow-auto">
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          </details>
        )}
        
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >          ホームに戻る
        </button>
      </div>
    </div>
  );
}

function getErrorTitle(status: number): string {
  switch (status) {
    case 404: return 'ページが見つかりません';
    case 403: return 'アクセス権限がありません';
    case 500: return 'サーバーエラー';
    default: return 'エラーが発生しました';
  }
}

function getErrorMessage(status: number): string {
  switch (status) {
    case 404:
      return 'お探しのページは存在しないか、移動した可能性があります。';
    case 403:
      return 'このページにアクセスする権限がありません。';
    case 500:
      return 'サーバーで問題が発生しました。しばらく待ってからお試しください。';
    default:
      return 'システムで問題が発生しました。';
  }
}
```

### 2. Actionでのエラーハンドリング

```typescript
// app/web/routes/login.tsx
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    
    // バリデーション
    const validation = validateLoginForm(formData);
    if (!validation.success) {
      return json({
        success: false,
        errors: validation.fieldErrors,
        message: 'フォームの入力内容に不備があります'
      }, { status: 400 });
    }

    // ユースケース実行
    const useCase = container.resolve(LoginUseCase);
    const command = new LoginCommand(
      Email.create(validation.data.email),
      validation.data.password
    );
    
    const result = await useCase.execute(command);
    
    if (result.isFailure()) {
      const error = result.getError();
      return json({
        success: false,
        message: error.getDisplayMessage(),
        code: error.code
      }, { 
        status: error.code === ErrorCode.INVALID_CREDENTIALS ? 401 : 500 
      });
    }

    // 成功時の処理
    const loginResult = result.getValue();
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': createSessionCookie(loginResult.sessionToken)
      }
    });

  } catch (error) {
    console.error('Unexpected error in login action:', error);
    return json({
      success: false,
      message: 'システムエラーが発生しました。時間をおいて再度お試しください。',
      code: ErrorCode.UNKNOWN_ERROR
    }, { status: 500 });
  }
}
```

### 3. フォームエラー表示

```typescript
// app/web/components/FormError.tsx
interface FormErrorProps {
  errors?: Record<string, string[]>;
  message?: string;
  className?: string;
}

export function FormError({ errors, message, className }: FormErrorProps) {
  if (!errors && !message) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
      {message && (
        <p className="text-sm text-red-800 mb-2">{message}</p>
      )}
      
      {errors && Object.keys(errors).length > 0 && (
        <ul className="list-disc list-inside space-y-1">
          {Object.entries(errors).map(([field, fieldErrors]) =>
            fieldErrors.map((error, index) => (
              <li key={`${field}-${index}`} className="text-sm text-red-700">
                {error}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// 使用例
export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  return (
    <Form method="post" className="space-y-6">
      <FormError 
        errors={actionData?.errors}
        message={actionData?.message}
        className="mb-4"
      />
      
      <div>
        <input
          name="email"
          type="email"
          className={`form-input ${
            actionData?.errors?.email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="メールアドレス"
        />
        {actionData?.errors?.email && (
          <p className="mt-1 text-sm text-red-600">
            {actionData.errors.email[0]}
          </p>
        )}
      </div>
      
      {/* その他のフィールド */}
    </Form>
  );
}
```

## ログ管理

### 1. ログインターフェース

```typescript
// app/shared/interfaces/logger.interface.ts
export interface ILogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  critical(message: string, context?: Record<string, any>): void;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}
```

### 2. ログ実装

```typescript
// app/infrastructure/logging/console.logger.ts
export class ConsoleLogger implements ILogger {
  constructor(
    private readonly minLevel: LogLevel = LogLevel.INFO,
    private readonly context: Record<string, any> = {}
  ) {}

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  critical(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: LogLevel[level],
      message,
      context: { ...this.context, ...context }
    };

    const method = this.getConsoleMethod(level);
    method(`[${timestamp}] [${LogLevel[level]}] ${message}`, logEntry.context);
  }

  private getConsoleMethod(level: LogLevel) {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        return console.error;
      default:
        return console.log;
    }
  }
}
```

## 監視・アラート戦略

### 1. エラー率監視

```typescript
// app/web/utils/error-tracking.ts
class ErrorTracker {
  private static instance: ErrorTracker;
  private errorCounts = new Map<string, number>();
  private readonly alertThresholds = {
    [ErrorCode.INVALID_CREDENTIALS]: 10, // 10回/分でアラート
    [ErrorCode.DATABASE_CONNECTION]: 1,  // 1回でもアラート
    [ErrorCode.UNKNOWN_ERROR]: 5         // 5回/分でアラート
  };

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  public trackError(error: BaseError): void {
    const key = `${error.code}-${this.getCurrentMinute()}`;
    const currentCount = this.errorCounts.get(key) || 0;
    const newCount = currentCount + 1;
    
    this.errorCounts.set(key, newCount);
    
    const threshold = this.alertThresholds[error.code];
    if (threshold && newCount >= threshold) {
      this.sendAlert(error.code, newCount, threshold);
    }
  }

  private getCurrentMinute(): string {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes()}`;
  }

  private async sendAlert(code: string, count: number, threshold: number): Promise<void> {
    // 実際の実装では外部サービス（Slack, Discord等）に送信
    console.error(`🚨 ALERT: Error ${code} occurred ${count} times (threshold: ${threshold})`);
    
    // 将来実装: Webhook送信
    // await this.webhookService.sendAlert({ code, count, threshold, timestamp: new Date() });
  }
}

// 使用例
export function handleError(error: BaseError): void {
  const tracker = ErrorTracker.getInstance();
  tracker.trackError(error);
}
```

### 2. ヘルスチェックエンドポイント

```typescript
// app/web/routes/api.health.tsx
export async function loader() {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      memory: checkMemoryUsage(),
      disk: checkDiskUsage()
    }
  };

  const isHealthy = Object.values(healthCheck.checks).every(check => check.status === 'ok');
  const status = isHealthy ? 200 : 503;
  
  if (!isHealthy) {
    healthCheck.status = 'degraded';
  }

  return json(healthCheck, { status });
}

async function checkDatabase() {
  try {
    // 簡単なクエリでDB接続確認
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', responseTime: '<10ms' };
  } catch (error) {
    return { status: 'error', message: 'Database connection failed' };
  }
}

function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  
  return {
    status: usedMB < 500 ? 'ok' : 'warning', // 500MB以下はOK
    used: `${usedMB}MB`,
    total: `${totalMB}MB`,
    percentage: `${Math.round((usedMB / totalMB) * 100)}%`
  };
}

function checkDiskUsage() {
  // 簡単な実装
  return { status: 'ok', usage: '45%' };
}
```

## リトライ戦略

### 1. エクスポネンシャルバックオフ

```typescript
// app/shared/utils/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,      // 1秒
  maxDelay: 30000,      // 30秒
  backoffFactor: 2,
  retryableErrors: (error) => {
    // ネットワークエラーやタイムアウトのみリトライ
    return error.message.includes('timeout') || 
           error.message.includes('network') ||
           error.message.includes('ECONNRESET');
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // 最後の試行またはリトライ不可能なエラー
      if (attempt === opts.maxAttempts || !opts.retryableErrors!(lastError)) {
        throw lastError;
      }
      
      // 遅延時間の計算
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );
      
      console.warn(`Operation failed (attempt ${attempt}/${opts.maxAttempts}), retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
```

### 2. データベース操作でのリトライ使用例

```typescript
// app/infrastructure/persistence/repositories/prisma-user.repository.ts
export class PrismaUserRepository implements IUserRepository {
  constructor(
    private prisma: PrismaClient,
    private logger: ILogger
  ) {}

  async findById(id: UserId): Promise<User | null> {
    return withRetry(
      async () => {
        const userData = await this.prisma.user.findUnique({
          where: { id: id.getValue() }
        });
        
        return userData ? this.toDomain(userData) : null;
      },
      {
        maxAttempts: 3,
        baseDelay: 500,
        retryableErrors: (error) => {
          // データベース接続エラーのみリトライ
          return error.message.includes('connection') ||
                 error.message.includes('timeout');
        }
      }
    ).catch(error => {
      this.logger.error('Failed to find user after retries', {
        userId: id.getValue(),
        error: error.message
      });
      throw new DomainError(
        'User lookup failed',
        ErrorCode.DATABASE_CONNECTION,
        { userId: id.getValue() }
      );
    });
  }
}
```

## 今後の拡張計画

### Phase 1: 基本機能強化（3ヶ月）
1. 構造化ログ（JSON形式）の実装
2. エラー集約とアラート機能
3. リトライ戦略の全レイヤー適用
4. パフォーマンス監視の統合

### Phase 2: 外部サービス連携（6ヶ月）
1. Sentry等の外部エラー監視サービス統合
2. Slack/Discord通知システム
3. ログ集約システム（ELK Stack等）
4. メトリクス収集（Prometheus等）

### Phase 3: 高度な機能（12ヶ月）
1. 分散トレーシング（OpenTelemetry）
2. サーキットブレーカーパターン
3. カオスエンジニアリング対応
4. 自動復旧メカニズム

## まとめ

本エラーハンドリング設計は、DDDアーキテクチャの原則に従い、各レイヤーの責任を明確に分離したエラー処理システムを提供します。Resultパターンによる関数型エラーハンドリングとReact Router v7の機能を活用することで、ユーザビリティを損なうことなく、システムの安定性と保守性を向上させる包括的な仕組みを構築します。

継続的な監視と改善を通じて、ユーザーエクスペリエンスと開発者体験の両方を向上させ、信頼性の高いゲームアプリケーションを実現します。