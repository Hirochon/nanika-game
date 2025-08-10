# 開発環境セットアップ

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトの開発環境セットアップと開発ワークフローについて詳述します。GitHub Codespaces、Docker、ローカル開発環境それぞれにおける効率的なセットアップ手順と、開発者の生産性を最大化するワークフロー・ツール設定を提供します。

## 現在の実装状況

- **GitHub Codespaces**: 設定ファイル完備、自動セットアップスクリプト実装
- **Docker環境**: PostgreSQL、開発サーバーのコンテナ化対応
- **npm scripts**: 開発、テスト、ビルド、データベース管理コマンド整備
- **開発ツール**: Biome（フォーマット・リント）、Vitest（テスト）、TypeScript設定完了
- **自動セットアップ**: `npm run setup`コマンドでワンクリックセットアップ対応

## セットアップオプション

### 1. GitHub Codespaces（推奨）

**最も簡単で一貫性のある開発環境**

#### 利点
- ブラウザのみで完全な開発環境
- 自動的な依存関係のインストール
- 一貫した環境（OS、Node.js、DB等）
- チーム間での設定の統一性
- 即座に開発開始可能

#### セットアップ手順

1. **リポジトリをCodespacesで開く**
   ```bash
   # GitHubリポジトリページから「Code」→「Codespaces」→「Create codespace on main」
   ```

2. **自動セットアップの実行**
   ```bash
   # Codespaces起動時に自動実行される（通常3-5分）
   # .devcontainer/postCreateCommand.sh が実行される
   
   # 手動実行する場合
   npm run setup:full
   ```

3. **環境確認**
   ```bash
   # データベース接続確認
   npm run db:check
   
   # 開発サーバー起動
   npm run dev
   ```

4. **アクセス確認**
   - Codespaces内のブラウザプレビューまたは
   - 「PORTS」タブから3000番ポートを開く

### 2. ローカル開発環境

#### 必要な前提条件

**必須ソフトウェア:**
- Node.js 18.x以上（20.x推奨）
- npm 9.x以上
- Docker Desktop（PostgreSQL用）
- Git

**推奨ソフトウェア:**
- VS Code（拡張機能含む）
- Postman（API テスト用）

#### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/your-username/nanika-game.git
   cd nanika-game
   ```

2. **Node.js バージョン確認・インストール**
   ```bash
   # バージョン確認
   node --version  # v18.x以上
   npm --version   # v9.x以上
   
   # Node.jsインストール（必要に応じて）
   # https://nodejs.org/ からダウンロード
   # またはnvmを使用
   nvm install 20
   nvm use 20
   ```

3. **依存関係のインストール**
   ```bash
   # package.jsonの依存関係をインストール
   npm install
   ```

4. **データベースのセットアップ**
   ```bash
   # Docker Desktopが起動していることを確認
   
   # PostgreSQLコンテナを起動
   docker compose up -d postgres
   
   # データベースの初期化
   npm run db:setup
   
   # 接続確認
   npm run db:check
   ```

5. **環境変数の設定**
   ```bash
   # .envファイルの作成（存在しない場合）
   cp .env.example .env
   
   # .envファイルの内容確認・編集
   cat .env
   ```

   ```env
   # Database
   DATABASE_URL="postgresql://nanika_user:nanika_password@localhost:5432/nanika_game?schema=public"
   
   # Application
   NODE_ENV=development
   PORT=3000
   
   # Session（本番では強力な値に変更）
   SESSION_SECRET="development-secret-key"
   
   # External Services（将来使用）
   # REDIS_URL="redis://localhost:6379"
   # SMTP_URL="smtp://..."
   ```

6. **開発サーバーの起動**
   ```bash
   # 開発サーバー起動（ホットリロード対応）
   npm run dev
   
   # ブラウザで http://localhost:3000 を開く
   ```

## 開発ワークフロー

### 1. 日常的な開発フロー

#### 作業開始時
```bash
# 1. 最新のコードを取得
git pull origin main

# 2. 依存関係の更新確認
npm install

