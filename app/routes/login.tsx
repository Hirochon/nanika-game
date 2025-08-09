import { useState } from 'react';
import {
  Link,
  useNavigate,
  Form,
  useActionData,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import { validateLoginForm, type LoginFormData } from '~/utils/validation';

export async function loader({ request }: LoaderFunctionArgs) {
  // 既にログイン済みの場合はダッシュボードにリダイレクト
  const cookie = request.headers.get('Cookie');
  if (cookie && cookie.includes('nanika_game_user=')) {
    return redirect('/dashboard');
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const { mockAuthServerApi } = await import('~/utils/mock-auth.server');

  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  console.log('Server action called with:', { email, password });

  // バリデーション
  const validation = validateLoginForm({ email, password });
  if (!validation.isValid) {
    return { errors: validation.errors };
  }

  // 認証
  try {
    const result = await mockAuthServerApi.login({ email, password });
    console.log('Server login result:', result);

    if (result.success && result.user) {
      // セッションCookieを設定してダッシュボードにリダイレクト
      const sessionCookie = `nanika_game_user=${encodeURIComponent(JSON.stringify(result.user))}; Path=/; HttpOnly; SameSite=Lax`;

      return redirect('/dashboard', {
        headers: {
          'Set-Cookie': sessionCookie,
        },
      });
    } else {
      return { error: result.error || 'ログインに失敗しました' };
    }
  } catch (error) {
    console.error('Login error:', error);
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
          <p className="text-sm text-gray-600">テスト用アカウント: admin@example.com / Admin123</p>
        </div>
      </div>
    </div>
  );
}
