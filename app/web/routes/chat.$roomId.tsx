/**
 * 個別チャットルーム詳細ページ
 * 特定のチャットルームを直接開く際のページ
 */

import { type LoaderFunctionArgs, type MetaFunction, redirect, useLoaderData } from 'react-router';
import { ChatLayout } from '../components/chat/ChatLayout';
import type { User } from '../types/chat-types';

export const meta: MetaFunction<typeof loader> = ({ params }) => {
  const roomId = params.roomId;
  return [
    { title: `チャットルーム ${roomId} - Nanika Game` },
    { name: 'description', content: 'チャットルーム詳細画面' },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { roomId } = params;

  // ルームIDの基本バリデーション
  if (!roomId) {
    throw new Response('Room ID is required', { status: 400 });
  }

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

    // ユーザー情報の型チェック
    if (!user || typeof user.id !== 'number' || !user.name || !user.email) {
      return redirect('/login');
    }

    // チャットルームの存在チェック（API実装後に追加予定）
    // try {
    //   const response = await fetch(`/api/chat/rooms/${roomId}`, {
    //     headers: { Cookie: cookie },
    //   });
    //
    //   if (!response.ok) {
    //     throw new Response('Chat room not found', { status: 404 });
    //   }
    // } catch (error) {
    //   throw new Response('Chat room not found', { status: 404 });
    // }

    return {
      user,
      roomId,
      // 将来的にはチャットルーム情報も含める
      // room: roomData
    };
  } catch {
    return redirect('/login');
  }
}

export default function ChatRoom() {
  const { user, roomId } = useLoaderData<typeof loader>();

  return (
    <div className="h-screen">
      <ChatLayout user={user as User} initialRoomId={roomId} />
    </div>
  );
}
