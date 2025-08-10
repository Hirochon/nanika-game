# TypeScript型システム設計

## 目的と概要

このドキュメントは、Nanika GameプロジェクトのTypeScript型システム設計について詳述します。DDDアーキテクチャの原則に基づき、ドメイン駆動な型設計と強力な型安全性を提供し、開発者の生産性向上とバグの早期発見を実現する包括的な型システムを定義します。

## 現在の実装状況

- **厳格なTypeScript設定**: strict mode有効、any型の使用禁止
- **ドメイン型**: エンティティ、値オブジェクト、コマンド・リザルトパターンの型実装
- **Prisma型統合**: データベーススキーマとTypeScript型の同期
- **React Router型**: ローダー・アクション型の適切な定義
- **エラー型**: 階層化されたエラー型システム

## TypeScript設定方針

### tsconfig.json設定

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    // 型安全性の強化
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,

    // パス解決
    "baseUrl": ".",
    "paths": {
      "~/*": ["./app/*"]
    },

    // 型チェックの強化
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": [
    "app/**/*.ts",
    "app/**/*.tsx",
    "tests/**/*.ts",
    "tests/**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "build",
    "dist"
  ]
}
```

## ドメイン型設計

### 1. 基本的な値オブジェクト型

```typescript
// app/domain/value-objects/types.ts

// 基底型
export type Primitive = string | number | boolean | Date;

// ブランド型パターン（型安全性強化）
declare const __brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [__brand]: TBrand };

// ID型（各ドメインオブジェクト用）
export type UserId = Brand<number, 'UserId'>;
export type GameId = Brand<string, 'GameId'>;
export type CharacterId = Brand<string, 'CharacterId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type SessionId = Brand<string, 'SessionId'>;

// ファクトリー関数
export const UserId = {
  create: (value: number): UserId => value as UserId,
  from: (value: unknown): UserId | null => 
    typeof value === 'number' && value > 0 ? value as UserId : null
};

export const GameId = {
  create: (value: string): GameId => {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid GameId');
    }
    return value as GameId;
  },
  generate: (): GameId => crypto.randomUUID() as GameId
};

// 値オブジェクト型
export interface EmailValue {
  readonly value: string;
  readonly domain: string;
  readonly localPart: string;
}

export interface PasswordValue {
  readonly hash: string;
  readonly algorithm: 'bcrypt' | 'argon2';
  readonly createdAt: Date;
}

// 列挙型
export const GameStatus = {
  WAITING: 'waiting',
  PLAYING: 'playing', 
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
} as const;
export type GameStatus = typeof GameStatus[keyof typeof GameStatus];

export const CharacterType = {
  WARRIOR: 'warrior',
  MAGE: 'mage',
  ARCHER: 'archer',
  ROGUE: 'rogue'
} as const;
export type CharacterType = typeof CharacterType[keyof typeof CharacterType];

export const ItemRarity = {
  COMMON: 'common',
  RARE: 'rare', 
  EPIC: 'epic',
  LEGENDARY: 'legendary'
} as const;
export type ItemRarity = typeof ItemRarity[keyof typeof ItemRarity];
```

### 2. エンティティ型定義

```typescript
// app/domain/entities/types.ts

// 基底エンティティ型
export interface BaseEntity<TId> {
  readonly id: TId;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}

// ユーザーエンティティ
export interface UserEntity extends BaseEntity<UserId> {
  readonly name: string;
  readonly email: EmailValue;
  readonly password: PasswordValue;
  readonly profile?: UserProfile;
  readonly deletedAt?: Date;
}

export interface UserProfile {
  readonly avatarUrl?: string;
  readonly bio?: string;
  readonly preferences: UserPreferences;
  readonly statistics: UserStatistics;
}

export interface UserPreferences {
  readonly theme: 'light' | 'dark' | 'auto';
  readonly language: 'ja' | 'en';
  readonly notifications: NotificationSettings;
}

