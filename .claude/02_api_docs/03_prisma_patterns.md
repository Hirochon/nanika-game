# Prisma パターン集

## 概要
このドキュメントは、Nanika GameプロジェクトにおけるPrismaを使用したデータベース操作パターンとベストプラクティスを定義します。クリーンアーキテクチャとDDD原則に従い、ドメイン層とインフラストラクチャ層の適切な分離を維持します。

## 目次
1. [基本セットアップ](#基本セットアップ)
2. [スキーマ設計](#スキーマ設計)
3. [リポジトリパターン](#リポジトリパターン)
4. [マイグレーション](#マイグレーション)
5. [シード処理](#シード処理)
6. [クエリパターン](#クエリパターン)
7. [トランザクション](#トランザクション)
8. [パフォーマンス最適化](#パフォーマンス最適化)
9. [エラーハンドリング](#エラーハンドリング)
10. [テスト戦略](#テスト戦略)

## 基本セットアップ

### Prismaスキーマの基本構造
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// モデル定義
model User {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(50)
  email        String    @unique @db.VarChar(255)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")

  // Relations
  sessions Session[]

  @@index([email])
  @@map("users")
}
```

### Prisma Clientの初期化
```typescript
// app/api/infrastructure/persistence/prisma.client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// グレースフルシャットダウン
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

## スキーマ設計

### 命名規則
```prisma
model User {
  // カラム名はcamelCase（Prisma側）
  id        Int      @id @default(autoincrement())
  firstName String   @map("first_name")  // DB側はsnake_case
  lastName  String   @map("last_name")
  
  // テーブル名はsnake_case（複数形）
  @@map("users")
}
```

### リレーション定義
```prisma
// 1対多
model User {
  id       Int       @id @default(autoincrement())
  posts    Post[]    // 1人のユーザーが複数の投稿を持つ
  
  @@map("users")
}

model Post {
  id       Int    @id @default(autoincrement())
  userId   Int    @map("user_id")
  user     User   @relation(fields: [userId], references: [id])
  
  @@map("posts")
}

// 多対多
model User {
  id    Int     @id @default(autoincrement())
  teams Team[]  // 中間テーブルを自動生成
  
  @@map("users")
}

model Team {
  id    Int    @id @default(autoincrement())
  users User[]
  
  @@map("teams")
}

// 明示的な中間テーブル
model UserTeam {
  userId   Int      @map("user_id")
  teamId   Int      @map("team_id")
  role     String
  joinedAt DateTime @default(now()) @map("joined_at")
  
  user User @relation(fields: [userId], references: [id])
  team Team @relation(fields: [teamId], references: [id])
  
  @@id([userId, teamId])
  @@map("user_teams")
}
```

### インデックス最適化
```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String
  role  String
  
  // 単一カラムインデックス
  @@index([email])
  
  // 複合インデックス
  @@index([role, name])
  
  // ユニーク制約
  @@unique([email, role])
  
  @@map("users")
}
```

## リポジトリパターン

### ドメインリポジトリインターフェース
```typescript
// app/domain/repositories/user.repository.ts
import { User } from '@domain/entities/user.entity';
import { Email } from '@domain/value-objects/email.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'name';
  }): Promise<User[]>;
}
```

### Prismaリポジトリ実装
```typescript
// app/api/infrastructure/persistence/repositories/prisma-user.repository.ts
import { User } from '@domain/entities/user.entity';
import type { IUserRepository } from '@domain/repositories/user.repository';
import { Email } from '@domain/value-objects/email.vo';
import { Password } from '@domain/value-objects/password.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import type { PrismaClient } from '@prisma/client';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: id.value },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.value },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async save(user: User): Promise<void> {
    const data = {
      name: user.name,
      email: user.email.value,
      passwordHash: user.password.hashedValue,
      updatedAt: user.updatedAt,
    };

    await this.prisma.user.upsert({
      where: { id: user.id.value },
      update: data,
      create: {
        ...data,
        id: user.id.value,
        createdAt: user.createdAt,
      },
    });
  }

  async delete(id: UserId): Promise<void> {
    await this.prisma.user.delete({
      where: { id: id.value },
    });
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'name';
  }): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      take: options?.limit,
      skip: options?.offset,
      orderBy: options?.orderBy ? { [options.orderBy]: 'asc' } : undefined,
    });

    return Promise.all(users.map(user => this.toDomain(user)));
  }

  // ドメインエンティティへの変換
  private async toDomain(prismaUser: any): Promise<User> {
    return new User({
      id: UserId.create(prismaUser.id),
      name: prismaUser.name,
      email: Email.create(prismaUser.email),
      password: Password.fromHash(prismaUser.passwordHash),
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }
}
```

## マイグレーション

### マイグレーションコマンド
```bash
# 開発環境でマイグレーション作成・適用
npx prisma migrate dev --name add_user_table

# マイグレーション適用のみ
npx prisma migrate deploy

# マイグレーションリセット（開発環境のみ）
npx prisma migrate reset

# マイグレーション状態確認
npx prisma migrate status
```

### マイグレーション戦略
```typescript
// package.json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seed.ts",
    "db:setup": "npm run db:reset && npm run db:seed"
  }
}
```

### カスタムマイグレーション
```sql
-- prisma/migrations/20240101000000_custom_migration/migration.sql

-- カスタムインデックス作成
CREATE INDEX CONCURRENTLY idx_users_created_at 
ON users(created_at DESC);

-- パーティショニング
CREATE TABLE sessions_2024 PARTITION OF sessions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- カスタム関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## シード処理

### シードスクリプト
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 既存データのクリア
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // テストユーザーの作成
  const users = [
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
    },
    {
      name: 'Test User 1',
      email: 'user1@example.com',
      password: 'password123',
      role: 'user',
    },
    {
      name: 'Test User 2',
      email: 'user2@example.com',
      password: 'password123',
      role: 'user',
    },
  ];

  for (const userData of users) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        passwordHash: hashedPassword,
      },
    });

    console.log(`✅ Created user: ${user.email}`);
  }

  // その他のテストデータ作成
  await createTestGames();
  await createTestCharacters();

  console.log('✨ Seed completed!');
}

async function createTestGames() {
  // ゲームデータの作成
}

async function createTestCharacters() {
  // キャラクターデータの作成
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 環境別シード
```typescript
// prisma/seed.ts
const isDevelopment = process.env.NODE_ENV === 'development';
const isStaging = process.env.NODE_ENV === 'staging';

async function main() {
  if (isDevelopment) {
    await seedDevelopmentData();
  } else if (isStaging) {
    await seedStagingData();
  } else {
    await seedProductionData();
  }
}

async function seedDevelopmentData() {
  // 開発環境用の大量のテストデータ
  for (let i = 0; i < 100; i++) {
    await prisma.user.create({
      data: {
        name: `User ${i}`,
        email: `user${i}@example.com`,
        passwordHash: await bcrypt.hash('password', 10),
      },
    });
  }
}

async function seedStagingData() {
  // ステージング環境用の基本データ
}

async function seedProductionData() {
  // 本番環境用の最小限のマスターデータ
}
```

## クエリパターン

### 基本的なCRUD操作
```typescript
// Create
const user = await prisma.user.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: hashedPassword,
  },
});

// Read
const user = await prisma.user.findUnique({
  where: { id: 1 },
});

const users = await prisma.user.findMany({
  where: {
    role: 'user',
  },
});

// Update
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Jane Doe' },
});

// Delete
await prisma.user.delete({
  where: { id: 1 },
});
```

### 高度なクエリ
```typescript
// 複雑な条件
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: { contains: '@example.com' } },
      { name: { startsWith: 'John' } },
    ],
    AND: {
      createdAt: {
        gte: new Date('2024-01-01'),
      },
    },
    NOT: {
      role: 'admin',
    },
  },
});