# 3. データベース最新状態に同期
npm run db:migrate

# 4. 開発サーバー起動
npm run dev
```

#### 開発中のコマンド

```bash
# コードの品質チェック（コミット前に実行）
npm run format     # コードフォーマット実行
npm run lint       # リント実行
npm run typecheck  # TypeScript型チェック
npm run test       # テスト実行

# データベース操作
npm run db:migrate     # マイグレーション実行
npm run db:seed        # テストデータ投入
npm run db:reset       # データベースリセット

# その他
npm run build      # プロダクションビルド
npm run preview    # ビルド結果のプレビュー
```

#### コミット前チェックリスト
```bash
# 必須: 全ての品質チェックをパス
npm run format && npm run lint && npm run typecheck && npm run test

# 確認事項
# □ 新しい機能のテストを作成・実行済み
# □ 関連ドキュメントを更新済み
# □ console.logなどのデバッグコードを削除済み
# □ .envに機密情報を含めていない
```

### 2. 機能開発のワークフロー

#### 新機能開発（TDD）

```bash
# 1. 仕様書作成
# .claude/00_project/docs/新機能名-spec.md を作成

# 2. 開発プロセス文書作成
# .claude/00_project/development-process/新機能名-process.md を作成

# 3. テストファイル作成
# app/domain/entities/新機能.entity.test.ts
# app/application/use-cases/新機能.use-case.test.ts

# 4. テスト失敗確認
npm run test -- --run 新機能

# 5. 実装
# app/domain/ → app/application/ → app/infrastructure/ → app/web/ の順

# 6. テスト成功確認
npm run test

# 7. 品質チェック
npm run format && npm run lint && npm run typecheck
```

#### データベーススキーマ変更

```bash
# 1. schema.prismaを編集

# 2. マイグレーションファイル生成
npx prisma migrate dev --name 変更内容の説明

# 3. 型定義の再生成
npx prisma generate

# 4. シードデータの更新（必要に応じて）
# prisma/seed.ts を編集

