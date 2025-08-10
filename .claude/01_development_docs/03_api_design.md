# API設計

## 目的と概要

このドキュメントは、Nanika GameプロジェクトのRESTful API設計について詳述します。React Router v7のServer Actionsを活用し、DDDアーキテクチャに適合した型安全で一貫性のあるAPI設計を提供します。

## 現在の実装状況

- **認証API**: ログイン、ログアウト、ユーザー登録を実装済み
- **React Router Actions**: Server-side処理による型安全なフォーム処理
- **セッション管理**: Cookie基盤のセッション実装
- **エラーハンドリング**: 統一されたエラーレスポンス形式
- **バリデーション**: サーバーサイドでの入力検証

## API設計原則

### 1. RESTful設計原則

- **リソース指向**: URLはリソースを表現
- **HTTPメソッド**: 適切な動詞の使用（GET, POST, PUT, DELETE）
- **ステートレス**: 各リクエストは独立
- **統一インターフェース**: 一貫したレスポンス形式

### 2. React Router v7との統合

```typescript
// React Router Actionパターン
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  // バリデーション
  const validationResult = validateFormData(formData);
  if (!validationResult.success) {
    return json({ error: validationResult.error }, { status: 400 });
  }

  // ユースケース実行
  const useCase = container.resolve(LoginUseCase);
  const result = await useCase.execute(command);

  // レスポンス処理
  if (result.isSuccess()) {
    return redirect('/dashboard', {
      headers: { 'Set-Cookie': createSessionCookie(result.getToken()) }
    });
  }

  return json({ error: result.getError() }, { status: 400 });
}
```

## APIレスポンス形式

### 成功レスポンス

```typescript
interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

// 例
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "sessionToken": "abc123..."
  },
  "meta": {
    "timestamp": "2025-08-10T14:30:00Z",
    "requestId": "req-123",
    "version": "1.0"
  }
}
```

### エラーレスポンス

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string; // バリデーションエラー時
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// 例
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが無効です",
    "details": {
      "email": ["有効なメールアドレスを入力してください"],
      "password": ["パスワードは8文字以上である必要があります"]
    }
  },
  "meta": {
    "timestamp": "2025-08-10T14:30:00Z",
    "requestId": "req-124"
  }
}
```

## 現在実装済みAPI

### 1. 認証API

#### POST /login（ログイン）

**リクエスト:**
```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**レスポンス:**
- **成功時**: 302リダイレクト（/dashboard）+ Cookieセット
- **失敗時**: 400 + エラーメッセージ

**実装例:**
```typescript
// app/web/routes/login.tsx
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  const command = new LoginCommand(
    Email.create(formData.get('email') as string),
    formData.get('password') as string
  );

  const useCase = container.resolve(LoginUseCase);
  const result = await useCase.execute(command);

  if (result.isSuccess()) {
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': `session=${result.getToken()}; Path=/; HttpOnly; Secure; SameSite=Strict`
      }
    });
  }

  return json({ error: result.getError() }, { status: 400 });
}
```

#### POST /logout（ログアウト）

**処理内容:**
- セッション無効化
- Cookieクリア
- ログイン画面へリダイレクト

**実装例:**
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get('Cookie');
  const sessionToken = parseCookie(cookie)?.session;

  if (sessionToken) {
    const useCase = container.resolve(LogoutUseCase);
    await useCase.execute(new LogoutCommand(sessionToken));
  }

  return redirect('/login', {
    headers: {
      'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0'
    }
  });
}
```

#### POST /register（ユーザー登録）

**リクエスト:**
```typescript
interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
```

**バリデーション:**
- 名前: 1-50文字
- メールアドレス: 有効な形式、重複チェック
- パスワード: 8文字以上、大小英字・数字含む
- パスワード確認: 一致確認

## 将来実装予定API

### 2. ユーザー管理API

#### GET /api/user/profile（プロフィール取得）

```typescript
interface UserProfileResponse {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  stats: {
    gamesPlayed: number;
    totalScore: number;
    achievements: number;
  };
}
```

#### PUT /api/user/profile（プロフィール更新）

```typescript
interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string; // Base64 or URL
}
```

#### DELETE /api/user/account（アカウント削除）

```typescript
interface DeleteAccountRequest {
  password: string; // 確認用
  reason?: string;
}
```

### 3. ゲーム管理API

#### POST /api/games（ゲーム作成）

```typescript
interface CreateGameRequest {
  name: string;
  maxPlayers: number;
  settings: {
    gameMode: 'classic' | 'speed' | 'custom';
    timeLimit?: number;
    difficulty: 'easy' | 'normal' | 'hard';
  };
}

