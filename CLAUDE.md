# Nanika Game - Claude協業ガイドライン

## 1. プロジェクト概要

このプロジェクトは、React RouterをフロントエンドフレームワークとしたWebアプリケーションです。
将来的にサーバーサイドを追加する際は、クリーンアーキテクチャとDDDの原則に基づいて実装します。

## 2. アーキテクチャ設計思想

### 基本原則
- **クリーンアーキテクチャ**: 関心事の分離を徹底し、依存関係の方向を常に内側（ドメイン）に向ける
- **依存性のルール**: 
  - ✅ OK: `application` → `domain`, `infrastructure` → `domain`
  - ❌ NG: `domain` → `application`, `domain` → `infrastructure`
- **テスト可能性**: すべてのビジネスロジックは独立してテスト可能に

## 3. ディレクトリ構造

### 現在の構造（フロントエンドのみ）
```
/
├── app/                    # React Router アプリケーション
│   ├── components/         # 共通コンポーネント
│   ├── routes/            # ページコンポーネント
│   ├── hooks/             # カスタムフック
│   ├── utils/             # ユーティリティ関数
│   ├── types/             # 型定義
│   ├── test/              # テスト関連
│   └── welcome/           # ウェルカム画面関連
├── public/                # 静的ファイル
├── .vscode/               # VSCode設定
└── 設定ファイル群
```

### 将来の構造（サーバーサイド追加時）
```
/
├── apps/
│   ├── web/               # 現在のappディレクトリの内容を移動
│   │   └── app/
│   │       ├── components/
│   │       ├── routes/
│   │       └── ...
│   └── api/               # バックエンドAPI (Express/NestJS等)
│       └── src/
│           ├── application/      # Usecase層
│           │   └── user.use-case.ts
│           ├── controllers/      # HTTPコントローラー
│           │   └── user.controller.ts
│           ├── infrastructure/   # インフラ層
│           │   ├── persistence/  # DB実装
│           │   └── services/     # 外部API
│           ├── dtos/            # Data Transfer Objects
│           ├── middlewares/      # ミドルウェア
│           ├── main.ts          # エントリーポイント
│           └── env.ts           # 環境変数定義
├── packages/
│   └── core/              # 共有コアロジック
│       └── src/
│           ├── domain/          # ドメイン層
│           │   ├── entities/    # エンティティ
│           │   ├── repositories/ # リポジトリI/F
│           │   ├── services/    # ドメインサービス
│           │   └── value-objects/ # 値オブジェクト
│           └── shared/          # 共有ユーティリティ
│               ├── errors/      # カスタムエラー
│               └── types/       # 共通型定義
└── oas/                   # OpenAPI仕様
```

## 4. コーディング規約

### 基本ルール
- **インデント**: スペース2つ
- **文字コード**: UTF-8
- **改行コード**: LF
- **セミコロン**: 必須
- **クォート**: シングルクォート優先

### TypeScript
- 型定義は必須（`any`型の使用禁止）
- 関数にはJSDocコメントを追加
- エラーハンドリングは必須
- 早期リターンを活用
- インターフェースは`I`プレフィックス（例: `IUserRepository`）
- 実装クラスは`Impl`サフィックス（例: `UserRepositoryImpl`）

### React
- 関数コンポーネントを使用
- カスタムフックは`use`プレフィックス
- propsには型定義を必須
- コンポーネントファイルはPascalCase

### テスト
- ファイル名: `.test.ts` または `.spec.ts`
- `describe`と`it`で構造化
- 正常系・異常系の両方をテスト
- モックは最小限に

### エラーハンドリング
- カスタムエラークラスを使用（`shared/errors`に定義）
- Usecase層とInfrastructure層でエラーをthrow
- Controller層でHTTPステータスコードに変換

## 5. 各レイヤーの責務

### Domain層（packages/core/src/domain）
- **entities**: ビジネスエンティティ（状態と振る舞い）
- **repositories**: データ永続化のインターフェース定義
- **services**: ドメインサービス
- **value-objects**: 値オブジェクト
- **ルール**: フレームワーク非依存、純粋なTypeScript

### Application層（apps/api/src/application）
- **責務**: ユースケースの実装
- **ルール**: 
  - DIによる依存性注入
  - フレームワーク固有オブジェクト（req, res）に依存しない
  - ドメインエンティティを利用してビジネスフローを構築

### Infrastructure層（apps/api/src/infrastructure）
- **persistence**: DB実装（Prisma, TypeORM等）
- **services**: 外部APIクライアント
- **責務**: リポジトリインターフェースの実装

### Controller層（apps/api/src/controllers）
- **責務**: HTTPリクエスト/レスポンスの処理
- **ルール**:
  - リクエストバリデーション
  - DTOを介したデータ受け渡し
  - ビジネスロジックを含まない

## 6. 新機能追加フロー

### フロントエンド機能
1. `app/routes/`に新しいページコンポーネントを追加
2. `app/routes.ts`にルーティングを追加
3. 必要に応じて`app/components/`に共通コンポーネントを追加
4. `app/utils/`または`app/hooks/`にロジックを実装
5. テストファイルを作成

### バックエンドAPI（将来）
1. `oas/`にAPI仕様を定義
2. `packages/core/src/domain/entities/`にエンティティを定義
3. `packages/core/src/domain/repositories/`にリポジトリI/Fを定義
4. `apps/api/src/application/`にUsecaseを実装
5. `apps/api/src/infrastructure/`にリポジトリ実装
6. `apps/api/src/controllers/`にコントローラーを実装
7. `apps/api/src/main.ts`でDIとルーティング設定

## 7. コミットメッセージ
- 日本語OK
- プレフィックスを使用:
  - `feat:` 新機能
  - `fix:` バグ修正
  - `refactor:` リファクタリング
  - `test:` テスト追加・修正
  - `docs:` ドキュメント更新
  - `style:` フォーマット修正
  - `chore:` その他の変更

## 8. 禁止事項
- console.logの本番コード残留
- コメントアウトされたコードの残留
- 未使用の変数・インポート
- マジックナンバーの直接使用
- any型の使用
- ビジネスロジックのController層への記述

## 9. 必須ツール
- **Biome**: フォーマッター・リンター
- **Vitest**: テスト
- **TypeScript**: 型チェック
- **React Router**: フロントエンドフレームワーク

## 10. 開発前チェックリスト
- [ ] `npm run format` でフォーマット
- [ ] `npm run lint` でリントチェック  
- [ ] `npm run typecheck` で型チェック
- [ ] `npm run test` でテスト実行
- [ ] エラーハンドリングの実装確認
- [ ] 適切なレイヤーへの配置確認

---

以上のルールを遵守し、保守性とテスト可能性の高いコードを共に作り上げていきましょう。