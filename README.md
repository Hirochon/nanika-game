# Nanika Game

DDD（ドメイン駆動設計）とクリーンアーキテクチャに基づいたWebゲームアプリケーション

## 🚀 クイックスタート

### GitHub Codespaces環境での起動

```bash
# 環境の自動セットアップ（データベース起動、マイグレーション、シード投入、サーバー起動）
npm run setup

# フルセットアップ（依存関係のインストールを含む）
npm run setup:full
```

### 手動セットアップ

1. **依存関係のインストール**
```bash
npm install
```

2. **環境変数の設定**
```bash
cp .env.example .env
# 必要に応じて.envファイルを編集
```

3. **PostgreSQLデータベースの起動**
```bash
docker compose up -d postgres
```

4. **データベースのセットアップ**
```bash
# マイグレーションの実行
npm run db:migrate

# シードデータの投入
npm run db:seed

# または一括実行
npm run db:setup
```

5. **開発サーバーの起動**
```bash
npm run dev
```

## 📋 利用可能なコマンド

### 開発関連
- `npm run dev` - 開発サーバーの起動
- `npm run build` - プロダクションビルド
- `npm run preview` - ビルドしたアプリのプレビュー

### データベース関連
- `npm run db:migrate` - Prismaマイグレーションの実行
- `npm run db:seed` - シードデータの投入
- `npm run db:reset` - データベースのリセット（データ削除）
- `npm run db:setup` - リセット後にシードデータを投入

### コード品質
- `npm run format` - コードフォーマット（Biome）
- `npm run lint` - Lintチェック
- `npm run lint:fix` - Lint自動修正
- `npm run typecheck` - TypeScript型チェック
- `npm run test` - テスト実行

### セットアップ
- `npm run setup` - クイックセットアップ（DB起動・マイグレーション・シード・サーバー起動）
- `npm run setup:full` - フルセットアップ（依存関係インストール含む）

## 🌐 アクセスURL

- **開発サーバー**: http://localhost:5173
- **Prisma Studio**: http://localhost:5555
- **PostgreSQL**: localhost:5432

## 📝 テストアカウント

シードデータには以下のテストユーザーが含まれています：

| ロール | メールアドレス | パスワード |
|--------|---------------|------------|
| 管理者 | admin@example.com | admin123 |
| ユーザー1 | user1@example.com | password123 |
| ユーザー2 | user2@example.com | password123 |
| ゲスト | guest@example.com | guest123 |

## 🗄️ データベース確認方法

### 1. Prisma Studio（GUI）
```bash
npx prisma studio
```
ブラウザで http://localhost:5555 にアクセス

### 2. psqlコマンド（CLI）
```bash
# テーブル一覧
docker exec nanika-game-db psql -U nanika_user -d nanika_game -c "\dt"

# ユーザーデータ確認
docker exec nanika-game-db psql -U nanika_user -d nanika_game -c "SELECT * FROM users;"
```

### 3. スクリプト実行
```bash
npx tsx scripts/check-db.ts
```

## 🏗️ プロジェクト構成

```
/
├── app/                   # アプリケーションコード
│   ├── web/              # フロントエンド（React Router）
│   ├── api/              # バックエンドAPI（将来実装）
│   ├── domain/           # ドメイン層（共有）
│   └── shared/           # 共有ユーティリティ
├── prisma/               # Prismaスキーマとマイグレーション
│   ├── schema.prisma     # データベーススキーマ
│   └── seed.ts          # シードデータ
├── scripts/             # ユーティリティスクリプト
│   ├── setup.sh         # 環境セットアップスクリプト
│   └── check-db.ts      # DB確認スクリプト
├── docker-compose.yml   # Docker設定（PostgreSQL）
└── .env                 # 環境変数

```

## 🔧 トラブルシューティング

### ポートが既に使用されている場合
```bash
# 既存のプロセスを停止
lsof -ti:5173 | xargs kill -9  # Viteサーバー
lsof -ti:5432 | xargs kill -9  # PostgreSQL
lsof -ti:5555 | xargs kill -9  # Prisma Studio
```

### データベース接続エラーの場合
```bash
# Dockerコンテナの状態確認
docker ps

# データベースコンテナの再起動
docker compose restart postgres

# ログ確認
docker logs nanika-game-db
```

### 環境のクリーンアップ
```bash
# すべてのサービスを停止
docker compose down

# データボリュームも含めて削除（注意：データが消えます）
docker compose down -v
```

## 📚 詳細ドキュメント

- [アーキテクチャ設計](/.claude/01_development_docs/01_architecture_design.md)
- [開発ガイドライン](/CLAUDE.md)
- [プロジェクト要件](/.claude/00_project/01_nanika_concept_requirements.md)