export interface NotificationSettings {
  readonly email: boolean;
  readonly push: boolean;
  readonly gameInvites: boolean;
  readonly achievements: boolean;
}

export interface UserStatistics {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly gamesLost: number;
  readonly totalPlayTime: number; // 秒単位
  readonly favoriteCharacterType?: CharacterType;
  readonly achievements: AchievementId[];
}

// ゲームエンティティ
export interface GameEntity extends BaseEntity<GameId> {
  readonly name: string;
  readonly status: GameStatus;
  readonly maxPlayers: number;
  readonly settings: GameSettings;
  readonly createdBy: UserId;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

export interface GameSettings {
  readonly gameMode: 'classic' | 'speed' | 'custom';
  readonly timeLimit?: number; // 秒単位
  readonly difficulty: 'easy' | 'normal' | 'hard';
  readonly allowSpectators: boolean;
  readonly isPrivate: boolean;
  readonly password?: string;
  readonly customRules?: Record<string, unknown>;
}

// キャラクターエンティティ
export interface CharacterEntity extends BaseEntity<CharacterId> {
  readonly userId: UserId;
  readonly name: string;
  readonly type: CharacterType;
  readonly level: number;
  readonly experience: number;
  readonly stats: CharacterStats;
  readonly deletedAt?: Date;
}

export interface CharacterStats {
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly strength: number;
  readonly defense: number;
  readonly speed: number;
  readonly intelligence: number;
  readonly luck: number;
}

// セッションエンティティ
export interface SessionEntity {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly token: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
```

### 3. 集約ルート型

```typescript
// app/domain/aggregates/types.ts

// ゲーム集約（複数エンティティを管理）
export interface GameAggregate {
  readonly game: GameEntity;
  readonly participants: GameParticipant[];
  readonly events: GameEvent[];
  readonly currentState: GameState;
}

export interface GameParticipant {
  readonly id: string;
  readonly userId: UserId;
  readonly characterId?: CharacterId;
  readonly joinedAt: Date;
  readonly status: ParticipantStatus;
  readonly score: number;
  readonly gameData: Record<string, unknown>;
}

export const ParticipantStatus = {
  JOINED: 'joined',
  READY: 'ready',
  PLAYING: 'playing',
  FINISHED: 'finished',
  LEFT: 'left',
  KICKED: 'kicked'
} as const;
export type ParticipantStatus = typeof ParticipantStatus[keyof typeof ParticipantStatus];

export interface GameEvent {
  readonly id: string;
  readonly gameId: GameId;
  readonly type: GameEventType;
  readonly playerId?: UserId;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

export const GameEventType = {
  GAME_STARTED: 'game_started',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  MOVE_MADE: 'move_made',
  TURN_CHANGED: 'turn_changed',
  GAME_ENDED: 'game_ended'
} as const;
export type GameEventType = typeof GameEventType[keyof typeof GameEventType];

export interface GameState {
  readonly currentTurn?: UserId;
  readonly turnNumber: number;
  readonly board?: GameBoard;
  readonly timeRemaining?: number;
  readonly metadata: Record<string, unknown>;
}

export interface GameBoard {
  readonly width: number;
  readonly height: number;
  readonly cells: GameCell[][];
}

export interface GameCell {
  readonly x: number;
  readonly y: number;
  readonly content?: GameCellContent;
  readonly isSelectable: boolean;
}

export interface GameCellContent {
  readonly type: 'player' | 'item' | 'obstacle' | 'goal';
  readonly owner?: UserId;
  readonly properties: Record<string, unknown>;
}
```

## コマンド・リザルトパターン型

### 1. コマンド型

```typescript
// app/application/commands/types.ts

// 基底コマンド型
export interface BaseCommand {
  readonly timestamp: Date;
  readonly requestId: string;
  readonly userId?: UserId;
}

// 認証関連コマンド
export interface LoginCommand extends BaseCommand {
  readonly email: EmailValue;
  readonly password: string;
  readonly rememberMe: boolean;
}

export interface RegisterCommand extends BaseCommand {
  readonly name: string;
  readonly email: EmailValue;
  readonly password: string;
  readonly confirmPassword: string;
  readonly acceptTerms: boolean;
}

export interface LogoutCommand extends BaseCommand {
  readonly sessionToken: string;
}

// ゲーム関連コマンド
export interface CreateGameCommand extends BaseCommand {
  readonly name: string;
  readonly maxPlayers: number;
  readonly settings: GameSettings;
}

export interface JoinGameCommand extends BaseCommand {
  readonly gameId: GameId;
  readonly characterId?: CharacterId;
  readonly password?: string;
}

export interface MakeGameMoveCommand extends BaseCommand {
  readonly gameId: GameId;
  readonly moveData: GameMoveData;
}

export interface GameMoveData {
  readonly type: 'select' | 'move' | 'attack' | 'use_item';
  readonly source?: { x: number; y: number };
  readonly target: { x: number; y: number };
  readonly itemId?: ItemId;
  readonly metadata?: Record<string, unknown>;
}

// バリデーション型
export type CommandValidationError<T> = {
  [K in keyof T]?: string[];
};

export interface CommandValidationResult<T> {
  readonly isValid: boolean;
  readonly errors: CommandValidationError<T>;
  readonly data?: T;
}
```

### 2. リザルト型

```typescript
// app/application/results/types.ts

// 基底リザルト型
export interface BaseResult {
  readonly success: boolean;
  readonly timestamp: Date;
  readonly requestId: string;
}

export interface SuccessResult<T> extends BaseResult {
  readonly success: true;
  readonly data: T;
}

export interface ErrorResult extends BaseResult {
  readonly success: false;
  readonly error: ApplicationError;
}

export type ApplicationResult<T> = SuccessResult<T> | ErrorResult;

// 認証結果
export interface LoginResultData {
  readonly user: UserSummary;
  readonly sessionToken: string;
  readonly expiresAt: Date;
}

export interface UserSummary {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
  readonly avatarUrl?: string;
}

// ゲーム結果
export interface GameCreatedResultData {
  readonly game: GameSummary;
  readonly joinUrl: string;
}

export interface GameSummary {
  readonly id: GameId;
  readonly name: string;
  readonly status: GameStatus;
  readonly currentPlayers: number;
  readonly maxPlayers: number;
  readonly createdBy: UserSummary;
  readonly createdAt: Date;
}

export interface GameJoinedResultData {
  readonly game: GameAggregate;
  readonly participant: GameParticipant;
}

export interface GameMoveResultData {
  readonly gameState: GameState;
  readonly isValidMove: boolean;
  readonly nextTurn?: UserId;
}
```

## エラー型システム

### 1. エラー階層

```typescript
// app/shared/errors/types.ts

// ベースエラー型
export interface BaseErrorData {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
  readonly stack?: string;
}

// エラーカテゴリ別型
export interface DomainErrorData extends BaseErrorData {
  readonly category: 'domain';
  readonly domainCode: DomainErrorCode;
}

export interface ValidationErrorData extends BaseErrorData {
  readonly category: 'validation';
  readonly fieldErrors: Record<string, string[]>;
}

export interface AuthenticationErrorData extends BaseErrorData {
  readonly category: 'authentication';
  readonly authCode: AuthErrorCode;
}

export interface InfrastructureErrorData extends BaseErrorData {
  readonly category: 'infrastructure';
  readonly infraCode: InfraErrorCode;
}

export type ApplicationError = 
  | DomainErrorData 
  | ValidationErrorData 
  | AuthenticationErrorData 
  | InfrastructureErrorData;

// エラーコード型
export const DomainErrorCode = {
  BUSINESS_RULE_VIOLATION: 'DOMAIN_001',
  INVALID_OPERATION: 'DOMAIN_002',
  RESOURCE_NOT_FOUND: 'DOMAIN_003',
  RESOURCE_CONFLICT: 'DOMAIN_004'
} as const;
export type DomainErrorCode = typeof DomainErrorCode[keyof typeof DomainErrorCode];

export const AuthErrorCode = {
  INVALID_CREDENTIALS: 'AUTH_001',
  SESSION_EXPIRED: 'AUTH_002',
  ACCESS_DENIED: 'AUTH_003',
  ACCOUNT_LOCKED: 'AUTH_004'
} as const;
export type AuthErrorCode = typeof AuthErrorCode[keyof typeof AuthErrorCode];

export const InfraErrorCode = {
  DATABASE_CONNECTION: 'INFRA_001',
  EXTERNAL_API_ERROR: 'INFRA_002',
  NETWORK_TIMEOUT: 'INFRA_003',
  FILE_SYSTEM_ERROR: 'INFRA_004'
} as const;
export type InfraErrorCode = typeof InfraErrorCode[keyof typeof InfraErrorCode];
```

## React Router統合型

### 1. ルート型定義

```typescript
// app/web/types/routes.ts

// ローダーデータ型
export interface HomeLoaderData {
  readonly featuredGames: GameSummary[];
  readonly onlineUsers: number;
  readonly totalGames: number;
}

export interface DashboardLoaderData {
  readonly user: UserEntity;
  readonly recentGames: GameSummary[];
  readonly activeGameInvites: GameInvite[];
  readonly achievements: Achievement[];
}

export interface GamesLoaderData {
  readonly games: GameSummary[];
  readonly pagination: PaginationData;
  readonly filters: GameFilters;
}

export interface GameRoomLoaderData {
  readonly game: GameAggregate;
  readonly canJoin: boolean;
  readonly currentUser?: UserSummary;
}

// アクションデータ型
export interface LoginActionData {
  readonly success: boolean;
  readonly errors?: CommandValidationError<LoginCommand>;
  readonly message?: string;
}

export interface GameCreateActionData {
  readonly success: boolean;
  readonly gameId?: GameId;
  readonly errors?: CommandValidationError<CreateGameCommand>;
  readonly message?: string;
}

// フォームデータ型
export interface LoginFormData {
  readonly email: string;
  readonly password: string;
  readonly rememberMe?: string; // HTMLフォームでは文字列
}

export interface RegisterFormData {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly acceptTerms?: string;
}

export interface GameCreateFormData {
  readonly name: string;
  readonly maxPlayers: string; // HTMLフォームでは文字列
  readonly gameMode: string;
  readonly timeLimit?: string;
  readonly difficulty: string;
  readonly isPrivate?: string;
  readonly password?: string;
}
```

### 2. React Router型安全性強化

```typescript
// app/web/utils/route-utils.ts

// 型安全なフォームデータパース
export function parseFormData<T extends Record<string, unknown>>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const parsedData = schema.parse(rawData);
    return { success: true, data: parsedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      }
      return { success: false, errors };
    }
    throw error;
  }
}