// リレーションを含む取得
const userWithSessions = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    sessions: {
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    },
  },
});

// ネストしたリレーション
const userWithDeepRelations = await prisma.user.findMany({
  include: {
    posts: {
      include: {
        comments: {
          include: {
            author: true,
          },
        },
      },
    },
  },
});

// 集計
const stats = await prisma.user.aggregate({
  _count: true,
  _avg: {
    age: true,
  },
  _min: {
    createdAt: true,
  },
  _max: {
    createdAt: true,
  },
});

// グループ化
const usersByRole = await prisma.user.groupBy({
  by: ['role'],
  _count: {
    _all: true,
  },
  having: {
    role: {
      not: 'guest',
    },
  },
});
```

### ページネーション
```typescript
// カーソルベースページネーション（推奨）
async function getPaginatedUsers(cursor?: number, take: number = 10) {
  const users = await prisma.user.findMany({
    take: take + 1, // 次のページがあるか確認用に1つ多く取得
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: {
      id: 'asc',
    },
  });

  const hasNextPage = users.length > take;
  const items = hasNextPage ? users.slice(0, -1) : users;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasNextPage,
  };
}

// オフセットベースページネーション
async function getUsersPage(page: number = 1, pageSize: number = 10) {
  const skip = (page - 1) * pageSize;
  
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
```

## トランザクション

### 基本的なトランザクション
```typescript
// $transactionメソッド
const result = await prisma.$transaction(async (tx) => {
  // ユーザー作成
  const user = await tx.user.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: hashedPassword,
    },
  });

  // プロフィール作成
  const profile = await tx.profile.create({
    data: {
      userId: user.id,
      bio: 'Hello world',
    },
  });

  // セッション作成
  const session = await tx.session.create({
    data: {
      userId: user.id,
      token: generateToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return { user, profile, session };
});
```

### インタラクティブトランザクション
```typescript
await prisma.$transaction(
  async (tx) => {
    // 条件付き処理
    const user = await tx.user.findUnique({
      where: { email: 'john@example.com' },
    });

    if (user) {
      throw new Error('User already exists');
    }

    // 複雑なビジネスロジック
    const newUser = await tx.user.create({
      data: userData,
    });

    // 外部APIの呼び出し
    const externalResult = await callExternalAPI(newUser);
    
    if (!externalResult.success) {
      throw new Error('External API failed');
    }

    // 追加のデータ更新
    await tx.user.update({
      where: { id: newUser.id },
      data: { externalId: externalResult.id },
    });

    return newUser;
  },
  {
    maxWait: 5000, // トランザクション開始までの最大待機時間
    timeout: 10000, // トランザクションの最大実行時間
    isolationLevel: 'Serializable', // 分離レベル
  }
);
```

### バッチ処理
```typescript
// 複数の独立したクエリを並列実行
const [users, posts, comments] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.post.findMany(),
  prisma.comment.findMany(),
]);

