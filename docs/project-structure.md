# プロジェクト構成

## ディレクトリ構造

```
nanika-game/
├── app/                      # アプリケーションのメインコード
│   ├── application/          # アプリケーション層（UseCase、Command、Result）
│   │   ├── commands/        # コマンドオブジェクト
│   │   ├── results/         # 結果オブジェクト
│   │   └── use-cases/       # ユースケース実装
│   │
│   ├── domain/              # ドメイン層（ビジネスロジック）
│   │   ├── entities/        # エンティティ
│   │   ├── repositories/    # リポジトリインターフェース
│   │   ├── services/        # ドメインサービス
│   │   └── value-objects/   # 値オブジェクト
│   │
│   ├── infrastructure/      # インフラストラクチャ層（外部依存）
│   │   ├── config/          # 設定（DIコンテナ等）
│   │   └── persistence/     # 永続化層
│   │       └── repositories/ # リポジトリ実装
│   │
│   ├── routes/              # React Routerのルートコンポーネント
│   ├── shared/              # 共通コード
│   │   └── errors/          # エラークラス
│   └── utils/               # ユーティリティ関数
│
├── development-process/      # 開発プロセス文書
├── docs/                    # プロジェクトドキュメント
├── prisma/                  # Prismaスキーマとマイグレーション
├── public/                  # 静的ファイル
└── reports/                 # 分析レポート

```

## アーキテクチャ

このプロジェクトは **DDD（Domain-Driven Design）** と **Clean Architecture** の原則に従って構成されています。

### レイヤー構成

1. **ドメイン層** (`app/domain/`)
   - ビジネスロジックの中核
   - 外部依存なし
   - エンティティ、値オブジェクト、ドメインサービス

2. **アプリケーション層** (`app/application/`)
   - ユースケースの実装
   - ドメイン層を利用してビジネスロジックを実行
   - コマンド/リザルトパターン

3. **インフラストラクチャ層** (`app/infrastructure/`)
   - 外部システムとの接続
   - データベースアクセス（Prisma）
   - DIコンテナ設定（tsyringe）

4. **プレゼンテーション層** (`app/routes/`)
   - React Router v7のルートコンポーネント
   - UI/UXの実装

### 技術スタック

- **フレームワーク**: React Router v7 (SSR対応)
- **言語**: TypeScript
- **ORM**: Prisma
- **データベース**: PostgreSQL
- **DI**: tsyringe
- **認証**: bcrypt + セッション管理
- **テスト**: Vitest
- **リンター**: Biome

### 主要な設計パターン

- **Repository Pattern**: データアクセスの抽象化
- **Value Object Pattern**: ドメインの値を表現
- **Use Case Pattern**: ビジネスロジックの実行単位
- **Command Pattern**: ユースケースへの入力
- **Dependency Injection**: 依存関係の注入

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# リント実行
npm run lint

# フォーマット
npm run format

# データベースマイグレーション
npx prisma migrate dev
```