// 型安全なactionData使用
export function useTypedActionData<T>(): T | undefined {
  const actionData = useActionData();
  return actionData as T | undefined;
}

// 型安全なloaderData使用
export function useTypedLoaderData<T>(): T {
  const loaderData = useLoaderData();
  return loaderData as T;
}
```

## データベース型統合

### 1. Prisma型マッピング

```typescript
// app/infrastructure/database/types.ts
import type { User, Game, Session, Character } from '@prisma/client';

// Prisma型からドメイン型への変換
export type PrismaToUserEntity = (prismaUser: User) => UserEntity;
export type PrismaToGameEntity = (prismaGame: Game) => GameEntity;
export type PrismaToSessionEntity = (prismaSession: Session) => SessionEntity;
export type PrismaToCharacterEntity = (prismaCharacter: Character) => CharacterEntity;

// ドメイン型からPrisma型への変換
export type UserEntityToPrisma = (userEntity: UserEntity) => Omit<User, 'id'>;
export type GameEntityToPrisma = (gameEntity: GameEntity) => Omit<Game, 'id'>;

// クエリ結果型
export interface GameWithParticipants extends Game {
  participants: Array<{
    id: string;
    userId: number;
    user: {
      id: number;
      name: string;
    };
    joinedAt: Date;
    status: string;
    score: number;
  }>;
}

