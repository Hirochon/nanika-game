# React Router v7 パターン集

## 概要
このドキュメントは、React Router v7を使用したNanika Gameプロジェクトにおけるルーティングパターンとベストプラクティスを定義します。

## 目次
1. [基本構造](#基本構造)
2. [ローダーパターン](#ローダーパターン)
3. [アクションパターン](#アクションパターン)
4. [エラーバウンダリー](#エラーバウンダリー)
5. [認証ガード](#認証ガード)
6. [ナビゲーションパターン](#ナビゲーションパターン)
7. [型安全性](#型安全性)

## 基本構造

### ルート定義（app/routes.ts）
```typescript
import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('web/routes/home.tsx'),           // ホームページ（/）
  route('login', 'web/routes/login.tsx'), // ログインページ（/login）
  route('register', 'web/routes/register.tsx'), // 登録ページ（/register）
  route('dashboard', 'web/routes/dashboard.tsx'), // ダッシュボード（/dashboard）
] satisfies RouteConfig;
```

### ルートファイル構造
各ルートファイルは以下の構造を持ちます：
- `loader`: データ取得（GET）
- `action`: データ更新（POST/PUT/DELETE）
- `Component`: UIコンポーネント
- `ErrorBoundary`: エラー処理（オプション）

## ローダーパターン

### 基本的なローダー
```typescript
import { type LoaderFunctionArgs, json } from 'react-router';

export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. 認証チェック
  const cookie = request.headers.get('Cookie');
  if (!cookie?.includes('nanika_game_user=')) {
    throw redirect('/login');
  }

  // 2. データ取得
  const data = await fetchData(params.id);
  
  // 3. データ返却
  return json({ data });
}
```

### 認証付きローダー
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  // 既にログイン済みの場合はダッシュボードにリダイレクト
  const cookie = request.headers.get('Cookie');
  if (cookie?.includes('nanika_game_user=')) {
    return redirect('/dashboard');
  }
  return null;
}
```

### パラレルデータ取得
```typescript
export async function loader({ params }: LoaderFunctionArgs) {
  // 複数のデータを並列で取得
  const [user, games, characters] = await Promise.all([
    getUserById(params.userId),
    getGamesByUserId(params.userId),
    getCharactersByUserId(params.userId),
  ]);

  return json({ user, games, characters });
}
```

## アクションパターン

### フォーム処理の基本パターン
```typescript
import { type ActionFunctionArgs, redirect } from 'react-router';

export async function action({ request }: ActionFunctionArgs) {
  // 1. フォームデータ取得
  const formData = await request.formData();
  
  // 2. バリデーション
  const validation = validateFormData(formData);
  if (!validation.isValid) {
    return json({ errors: validation.errors }, { status: 400 });
  }
  
  // 3. ビジネスロジック実行（DDD）
  try {
    const command = CreateCommand.fromFormData(formData);
    const useCase = container.resolve(TOKENS.CreateUseCase);
    const result = await useCase.execute(command);
    
    // 4. 成功時のリダイレクト
    return redirect('/success');
  } catch (error) {
    // 5. エラーハンドリング
    return json({ error: error.message }, { status: 500 });
  }
}
```

### ログイン処理の実装例
```typescript
export async function action({ request }: ActionFunctionArgs) {
  // DDD Architecture imports
  const { container, TOKENS } = await import('@api/infrastructure/config/container');
  const { LoginCommand } = await import('@api/application/commands/login.command');
  const { LoginUseCase } = await import('@api/application/use-cases/login.use-case');

  const formData = await request.formData();

  // バリデーション
  const validation = validateLoginForm({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (!validation.isValid) {
    return { errors: validation.errors };
  }

  // 認証処理
  try {
    const loginCommand = LoginCommand.fromFormData(formData);
    const loginUseCase = container.resolve(TOKENS.LoginUseCase);
    const result = await loginUseCase.execute(loginCommand);

    if (result.success) {
      // Cookieヘッダーを設定してリダイレクト
      return redirect('/dashboard', {
        headers: {
          'Set-Cookie': `nanika_game_user=${result.session.token}; Path=/; HttpOnly; SameSite=Strict`,
        },
      });
    }
    
    return { error: 'ログインに失敗しました' };
  } catch (error) {
    return { error: error.message };
  }
}
```

## エラーバウンダリー

### 基本的なエラーバウンダリー
```typescript
import { useRouteError, isRouteErrorResponse } from 'react-router';

export function ErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    return (
      <div className="error-container">
        <h1>{error.status} {error.statusText}</h1>
        {error.data?.message && <p>{error.data.message}</p>}
      </div>
    );
  }
  
  if (error instanceof Error) {
    return (
      <div className="error-container">
        <h1>エラーが発生しました</h1>
        <p>{error.message}</p>
      </div>
    );
  }
  
  return <h1>不明なエラーが発生しました</h1>;
}
```

### カスタムエラー処理
```typescript
export function ErrorBoundary() {
  const error = useRouteError();
  
  // 認証エラーの場合
  if (error?.status === 401) {
    return <Navigate to="/login" />;
  }
  
  // 権限エラーの場合
  if (error?.status === 403) {
    return <ForbiddenError />;
  }
  
  // 404エラーの場合
  if (error?.status === 404) {
    return <NotFoundError />;
  }
  
  // その他のエラー
  return <GenericError error={error} />;
}
```

## 認証ガード

### 認証が必要なルートの保護
```typescript
// loader内での認証チェック
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  
  if (!session) {
    // ログインページにリダイレクト（元のURLを保持）
    const url = new URL(request.url);
    return redirect(`/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  
  // 認証済みユーザーのデータを取得
  const user = await getUserById(session.userId);
  return json({ user });
}
```

### ロールベースアクセス制御
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  
  if (!session) {
    throw redirect('/login');
  }
  
  const user = await getUserById(session.userId);
  
  // 管理者権限チェック
  if (user.role !== 'admin') {
    throw new Response('権限がありません', { status: 403 });
  }
  
  return json({ user });
}
```

## ナビゲーションパターン

### プログラマティックナビゲーション
```typescript
import { useNavigate } from 'react-router';

function MyComponent() {
  const navigate = useNavigate();
  
  const handleSuccess = () => {
    // 成功後にダッシュボードへ遷移
    navigate('/dashboard');
  };
  
  const handleCancel = () => {
    // 前のページに戻る
    navigate(-1);
  };
  
  return (
    <div>
      <button onClick={handleSuccess}>完了</button>
      <button onClick={handleCancel}>キャンセル</button>
    </div>
  );
}
```

### 条件付きリダイレクト
```typescript
import { Navigate } from 'react-router';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    // 未認証の場合はログインページへ
    return <Navigate to="/login" replace />;
  }
  
  return children;
}
```

### Linkコンポーネントの使用
```typescript
import { Link, NavLink } from 'react-router';

function Navigation() {
  return (
    <nav>
      {/* 基本的なリンク */}
      <Link to="/">ホーム</Link>
      
      {/* アクティブ状態のスタイリング */}
      <NavLink 
        to="/dashboard"
        className={({ isActive }) => 
          isActive ? 'active-link' : 'link'
        }
      >
        ダッシュボード
      </NavLink>
      
      {/* パラメータ付きリンク */}
      <Link to={`/users/${userId}`}>プロフィール</Link>
    </nav>
  );
}
```

## 型安全性

### ローダーデータの型定義
```typescript
import { useLoaderData } from 'react-router';

// ローダーの戻り値の型を定義
type LoaderData = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  games: Array<{
    id: string;
    title: string;
  }>;
};

export async function loader(): Promise<LoaderData> {
  // データ取得
  return {
    user: await getUser(),
    games: await getGames(),
  };
}

export default function Component() {
  // 型推論が効く
  const { user, games } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <h1>{user.name}</h1>
      <ul>
        {games.map(game => (
          <li key={game.id}>{game.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### アクションデータの型定義
```typescript
import { useActionData } from 'react-router';

type ActionData = {
  errors?: {
    email?: string;
    password?: string;
  };
  success?: boolean;
};

export async function action(): Promise<ActionData> {
  // フォーム処理
  return { success: true };
}

export default function Component() {
  const actionData = useActionData<typeof action>();
  
  return (
    <Form method="post">
      {actionData?.errors?.email && (
        <span className="error">{actionData.errors.email}</span>
      )}
      {/* フォームフィールド */}
    </Form>
  );
}
```

## フォーム処理のベストプラクティス

### Formコンポーネントの使用
```typescript
import { Form } from 'react-router';

export default function LoginForm() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  return (
    <Form method="post" className="login-form">
      <div className="form-group">
        <label htmlFor="email">メールアドレス</label>
        <input 
          type="email" 
          id="email" 
          name="email" 
          required 
          disabled={isSubmitting}
        />
        {actionData?.errors?.email && (
          <span className="error">{actionData.errors.email}</span>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor="password">パスワード</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          required 
          disabled={isSubmitting}
        />
        {actionData?.errors?.password && (
          <span className="error">{actionData.errors.password}</span>
        )}
      </div>
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'ログイン中...' : 'ログイン'}
      </button>
    </Form>
  );
}
```

### 楽観的UI更新
```typescript
import { useFetcher } from 'react-router';

function TodoItem({ todo }) {
  const fetcher = useFetcher();
  
  // 楽観的更新: 送信中は即座にUIを更新
  const isDeleting = fetcher.formData?.get('id') === todo.id;
  
  return (
    <li style={{ opacity: isDeleting ? 0.5 : 1 }}>
      {todo.title}
      <fetcher.Form method="post" action="/todos/delete">
        <input type="hidden" name="id" value={todo.id} />
        <button type="submit" disabled={isDeleting}>
          削除
        </button>
      </fetcher.Form>
    </li>
  );
}
```

## データのプリフェッチ

### リンクホバー時のプリフェッチ
```typescript
import { Link } from 'react-router';

function Navigation() {
  return (
    <nav>
      {/* ホバー時にデータをプリフェッチ */}
      <Link to="/dashboard" prefetch="intent">
        ダッシュボード
      </Link>
      
      {/* ビューポートに入ったらプリフェッチ */}
      <Link to="/profile" prefetch="viewport">
        プロフィール
      </Link>
      
      {/* レンダリング時に即座にプリフェッチ */}
      <Link to="/settings" prefetch="render">
        設定
      </Link>
    </nav>
  );
}
```

## メタデータ管理

### ページタイトルとメタタグの設定
```typescript
export const meta = () => {
  return [
    { title: 'ダッシュボード | Nanika Game' },
    { name: 'description', content: 'ゲームダッシュボード' },
    { property: 'og:title', content: 'Nanika Game Dashboard' },
  ];
};

export const links = () => {
  return [
    { rel: 'canonical', href: 'https://example.com/dashboard' },
  ];
};
```

## パフォーマンス最適化

### コード分割とLazy Loading
```typescript
import { lazy, Suspense } from 'react';

// 動的インポートによるコード分割
const HeavyComponent = lazy(() => import('./HeavyComponent'));

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### データキャッシュ戦略
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  // キャッシュヘッダーを設定
  const data = await fetchData();
  
  return json(data, {
    headers: {
      'Cache-Control': 'private, max-age=300', // 5分間キャッシュ
    },
  });
}
```

## 開発時のデバッグ

### ローダー/アクションのログ
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Loader called:', request.url);
  }
  
  const data = await fetchData();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Loader data:', data);
  }
  
  return json(data);
}
```

## まとめ

React Router v7を使用する際は以下の点に注意してください：

1. **サーバーサイド優先**: ローダーとアクションを活用してサーバーサイドでデータ処理を行う
2. **プログレッシブエンハンスメント**: JavaScriptが無効でも基本機能が動作するように設計
3. **型安全性**: TypeScriptの型推論を最大限活用
4. **エラーハンドリング**: 適切なエラーバウンダリーの実装
5. **パフォーマンス**: プリフェッチとキャッシュ戦略の活用

これらのパターンを適切に使用することで、保守性が高く、パフォーマンスの良いアプリケーションを構築できます。