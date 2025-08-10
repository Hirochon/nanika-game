# ユーザーログイン機能 仕様書

## 概要
ユーザーがWebアプリケーションにログインできる機能を提供する。
認証は**React Router v7のloader/actionパターン**を使用し、サーバーサイドでセッション管理を行う。

**実装方針**：開発段階では**Mock API**を使用し、本格運用時にPostgreSQLデータベースに移行する。

## 要件

### 機能要件
- ユーザーはメールアドレスとパスワードでログインできる
- ログイン成功時はダッシュボード画面に遷移する
- ログイン失敗時は適切なエラーメッセージを表示する
- ログイン状態を維持する（セッション管理）
- ログアウト機能を提供する
- 初回ユーザー向けのユーザー登録機能を提供する

### 非機能要件
- パスワードはbcryptでハッシュ化して保存する
- セッション情報はサーバーサイドで管理する
- CSRF攻撃を防ぐための対策を実装する
- ログイン試行回数制限（ブルートフォース攻撃対策）

## インターフェース

### 入力
- **ログイン画面**
  - email: string (必須, email形式)
  - password: string (必須, 8文字以上)

- **ユーザー登録画面**
  - name: string (必須, 2-50文字)
  - email: string (必須, email形式, ユニーク)
  - password: string (必須, 8文字以上)
  - confirmPassword: string (必須, passwordと一致)

### 出力
- **ログイン成功時**
  - HTTP 200 OK
  - user: { id, name, email }
  - ダッシュボード画面へリダイレクト

- **ログイン失敗時**
  - HTTP 401 Unauthorized
  - error: "メールアドレスまたはパスワードが正しくありません"

## データベーススキーマ

### usersテーブル
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### sessionsテーブル
```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## ビジネスルール

### バリデーション規則
1. **email**: 有効なメールアドレス形式
2. **password**: 最低8文字、英字（大文字・小文字）と数字を含む
3. **name**: 2-50文字、特殊文字は禁止

### セキュリティ規則
1. パスワードはbcrypt（rounds=12）でハッシュ化
2. セッションの有効期限は24時間
3. ログイン試行は同一IPから5回まで（15分間）
4. セッションIDは暗号学的に安全な乱数で生成

### 認証フロー（React Router v7パターン）
1. ユーザーがログインフォームを送信
2. **action関数**がサーバーサイドで認証処理を実行
3. Mock APIでメールアドレスとパスワードを検証
4. 認証成功時、ユーザー情報をHTTPOnlyクッキーに設定
5. **redirect**でダッシュボードにリダイレクト
6. ダッシュボードの**loader関数**がクッキーから認証状態をチェック
7. 未認証の場合は自動的にログイン画面にリダイレクト

### 現在の実装（開発段階）
**サーバーサイド処理**：
- `app/routes/login.tsx` - ログインaction/loader
- `app/routes/dashboard.tsx` - 認証チェックloader
- `app/utils/mock-auth.server.ts` - サーバーサイド認証API

**クライアントサイド**：
- React RouterのFormコンポーネント使用
- useActionDataでエラーハンドリング
- HTTPOnlyクッキーによるセッション管理

## エラーケース

### バリデーションエラー
- **E001**: メールアドレスが無効な形式
- **E002**: パスワードが8文字未満
- **E003**: 必須フィールドが未入力
- **E004**: パスワード確認が一致しない（登録時）

### 認証エラー
- **E101**: メールアドレスが存在しない
- **E102**: パスワードが不正
- **E103**: アカウントがロックされている
- **E104**: セッションが無効または期限切れ

### システムエラー
- **E201**: データベース接続エラー
- **E202**: セッション作成エラー
- **E203**: 内部サーバーエラー

## セキュリティ考慮事項
- SQLインジェクション対策（パラメータ化クエリ使用）
- XSS対策（入力値のサニタイズ）
- CSRF対策（CSRFトークン使用）
- セッションハイジャック対策（HttpOnly, Secure, SameSiteクッキー）
- ブルートフォース攻撃対策（ログイン試行回数制限）