interface GameResponse {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  currentPlayers: number;
  createdAt: string;
  settings: GameSettings;
}
```

#### GET /api/games（ゲーム一覧）

**クエリパラメータ:**
- `status`: ゲーム状態でフィルタ
- `limit`: 取得件数（デフォルト: 20）
- `offset`: オフセット（ページネーション）

```typescript
interface GamesListResponse {
  games: GameResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  };
}
```

#### POST /api/games/:gameId/join（ゲーム参加）

```typescript
interface JoinGameRequest {
  characterId?: string; // 使用キャラクター
}

interface JoinGameResponse {
  participant: {
    id: string;
    userId: number;
    characterId?: string;
    joinedAt: string;
  };
  game: GameResponse;
}
```

#### POST /api/games/:gameId/leave（ゲーム退出）

#### GET /api/games/:gameId/state（ゲーム状態取得）

```typescript
interface GameStateResponse {
  game: GameResponse;
  participants: Array<{
    userId: number;
    name: string;
    character?: CharacterSummary;
    score: number;
    status: 'active' | 'inactive';
  }>;
  currentTurn?: {
    playerId: number;
    timeRemaining: number;
  };
}
```

### 4. キャラクター管理API

#### GET /api/characters（キャラクター一覧）

```typescript
interface CharacterListResponse {
  characters: Array<{
    id: string;
    name: string;
    type: string;
    level: number;
    experience: number;
    stats: CharacterStats;
    createdAt: string;
  }>;
}
```

#### POST /api/characters（キャラクター作成）

```typescript
interface CreateCharacterRequest {
  name: string;
  type: 'warrior' | 'mage' | 'archer' | 'rogue';
}
```

#### PUT /api/characters/:characterId（キャラクター更新）

#### DELETE /api/characters/:characterId（キャラクター削除）

### 5. アイテム管理API

#### GET /api/items（アイテムマスターデータ）

```typescript
interface ItemsResponse {
  items: Array<{
    id: string;
    name: string;
    type: string;
    rarity: string;
    description: string;
    properties: ItemProperties;
  }>;
}
```

#### GET /api/user/items（ユーザーアイテム）

```typescript
interface UserItemsResponse {
  items: Array<{
    id: string;
    itemId: string;
    item: ItemDetails;
    quantity: number;
    acquiredAt: string;
  }>;
}
```

### 6. 実績システムAPI

#### GET /api/achievements（実績一覧）

```typescript
interface AchievementsResponse {
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    points: number;
    requirements: AchievementCriteria;
  }>;
}
```

#### GET /api/user/achievements（ユーザー実績）

```typescript
interface UserAchievementsResponse {
  achievements: Array<{
    achievementId: string;
    achievement: AchievementDetails;
    progress: number; // 0-100
    completedAt?: string;
    currentProgress: any; // 進捗詳細
  }>;
}
```

## エラーハンドリング戦略

### 1. HTTPステータスコード

- **200**: 成功
- **201**: 作成成功
- **400**: バリデーションエラー、不正リクエスト
- **401**: 認証が必要
- **403**: 権限なし
- **404**: リソースが存在しない
- **409**: 競合エラー（重複等）
- **422**: 処理不可能なエンティティ
- **500**: サーバー内部エラー

### 2. エラーコード体系

```typescript
enum ErrorCode {
  // バリデーションエラー (1000番台)
  VALIDATION_ERROR = 'ERR_1000',
  REQUIRED_FIELD = 'ERR_1001',
  INVALID_FORMAT = 'ERR_1002',
  
  // 認証エラー (2000番台)
  INVALID_CREDENTIALS = 'ERR_2000',
  SESSION_EXPIRED = 'ERR_2001',
  ACCESS_DENIED = 'ERR_2002',
  
  // ビジネスロジックエラー (3000番台)
  GAME_FULL = 'ERR_3000',
  GAME_ALREADY_STARTED = 'ERR_3001',
  INSUFFICIENT_ITEMS = 'ERR_3002',
  
  // システムエラー (9000番台)
  DATABASE_ERROR = 'ERR_9000',
  EXTERNAL_API_ERROR = 'ERR_9001'
}
```

### 3. エラーハンドリング実装

```typescript
// app/web/utils/error-handler.ts
export function handleUseCaseError(error: Error): ResponseInit {
  if (error instanceof DomainError) {
    return json(
      {
        success: false,
        error: {
          code: error.code || 'DOMAIN_ERROR',
          message: error.message
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof ValidationError) {
    return json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラー',
          details: error.details
        }
      },
      { status: 422 }
    );
  }

  // 予期しないエラー
  console.error('Unexpected error:', error);
  return json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました'
      }
    },
    { status: 500 }
  );
}
```

## バリデーション戦略

### 1. 入力バリデーション

```typescript
// app/web/utils/validation.ts
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります')
});

