import { useState } from 'react';
import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
} from 'react-router';
import { type LoginFormData, validateLoginForm } from '~/web/utils/validation';

export async function loader({ request }: LoaderFunctionArgs) {
  // 既にログイン済みの場合はダッシュボードにリダイレクト
  const cookie = request.headers.get('Cookie');
  if (cookie?.includes('nanika_game_user=')) {
    return redirect('/dashboard');
  }
  return null;
}

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
    // コマンドオブジェクト作成
    const loginCommand = LoginCommand.fromFormData(formData);

    // ユースケース実行
    const loginUseCase = container.resolve(TOKENS.LoginUseCase) as InstanceType<
      typeof LoginUseCase
    >;
    const result = await loginUseCase.execute(loginCommand);

    if (result.success && result.user && result.session) {
      // セッションCookieを設定してダッシュボードにリダイレクト
      const sessionCookie = `nanika_game_user=${encodeURIComponent(JSON.stringify(result.userData))}; Path=/; HttpOnly; SameSite=Lax`;

      return redirect('/dashboard', {
        headers: {
          'Set-Cookie': sessionCookie,
        },
      });
    } else {
      return { error: result.error || 'ログインに失敗しました' };
    }
  } catch (_error) {
    return { error: 'ログインに失敗しました。再度お試しください。' };
  }
}

export default function Login() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const actionData = useActionData<typeof action>();

  // actionDataからエラーを取得
  const error = actionData?.error;
  const errors = actionData?.errors || {};

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">ログイン</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウントをお持ちでない方は{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              新規登録
            </Link>
          </p>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレスを入力してください"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="パスワードを入力してください"
                value={formData.password}
                onChange={handleChange}
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ログイン
            </button>
          </div>
        </Form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            テスト用アカウント:
            <br />
            メール: admin@example.com
            <br />
            パスワード: admin123
          </p>
        </div>
      </div>
    </div>
  );
}