export interface UserWithStats extends User {
  _count: {
    sessions: number;
    characters: number;
  };
  characters: Pick<Character, 'id' | 'name' | 'type' | 'level'>[];
}
```

### 2. リポジトリ型インターフェース

```typescript
// app/domain/repositories/types.ts

// 基底リポジトリ型
export interface BaseRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
}

// 検索条件型
export interface QueryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: OrderBy[];
  readonly include?: string[];
}

export interface OrderBy {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  readonly items: T[];
  readonly totalCount: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
  readonly currentPage: number;
  readonly totalPages: number;
}

// 具体的リポジトリ型
export interface IUserRepository extends BaseRepository<UserEntity, UserId> {
  findByEmail(email: EmailValue): Promise<UserEntity | null>;
  findByIds(ids: UserId[]): Promise<UserEntity[]>;
  search(query: UserSearchQuery): Promise<PaginationResult<UserEntity>>;
}

export interface UserSearchQuery {
  readonly name?: string;
  readonly email?: string;
  readonly isActive?: boolean;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

export interface IGameRepository extends BaseRepository<GameEntity, GameId> {
  findByStatus(status: GameStatus): Promise<GameEntity[]>;
  findByCreator(creatorId: UserId): Promise<GameEntity[]>;
  findJoinableGames(filters: GameFilters): Promise<PaginationResult<GameEntity>>;
  findWithParticipants(gameId: GameId): Promise<GameAggregate | null>;
}

export interface GameFilters {
  readonly status?: GameStatus[];
  readonly maxPlayers?: number;
  readonly hasPassword?: boolean;
  readonly gameMode?: string;
  readonly createdBy?: UserId;
}
```

## ユーティリティ型

### 1. 共通ユーティリティ型

```typescript
// app/shared/types/utils.ts

// Optional Properties
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Required Properties
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Deep Readonly
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// NonEmpty Array
export type NonEmptyArray<T> = [T, ...T[]];

// Exact Type
export type Exact<T, U> = T extends U ? (U extends T ? T : never) : never;

// Union to Intersection
export type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// Awaited (for Promise types)
export type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// Function Parameters
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

// Function Return Type
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

// Object Keys
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Pick by Type
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

// Omit by Type  
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;
```

### 2. 条件付き型

```typescript
// app/shared/types/conditional.ts

// APIレスポンス型の条件分岐
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: ApplicationError };