// 大量データの一括作成
const users = Array.from({ length: 1000 }, (_, i) => ({
  name: `User ${i}`,
  email: `user${i}@example.com`,
  passwordHash: 'hashed',
}));

await prisma.user.createMany({
  data: users,
  skipDuplicates: true, // 重複をスキップ
});
```

## パフォーマンス最適化

### クエリ最適化
```typescript
// SELECT句の最適化（必要なフィールドのみ取得）
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // passwordHashは取得しない
  },
});

// N+1問題の回避（リレーションの事前ロード）
const posts = await prisma.post.findMany({
  include: {
    author: true, // JOINで一度に取得
    comments: true,
  },
});

// コネクションプーリング設定
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // コネクションプール設定
  // ?connection_limit=5&pool_timeout=2
});
```

### キャッシュ戦略
```typescript
// メモリキャッシュの実装
class CachedUserRepository implements IUserRepository {
  private cache = new Map<string, { user: User; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5分

  constructor(
    private readonly prismaRepo: PrismaUserRepository
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const cacheKey = `user:${id.value}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.user;
    }

    const user = await this.prismaRepo.findById(id);
    
    if (user) {
      this.cache.set(cacheKey, {
        user,
        timestamp: Date.now(),
      });
    }

    return user;
  }

  async save(user: User): Promise<void> {
    await this.prismaRepo.save(user);
    
    // キャッシュを無効化
    this.cache.delete(`user:${user.id.value}`);
  }
}
```

### インデックス戦略
```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  role      String
  createdAt DateTime @default(now()) @map("created_at")
  
  // 頻繁に使用されるクエリに対するインデックス
  @@index([email]) // WHERE email = ?
  @@index([role, createdAt(sort: Desc)]) // WHERE role = ? ORDER BY createdAt DESC
  @@index([name(ops: raw("gin_trgm_ops"))]) // 全文検索用（PostgreSQL）
  
  @@map("users")
}
```

## エラーハンドリング

### Prismaエラーの処理
```typescript
import { Prisma } from '@prisma/client';

async function createUser(data: CreateUserDto) {
  try {
    return await prisma.user.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // ユニーク制約違反
      if (error.code === 'P2002') {
        throw new UserAlreadyExistsError('Email already exists');
      }
      
      // 外部キー制約違反
      if (error.code === 'P2003') {
        throw new InvalidReferenceError('Invalid reference');
      }
      
      // レコードが見つからない
      if (error.code === 'P2025') {
        throw new NotFoundError('Record not found');
      }
    }
    
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new ValidationError('Invalid data provided');
    }
    
    throw error;
  }
}
```

### カスタムエラークラス
```typescript
// app/shared/errors/database.errors.ts
export class DatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(field: string) {
    super(`${field} already exists`, 'UNIQUE_CONSTRAINT');
    this.name = 'UniqueConstraintError';
  }
}

export class ForeignKeyError extends DatabaseError {
  constructor(message: string) {
    super(message, 'FOREIGN_KEY');
    this.name = 'ForeignKeyError';
  }
}

// リポジトリでの使用
async save(user: User): Promise<void> {
  try {
    await this.prisma.user.create({
      data: this.toPrisma(user),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const field = error.meta?.target as string[];
        throw new UniqueConstraintError(field?.[0] || 'field');
      }
    }
    throw new DatabaseError('Failed to save user');
  }
}
```

## テスト戦略

### テスト用データベース設定
```typescript
// prisma/test-setup.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // テスト用データベースURL
  const testDbUrl = process.env.DATABASE_URL?.replace(
    'nanika_game',
    'nanika_game_test'
  );
  
  process.env.DATABASE_URL = testDbUrl;
  
  // マイグレーション実行
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDbUrl },
  });
  
  return prisma;
}

export async function teardownTestDatabase() {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  await prisma.$disconnect();
}
```

### リポジトリのモック
```typescript
// テスト用インメモリリポジトリ
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<number, User> = new Map();
  private emailIndex: Map<string, number> = new Map();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.value) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const id = this.emailIndex.get(email.value);
    return id ? this.users.get(id) || null : null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
    this.emailIndex.set(user.email.value, user.id.value);
  }

  async delete(id: UserId): Promise<void> {
    const user = this.users.get(id.value);
    if (user) {
      this.emailIndex.delete(user.email.value);
      this.users.delete(id.value);
    }
  }

  // テスト用ヘルパー
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}
```

### 統合テスト
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository Integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaUserRepository;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    repository = new PrismaUserRepository(prisma);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // テーブルをクリア
    await prisma.user.deleteMany();
  });