# 5. テスト・確認
npm run db:reset
npm run test
```

## 開発ツール設定

### 1. Visual Studio Code

#### 必須拡張機能

```json
// .vscode/extensions.json
{
  "recommendations": [
    // 言語サポート
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    
    // フォーマット・リント
    "biomejs.biome",
    
    // データベース
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    
    // 開発支援
    "ms-vscode.vscode-eslint",
    "streetsidesoftware.code-spell-checker",
    "gruntfuggly.todo-tree",
    
    // Git
    "eamodio.gitlens",
    
    // テスト
    "vitest.explorer",
    
    // Docker
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### VS Code設定

```json
// .vscode/settings.json
{
  // フォーマッター設定
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit"
  },

  // TypeScript設定
  "typescript.preferences.noSemanticsValidation": false,
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  
  // Tailwind CSS
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],

  // ファイル除外
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  },

  // 検索除外
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true
  },

  // その他
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true,
  "files.trimTrailingWhitespace": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true
}
```

#### デバッグ設定

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/remix",
      "args": ["dev"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["--run"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 2. Git設定

#### .gitignore
```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/

# Environment variables
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.lcov

# Testing
.vitest/

# IDE
.vscode/settings.local.json
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Local configuration
.claude/settings.local.json
config/local.json
```

#### Git hooks（将来実装）

```bash
# pre-commit hook例（.husky/pre-commit）
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run format && npm run lint && npm run typecheck && npm run test
```

## Docker設定

### 1. 開発用Docker設定

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: nanika-game-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: nanika_user
      POSTGRES_PASSWORD: nanika_password
      POSTGRES_DB: nanika_game
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nanika_user -d nanika_game"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis（将来のキャッシュ・セッション用）
  redis:
    image: redis:7-alpine
    container_name: nanika-game-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # 開発環境アプリ（任意）
  app:
    build: 
      context: .
      dockerfile: Dockerfile.dev
    container_name: nanika-game-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://nanika_user:nanika_password@postgres:5432/nanika_game
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

### 2. 開発用Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci

# アプリケーションファイルをコピー
COPY . .

# Prismaクライアント生成
RUN npx prisma generate

# ポート公開
EXPOSE 3000

# 開発サーバー起動
CMD ["npm", "run", "dev"]
```

## 自動化スクリプト

### 1. セットアップスクリプト

```bash
#!/bin/bash
# scripts/setup.sh

set -e  # エラー時に停止

echo "🚀 Nanika Game セットアップを開始します..."

# フラグの解析
FULL_SETUP=false
if [[ "$1" == "--full" ]]; then
  FULL_SETUP=true
fi

# 依存関係のインストール（フルセットアップ時のみ）
if [[ "$FULL_SETUP" == true ]]; then
  echo "📦 依存関係をインストール中..."
  npm ci
fi

# 環境変数ファイルの作成
if [ ! -f .env ]; then
  echo "📝 .envファイルを作成中..."
  cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://nanika_user:nanika_password@localhost:5432/nanika_game?schema=public"

# Application
NODE_ENV=development
PORT=3000
SESSION_SECRET="development-secret-change-in-production"

# Logging
LOG_LEVEL=info

# Feature Flags
ENABLE_DEBUG_MODE=true
EOF
  echo "✅ .envファイルを作成しました"
else
  echo "✅ .envファイルは既に存在します"
fi

# PostgreSQLの起動確認・起動
echo "🐘 PostgreSQL を起動中..."
if ! docker compose ps postgres | grep -q "Up"; then
  docker compose up -d postgres
  echo "⏳ PostgreSQL の起動を待機中..."
  sleep 10
fi

# データベースのセットアップ
echo "💾 データベースをセットアップ中..."
npm run db:migrate
npm run db:seed

# 接続テスト
echo "🔌 データベース接続をテスト中..."
npm run db:check

# 型生成
echo "⚡ TypeScript 型を生成中..."
npx prisma generate

echo ""
echo "🎉 セットアップが完了しました！"
echo ""
echo "次のコマンドで開発サーバーを起動できます:"
echo "  npm run dev"
echo ""
echo "その他の利用可能なコマンド:"
echo "  npm run test      # テスト実行"
echo "  npm run format    # コードフォーマット"
echo "  npm run lint      # リンター実行"
echo "  npm run typecheck # 型チェック"
echo ""
```

### 2. データベース確認スクリプト

```typescript
// scripts/check-db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔌 データベース接続を確認中...');
    
    // 接続テスト
    await prisma.$connect();
    console.log('✅ データベース接続成功');
    
    // テーブル存在確認
    const userCount = await prisma.user.count();
    const sessionCount = await prisma.session.count();
    
    console.log(`📊 データベース状態:`);
    console.log(`  - ユーザー: ${userCount}件`);
    console.log(`  - セッション: ${sessionCount}件`);
    
    // サンプルクエリ実行
    const recentUsers = await prisma.user.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    
    if (recentUsers.length > 0) {
      console.log(`🔍 最近のユーザー:`);
      recentUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email})`);
      });
    }
    
    console.log('✅ データベースチェック完了');
    
  } catch (error) {
    console.error('❌ データベース接続エラー:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー
```bash
# 問題: "connection refused" エラー
# 解決策:
docker compose ps postgres  # PostgreSQL起動確認
docker compose up -d postgres  # 未起動の場合起動
docker compose logs postgres  # ログ確認
```

#### 2. ポート競合エラー
```bash
# 問題: "Port 3000 is already in use"
# 解決策:
lsof -ti:3000 | xargs kill -9  # プロセス強制終了（Mac/Linux）
# または
netstat -ano | findstr :3000  # プロセス確認（Windows）
taskkill /PID <PID> /F  # プロセス終了（Windows）
```

#### 3. npm installの問題
```bash
# 問題: 依存関係エラー
# 解決策:
rm -rf node_modules package-lock.json  # キャッシュクリア
npm cache clean --force
npm install
```

#### 4. TypeScriptエラー
```bash
# 問題: 型エラーが発生
# 解決策:
npx prisma generate  # Prisma型再生成
rm -rf node_modules/@types  # 型定義リセット
npm install
npm run typecheck  # 型チェック実行
```

#### 5. テスト失敗
```bash
# 問題: テストが通らない
# 解決策:
npm run db:reset  # テスト用DBリセット
npm run test -- --reporter=verbose  # 詳細ログ付きテスト
npm run test -- --run --coverage  # カバレッジ付きテスト
```

## パフォーマンス最適化

### 1. 開発サーバーの最適化

```typescript
// vite.config.ts（React Router v7用設定）
import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
    host: true, // Codespacesで外部アクセス許可
    hmr: {
      port: 3001, // HMR用ポート
    },
  },
  build: {
    sourcemap: true, // デバッグ用ソースマップ
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@react-router/react'],
          utils: ['date-fns', 'lodash-es'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@react-router/react'],
  },
});
```

### 2. データベースパフォーマンス

```typescript
// prisma/schema.prismaの最適化設定
generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]  // Docker対応
  previewFeatures = ["relationJoins", "omitApi"]  // パフォーマンス機能有効化
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // 接続プール設定
  // ?connection_limit=10&pool_timeout=20&socket_timeout=20
}
```

## セキュリティ設定

### 1. 環境変数の管理

```bash
# .env.example（テンプレート）
# データベース設定
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# アプリケーション設定
NODE_ENV="development"
PORT=3000