// フォームフィールド型（必須/任意の条件分岐）
export type FormField<T, TRequired extends boolean = false> = {
  value: T;
  error?: string[];
  touched: boolean;
  required: TRequired;
} & (TRequired extends true ? {} : { defaultValue?: T });

// 権限ベース型（ユーザー権限による型変化）
export type UserActionsByRole<TRole extends UserRole> = 
  TRole extends 'admin' ? AdminActions :
  TRole extends 'moderator' ? ModeratorActions :
  TRole extends 'user' ? UserActions :
  never;

export const UserRole = {
  ADMIN: 'admin',
  MODERATOR: 'moderator', 
  USER: 'user'
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface AdminActions {
  readonly canDeleteAnyGame: true;
  readonly canBanUsers: true;
  readonly canViewSystemMetrics: true;
  readonly canModifyGameSettings: true;
}

export interface ModeratorActions {
  readonly canDeleteAnyGame: false;
  readonly canBanUsers: true;
  readonly canViewSystemMetrics: false;
  readonly canModifyGameSettings: false;
}

export interface UserActions {
  readonly canDeleteAnyGame: false;
  readonly canBanUsers: false;
  readonly canViewSystemMetrics: false;
  readonly canModifyGameSettings: false;
}
```

## バリデーション型統合

### 1. Zod統合

```typescript
// app/shared/validation/schemas.ts
import { z } from 'zod';

// 基本バリデーション
export const EmailSchema = z.string()
  .email('有効なメールアドレスを入力してください')
  .max(255, 'メールアドレスは255文字以下で入力してください');

export const PasswordSchema = z.string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '大文字・小文字・数字を含む必要があります');

