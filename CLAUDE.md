# Nanika Game - Claude協業ガイドライン

## 1. プロジェクト概要

このプロジェクトは、React RouterをフロントエンドフレームワークとしたWebアプリケーションです。
将来的にサーバーサイドを追加する際は、クリーンアーキテクチャとDDDの原則に基づいて実装します。

## 2. 【最重要】開発プロセス - 必ず遵守すること

### 開発の絶対ルール

**以下のプロセスは例外なく必ず守ること。これらのルールを破ることは許されません。**

1. **仕様書ファースト（Specification First）**
   - いかなる実装も仕様書なしに開始してはならない
   - 仕様書は`docs/`ディレクトリに作成すること
   - 仕様書のファイル名: `機能名-spec.md`

2. **開発プロセスの文書化**
   - 仕様書作成後、`development-process/`ディレクトリに実装計画を記述
   - ファイル名: `機能名-process.md`
   - 実装の各ステップを詳細に記載

3. **TDD（Test-Driven Development）の徹底**
   - development-processを基にテストを**先に**作成
   - テストが**失敗することを確認**してから実装開始
   - Red → Green → Refactorサイクルを厳守

4. **変更時のルール**
   - 修正が必要な場合は**必ず仕様書から修正**
   - 変更内容をdevelopment-processに記録
   - 仕様書 → development-process → テスト → 実装の順序を厳守

### 開発フロー（この順序は絶対）

```
1. docs/機能名-spec.md を作成
   ↓
2. development-process/機能名-process.md を作成
   ↓
3. テストコードを作成（*.test.ts）
   ↓
4. テストが失敗することを確認（npm run test）
   ↓
5. 実装コードを作成
   ↓
6. テストが成功することを確認
   ↓
7. リファクタリング（必要に応じて）
```

### 仕様書テンプレート（docs/機能名-spec.md）

```markdown
# [機能名] 仕様書

## 概要
機能の目的と概要を記述

## 要件
- 機能要件1
- 機能要件2

## インターフェース
入力と出力の定義

## ビジネスルール
ロジックとバリデーション規則

## エラーケース
想定されるエラーとその処理
```

### 開発プロセステンプレート（development-process/機能名-process.md）

```markdown
# [機能名] 開発プロセス

## 実装ステップ
1. [ ] ステップ1の詳細
2. [ ] ステップ2の詳細

## テストケース
- [ ] 正常系テスト1
- [ ] 異常系テスト1

## 変更履歴
- YYYY-MM-DD: 変更内容
```

## 3. アーキテクチャ設計思想

### 基本原則
- **クリーンアーキテクチャ**: 関心事の分離を徹底し、依存関係の方向を常に内側（ドメイン）に向ける
- **依存性のルール**: 
  - ✅ OK: `application` → `domain`, `infrastructure` → `domain`
  - ❌ NG: `domain` → `application`, `domain` → `infrastructure`
- **テスト可能性**: すべてのビジネスロジックは独立してテスト可能に
- **TDD**: テスト駆動開発を必須とする

## 4. ディレクトリ構造

### 現在の構造（フロントエンドのみ）
```
/
├── docs/                  # 仕様書（必須）
│   └── 機能名-spec.md
├── development-process/    # 開発プロセス記録（必須）
│   └── 機能名-process.md
├── app/                   # React Router アプリケーション
│   ├── components/        # 共通コンポーネント
│   ├── routes/           # ページコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── utils/            # ユーティリティ関数
│   ├── types/            # 型定義
│   ├── test/             # テスト関連
│   └── welcome/          # ウェルカム画面関連
├── public/               # 静的ファイル
├── .vscode/              # VSCode設定
└── 設定ファイル群
```

### 将来の構造（サーバーサイド追加時）
```
/
├── docs/                  # 仕様書（必須）
│   ├── api/              # APIサーバー仕様
│   └── web/              # ウェブアプリ仕様
├── development-process/   # 開発プロセス記録（必須）
│   ├── api/              # APIサーバー開発記録
│   └── web/              # ウェブアプリ開発記録
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

## 5. コーディング規約

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

## 6. 各レイヤーの責務

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

## 7. 新機能追加フロー

### フロントエンド機能（この順序を厳守）
1. `docs/機能名-spec.md` で仕様書を作成
2. `development-process/機能名-process.md` で実装プロセスを記録
3. テストファイルを作成（`*.test.ts`）
4. テストが失敗することを確認
5. `app/routes.ts`にルーティングを追加（必要に応じて）
6. `app/routes/`にページコンポーネントを実装
7. `app/components/`に共通コンポーネントを実装（必要に応じて）
8. `app/utils/`または`app/hooks/`にロジックを実装
9. テストが成功することを確認
10. リファクタリング（必要に応じて）

### バックエンドAPI（将来・この順序を厳守）
1. `docs/api/機能名-spec.md` で仕様書を作成
2. `development-process/api/機能名-process.md` で実装プロセスを記録
3. `oas/`にOpenAPI仕様を定義
4. テストファイルを作成（各レイヤー毎に）
5. テストが失敗することを確認
6. `packages/core/src/domain/entities/`にエンティティを定義
7. `packages/core/src/domain/repositories/`にリポジトリI/Fを定義
8. `apps/api/src/application/`にUsecaseを実装
9. `apps/api/src/infrastructure/`にリポジトリ実装
10. `apps/api/src/controllers/`にコントローラーを実装
11. `apps/api/src/main.ts`でDIとルーティング設定
12. テストが成功することを確認
13. リファクタリング（必要に応じて）

## 8. コミットメッセージ
- 日本語OK
- プレフィックスを使用:
  - `feat:` 新機能
  - `fix:` バグ修正
  - `refactor:` リファクタリング
  - `test:` テスト追加・修正
  - `docs:` ドキュメント更新
  - `style:` フォーマット修正
  - `chore:` その他の変更

## 9. 禁止事項

### 🚨 開発プロセス違反（最重要）
- **仕様書なしでの実装開始**（絶対禁止）
- **テストなしでの実装開始**（絶対禁止）
- **仕様変更時に仕様書を更新しないこと**（絶対禁止）
- **development-processの記録を怠ること**（絶対禁止）

### コード品質違反
- console.logの本番コード残留
- コメントアウトされたコードの残留
- 未使用の変数・インポート
- マジックナンバーの直接使用
- any型の使用
- ビジネスロジックのController層への記述

## 10. 必須ツール
- **Biome**: フォーマッター・リンター
- **Vitest**: テスト
- **TypeScript**: 型チェック
- **React Router**: フロントエンドフレームワーク

## 11. 開発前チェックリスト

### 🔥 開発プロセス確認（必須）
- [ ] `docs/機能名-spec.md` が作成済み
- [ ] `development-process/機能名-process.md` が作成済み
- [ ] テストファイルが作成済み
- [ ] テストが失敗することを確認済み

### コード品質確認
- [ ] `npm run format` でフォーマット
- [ ] `npm run lint` でリントチェック  
- [ ] `npm run typecheck` で型チェック
- [ ] `npm run test` でテスト実行
- [ ] エラーハンドリングの実装確認
- [ ] 適切なレイヤーへの配置確認

---

以上のルールを遵守し、保守性とテスト可能性の高いコードを共に作り上げていきましょう。