export const RegisterSchema = z.object({
  name: z.string()
    .min(1, '名前は必須です')
    .max(50, '名前は50文字以内で入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string()
    .min(8, 'パスワードは8文字以上である必要があります')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '大文字、小文字、数字を含む必要があります'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"]
});
```

### 2. サニタイゼーション

```typescript
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>'"&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#x27;',
        '"': '&quot;',
        '&': '&amp;'
      };
      return entities[char];
    });
}
```

## セキュリティ考慮事項

### 1. 認証・認可

```typescript
// ミドルウェア的な認証チェック
export async function requireAuth(request: Request): Promise<User | null> {
  const cookie = request.headers.get('Cookie');
  const sessionToken = parseCookie(cookie)?.session;

  if (!sessionToken) {
    throw new AuthenticationError('認証が必要です');
  }

  const sessionRepo = container.resolve<ISessionRepository>('ISessionRepository');
  const session = await sessionRepo.findByToken(sessionToken);

  if (!session || session.isExpired()) {
    throw new AuthenticationError('セッションが無効です');
  }

  return session.getUser();
}
```

### 2. レート制限

```typescript
// 将来実装予定
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

const loginRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分
  maxRequests: 5 // 5回まで
};
```

### 3. CORS設定

```typescript
// vite.config.ts または server設定
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://nanika-game.com'] 
    : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};
```

## パフォーマンス最適化

### 1. キャッシュ戦略

```typescript
// 静的データのキャッシュ
export async function loader({ request }: LoaderFunctionArgs) {
  const cacheKey = `items-${Date.now()}`;
  
  // Redis等での実装例
  const cached = await cache.get(cacheKey);
  if (cached) {
    return json(cached);
  }

  const items = await fetchItems();
  await cache.set(cacheKey, items, { ttl: 3600 }); // 1時間キャッシュ
  
  return json(items);
}
```

### 2. データベースクエリ最適化

```typescript
// N+1問題の回避
const gamesWithParticipants = await prisma.game.findMany({
  include: {
    participants: {
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    }
  }
});
```

### 3. ページネーション

```typescript
export async function getGamesList(params: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const { limit = 20, offset = 0, status } = params;

  const where = status ? { status } : {};

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.game.count({ where })
  ]);

  return {
    games,
    pagination: {
      total,
      limit,
      offset,
      hasNext: offset + limit < total
    }
  };
}
```

## API文書化

### OpenAPI仕様の自動生成

```typescript
// 将来実装: tRPC等を使用した型安全なAPI
import { z } from 'zod';

export const apiRouter = t.router({
  login: t.procedure
    .input(LoginSchema)
    .output(z.object({
      success: z.boolean(),
      data: z.object({
        user: UserSchema,
        sessionToken: z.string()
      }).optional(),
      error: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      // 実装
    })
});
```

## 監視・ログ

### 1. APIメトリクス

```typescript
// アクセスログ
export function logApiRequest(request: Request, response: Response, duration: number) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    status: response.status,
    duration,
    userAgent: request.headers.get('User-Agent')
  }));
}
```

### 2. エラーログ

```typescript
export function logError(error: Error, context: any) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  }));
}
```

## 今後の拡張計画

### Phase 1: リアルタイム機能

- **WebSocket統合**: ゲーム状態のリアルタイム更新
- **Server-Sent Events**: 通知システム
- **楽観的更新**: UIの応答性向上

### Phase 2: GraphQL導入

```typescript
// GraphQL endpoint例
type Query {
  user(id: ID!): User
  games(filter: GameFilter, limit: Int, offset: Int): GameConnection
  leaderboard(gameMode: String, limit: Int): [LeaderboardEntry]
}

type Mutation {
  createGame(input: CreateGameInput!): Game
  joinGame(gameId: ID!): GameParticipant
  submitMove(gameId: ID!, move: GameMoveInput!): GameState
}

type Subscription {
  gameStateChanged(gameId: ID!): GameState
  newMessage(gameId: ID!): ChatMessage
}
```

### Phase 3: マイクロサービス化

- **API Gateway**: 単一エントリーポイント
- **サービス分割**: User Service, Game Service, Analytics Service
- **イベント駆動**: 非同期メッセージング

## まとめ

本API設計は、React Router v7のServer Actionsを活用し、型安全で保守性の高いAPIを提供します。DDDアーキテクチャとの整合性を保ちながら、ゲームアプリケーションに必要な機能を段階的に拡張できる設計となっています。

継続的な改善とパフォーマンス監視を通じて、スケーラブルで信頼性の高いAPIシステムを構築していきます。