export const UserNameSchema = z.string()
  .min(1, '名前は必須です')
  .max(50, '名前は50文字以下で入力してください')
  .regex(/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/, '有効な文字を使用してください');

// コマンドスキーマ
export const LoginCommandSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
  rememberMe: z.boolean().default(false),
  timestamp: z.date().default(() => new Date()),
  requestId: z.string().uuid()
});

export const RegisterCommandSchema = z.object({
  name: UserNameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, '利用規約に同意する必要があります')
}).refine(data => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword']
});

export const GameCreateCommandSchema = z.object({
  name: z.string()
    .min(1, 'ゲーム名は必須です')
    .max(100, 'ゲーム名は100文字以下で入力してください'),
  maxPlayers: z.number()
    .int('整数で入力してください')
    .min(2, '最少2人からゲーム可能です')
    .max(8, '最大8人までです'),
  settings: z.object({
    gameMode: z.enum(['classic', 'speed', 'custom'], {
      errorMap: () => ({ message: '有効なゲームモードを選択してください' })
    }),
    timeLimit: z.number().int().positive().optional(),
    difficulty: z.enum(['easy', 'normal', 'hard']),
    allowSpectators: z.boolean().default(true),
    isPrivate: z.boolean().default(false),
    password: z.string().optional()
  }).refine(data => !data.isPrivate || data.password, {
    message: 'プライベートゲームにはパスワードが必要です',
    path: ['password']
  })
});

// 型推論
export type LoginCommandInput = z.infer<typeof LoginCommandSchema>;
export type RegisterCommandInput = z.infer<typeof RegisterCommandSchema>;
export type GameCreateCommandInput = z.infer<typeof GameCreateCommandSchema>;
```

## テスト型サポート

### 1. Mock型定義

```typescript
// tests/types/mocks.ts

// Mock Factory型
export type MockFactory<T> = (overrides?: Partial<T>) => T;

// Entity Mocks
export const createMockUser: MockFactory<UserEntity> = (overrides = {}) => ({
  id: UserId.create(1),
  name: 'Test User',
  email: { value: 'test@example.com', domain: 'example.com', localPart: 'test' },
  password: { hash: 'hashed', algorithm: 'bcrypt', createdAt: new Date() },
  createdAt: new Date(),
  ...overrides
});

export const createMockGame: MockFactory<GameEntity> = (overrides = {}) => ({
  id: GameId.generate(),
  name: 'Test Game',
  status: GameStatus.WAITING,
  maxPlayers: 4,
  settings: {
    gameMode: 'classic',
    difficulty: 'normal',
    allowSpectators: true,
    isPrivate: false
  },
  createdBy: UserId.create(1),
  createdAt: new Date(),
  ...overrides
});

// Repository Mocks
export interface MockUserRepository extends IUserRepository {
  __setMockData(users: UserEntity[]): void;
  __clearMockData(): void;
  __getCallCount(method: keyof IUserRepository): number;
}

export interface MockGameRepository extends IGameRepository {
  __setMockData(games: GameEntity[]): void;
  __clearMockData(): void;
  __getCallCount(method: keyof IGameRepository): number;
}

// Test Scenario Types
export interface TestScenario<TInput, TExpected> {
  readonly description: string;
  readonly input: TInput;
  readonly expected: TExpected;
  readonly setup?: () => Promise<void>;
  readonly teardown?: () => Promise<void>;
}