# セッション設定（本番では強力なキーを使用）
SESSION_SECRET="change-this-in-production-min-32-chars"

# ログ設定
LOG_LEVEL="info"

# 機能フラグ
ENABLE_DEBUG_MODE="true"
ENABLE_API_DOCS="true"

# 外部サービス（使用時のみ設定）
# REDIS_URL="redis://localhost:6379"
# SMTP_HOST=""
# SMTP_PORT=""
# SMTP_USER=""
# SMTP_PASS=""

# 本番環境のみ
# SSL_CERT_PATH=""
# SSL_KEY_PATH=""
```

### 2. セキュリティチェックリスト

**開発環境:**
- [ ] .envファイルが.gitignoreに含まれている
- [ ] デフォルトパスワードを使用していない
- [ ] 開発用秘密鍵を本番で使用していない
- [ ] デバッグ情報を本番で無効化している

**本番環境（将来）:**
- [ ] 強力なランダムSESSION_SECRETを使用
- [ ] HTTPS強制設定
- [ ] セキュリティヘッダー設定
- [ ] レート制限設定
- [ ] SQLインジェクション対策

## 今後の拡張計画

### Phase 1: 基本開発環境の強化（3ヶ月）
1. **自動化の拡張**: pre-commit hooks、自動テスト実行
2. **監視ツール**: 開発環境でのパフォーマンス監視
3. **ドキュメント生成**: 自動API ドキュメント生成
4. **デバッグ支援**: 詳細なログ・トレース機能

### Phase 2: CI/CD統合（6ヶ月）
1. **GitHub Actions**: 自動ビルド・テスト・デプロイ
2. **品質ゲート**: カバレッジ・品質基準の自動チェック
3. **ステージング環境**: 本番に近い環境でのテスト
4. **依存関係管理**: 自動更新・セキュリティチェック

### Phase 3: 運用環境対応（12ヶ月）
1. **本番環境**: スケーラブルな本番デプロイ環境
2. **監視・アラート**: 本格的な監視システム統合
3. **バックアップ・復旧**: 自動バックアップ・災害対策
4. **マイクロサービス**: 機能別サービス分割対応

## まとめ

本開発環境セットアップは、GitHub Codespacesによるクラウド開発からローカル環境まで、開発者の多様なニーズに対応した包括的な開発基盤を提供します。自動化されたセットアップスクリプトとTDDワークフローにより、開発者は環境構築に時間を費やすことなく、即座に機能開発に集中できる環境を実現しています。

継続的な改善とツールの最適化により、開発者体験の向上と生産性の最大化を目指し、高品質なゲームアプリケーションの開発を支援します。