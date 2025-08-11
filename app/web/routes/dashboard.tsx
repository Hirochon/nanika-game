import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  // セッションCookieをチェック
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('nanika_game_user=')) {
    return redirect('/login');
  }

  // ユーザー情報を取得
  const sessionData = cookie.split('nanika_game_user=')[1]?.split(';')[0];
  if (!sessionData) {
    return redirect('/login');
  }

  try {
    const user = JSON.parse(decodeURIComponent(sessionData));
    return { user };
  } catch {
    return redirect('/login');
  }
}

export async function action({ request }: ActionFunctionArgs) {
  console.log('Logout action called with DDD architecture');

  // POSTメソッドのみ許可
  if (request.method !== 'POST') {
    throw new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // DDD Architecture imports
    const { container, TOKENS } = await import('@api/infrastructure/config/container');
    const { LogoutCommand } = await import('@api/application/commands/logout.command');
    const { LogoutUseCase } = await import('@api/application/use-cases/logout.use-case');

    // コマンドオブジェクト作成
    const logoutCommand = LogoutCommand.fromRequest(request);

    // ユースケース実行
    const logoutUseCase = container.resolve(TOKENS.LogoutUseCase) as InstanceType<
      typeof LogoutUseCase
    >;
    const result = await logoutUseCase.execute(logoutCommand);

    console.log('Logout result:', { success: result.success });

    // セッションCookieを削除してログイン画面にリダイレクト
    const logoutCookie = 'nanika_game_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

    return redirect('/login', {
      headers: {
        'Set-Cookie': logoutCookie,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);

    return {
      error: 'ログアウトに失敗しました。再度お試しください。',
    };
  }
}

export default function Dashboard() {
  const { user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  console.log('Dashboard レンダー:', { user });

  // ローディング状態の判定
  const isLoggingOut = navigation.state === 'submitting';

  if (!user) {
    return null; // loaderで既に認証チェック済み
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">こんにちは、{user.name}さん</span>
              <Form method="post">
                <button
                  type="submit"
                  disabled={isLoggingOut}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
                </button>
              </Form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 機能メニュー */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Link
              to="/chat"
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <title>チャット機能アイコン</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">チャット機能</dt>
                      <dd className="text-lg font-medium text-gray-900">リアルタイム会話</dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    他のユーザーとリアルタイムでチャットができます
                  </p>
                </div>
              </div>
            </Link>

            <div className="bg-white overflow-hidden shadow rounded-lg opacity-50">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <title>ゲーム機能アイコン</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">ゲーム機能</dt>
                      <dd className="text-lg font-medium text-gray-400">準備中...</dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">ゲーム機能は現在開発中です</p>
                </div>
              </div>
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">ユーザー情報</h2>

              <div className="bg-white p-6 rounded-lg shadow max-w-md mx-auto">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">ID:</span>
                    <span className="ml-2 text-gray-900">{user.id}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">名前:</span>
                    <span className="ml-2 text-gray-900">{user.name}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">メール:</span>
                    <span className="ml-2 text-gray-900">{user.email}</span>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-gray-600">ログイン機能が正常に動作しています！</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