export type UserTestScenario = TestScenario<LoginCommand, ApplicationResult<LoginResultData>>;
export type GameTestScenario = TestScenario<CreateGameCommand, ApplicationResult<GameCreatedResultData>>;
```

## 型安全性確保のベストプラクティス

### 1. 型ガード

```typescript
// app/shared/types/guards.ts

// 基本型ガード
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// ドメイン型ガード
export function isUserId(value: unknown): value is UserId {
  return isNumber(value) && value > 0;
}

export function isGameStatus(value: unknown): value is GameStatus {
  return isString(value) && Object.values(GameStatus).includes(value as GameStatus);
}

export function isValidEmail(value: unknown): value is string {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// エラー型ガード
export function isApplicationError(value: unknown): value is ApplicationError {
  return (
    typeof value === 'object' && 
    value !== null && 
    'category' in value &&
    'code' in value &&
    'message' in value
  );
}

export function isDomainError(error: ApplicationError): error is DomainErrorData {
  return error.category === 'domain';
}

export function isValidationError(error: ApplicationError): error is ValidationErrorData {
  return error.category === 'validation';
}
```

### 2. 型アサーション関数

```typescript
// app/shared/types/assertions.ts

// アサーション関数
export function assertIsString(value: unknown): asserts value is string {
  if (!isString(value)) {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

export function assertIsUserId(value: unknown): asserts value is UserId {
  if (!isUserId(value)) {
    throw new Error(`Invalid UserId: ${value}`);
  }
}

export function assertNonNull<T>(value: T | null): asserts value is T {
  if (value === null) {
    throw new Error('Value cannot be null');
  }
}

export function assertNonEmpty<T>(array: T[]): asserts array is NonEmptyArray<T> {
  if (array.length === 0) {
    throw new Error('Array cannot be empty');
  }
}

// 条件付きアサーション
export function assertValidGameSettings(settings: unknown): asserts settings is GameSettings {
  if (typeof settings !== 'object' || settings === null) {
    throw new Error('Invalid game settings');
  }
  
  const s = settings as any;
  
  if (!['classic', 'speed', 'custom'].includes(s.gameMode)) {
    throw new Error('Invalid game mode');
  }
  
  if (!['easy', 'normal', 'hard'].includes(s.difficulty)) {
    throw new Error('Invalid difficulty');
  }
  
  if (typeof s.allowSpectators !== 'boolean') {
    throw new Error('allowSpectators must be boolean');
  }
}
```

## 今後の型システム拡張計画

### Phase 1: 基本型システム強化（3ヶ月）
1. **詳細なエラー型**: より具体的なエラーコードと文脈情報
2. **イベント型システム**: ドメインイベントの型安全な定義
3. **ストリーミング型**: リアルタイムデータの型安全性
4. **国際化型**: 多言語対応のための型定義

### Phase 2: 高度な型機能（6ヶ月）
1. **条件型の活用**: より複雑なビジネスロジックの型表現
2. **テンプレートリテラル型**: URL・パス・文字列パターンの型安全性
3. **再帰型**: ネストした構造の型安全な処理
4. **ブランド型の拡張**: より強力なドメインモデリング

### Phase 3: 開発者体験向上（12ヶ月）
1. **自動型生成**: APIスキーマから型の自動生成
2. **型レベルテスト**: 型システム自体のテスト
3. **LSP統合**: より良い型ヒントとエラー表示
4. **型ドキュメント**: 自動型ドキュメント生成

## まとめ

本TypeScript型システム設計は、DDDアーキテクチャの原則に基づき、ドメインの複雑さを型レベルで表現し、コンパイル時にビジネスルールの違反を検出できる強力な型安全性を提供します。ブランド型、条件型、ユーティリティ型を活用することで、実行時エラーを大幅に削減し、開発者の生産性向上を実現します。

継続的な型システムの改善と最新TypeScript機能の活用により、より安全で保守しやすいゲームアプリケーションの開発基盤を構築していきます。