  it('should save and retrieve a user', async () => {
    const user = createTestUser();
    
    await repository.save(user);
    
    const retrieved = await repository.findById(user.id);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.email.value).toBe(user.email.value);
  });

  it('should handle concurrent saves', async () => {
    const users = Array.from({ length: 10 }, createTestUser);
    
    await Promise.all(users.map(user => repository.save(user)));
    
    const saved = await prisma.user.count();
    expect(saved).toBe(10);
  });
});
```

## ベストプラクティス

### 1. ドメイン層の分離
```typescript
// ❌ 悪い例: Prismaモデルを直接使用
export class UserService {
  async getUser(id: number) {
    return await prisma.user.findUnique({ where: { id } });
  }
}

// ✅ 良い例: リポジトリパターンを通じてアクセス
export class UserService {
  constructor(private userRepository: IUserRepository) {}
  
  async getUser(id: UserId): Promise<User | null> {
    return await this.userRepository.findById(id);
  }
}
```

### 2. 明示的なエラーハンドリング
```typescript
// ✅ エラーを適切に変換
async save(user: User): Promise<void> {
  try {
    await this.prisma.user.create({ data });
  } catch (error) {
    // Prismaエラーをドメインエラーに変換
    if (this.isUniqueConstraintError(error)) {
      throw new UserAlreadyExistsError();
    }
    throw new RepositoryError('Failed to save user');
  }
}
```

### 3. トランザクション境界の明確化
```typescript
// ✅ ユースケース層でトランザクションを管理
export class CreateOrderUseCase {
  async execute(command: CreateOrderCommand): Promise<Order> {
    return await this.prisma.$transaction(async (tx) => {
      const order = await this.orderRepo.save(command.order, tx);
      await this.inventoryRepo.decreaseStock(command.items, tx);
      await this.paymentRepo.processPayment(command.payment, tx);
      return order;
    });
  }
}
```

### 4. 適切なインデックス設計
```prisma
// ✅ クエリパターンに基づいたインデックス
model User {
  // 頻繁に検索される項目
  @@index([email])
  @@index([role, isActive])
  
  // ソートが必要な項目
  @@index([createdAt(sort: Desc)])
}
```

### 5. N+1問題の回避
```typescript
// ❌ N+1問題が発生
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({
    where: { id: post.authorId }
  });
}

// ✅ includeで一度に取得
const posts = await prisma.post.findMany({
  include: { author: true }
});
```

## まとめ

Prismaを使用する際の重要なポイント：

1. **クリーンアーキテクチャ遵守**: リポジトリパターンでドメイン層を保護
2. **型安全性**: Prismaの型生成機能を最大限活用
3. **パフォーマンス**: 適切なインデックスとクエリ最適化
4. **エラーハンドリング**: Prismaエラーをドメインエラーに変換
5. **トランザクション**: ビジネスロジックの一貫性を保証
6. **テスト**: モックとテストデータベースを使い分け
7. **マイグレーション**: 環境別の適切な戦略

これらのパターンに従うことで、保守性が高く、スケーラブルなデータアクセス層を構築できます。