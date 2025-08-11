/**
 * 新規チャット作成ページ
 * チャット作成用の専用ページ（モーダルの代替）
 */

import React, { useState } from 'react';
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useChatRoomCreation, useUserSearch } from '../hooks/useSocket';
import type { User } from '../types/chat-types';
import { debounce } from '../utils/chat-utils';

export const meta: MetaFunction = () => {
  return [
    { title: '新規チャット作成 - Nanika Game' },
    { name: 'description', content: '新しいチャットルームの作成' },
  ];
};

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

    if (!user || typeof user.id !== 'number' || !user.name || !user.email) {
      return redirect('/login');
    }

    return { user };
  } catch {
    return redirect('/login');
  }
}

export default function NewChat() {
  const { user } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { searchUsers } = useUserSearch();
  const { createDirectChat, createGroupChat } = useChatRoomCreation();

  // 検索のデバウンス処理
  const debouncedSearch = React.useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsers(query);
        const filteredResults = results.filter((u: User) => u.id !== user.id);
        setSearchResults(filteredResults);
      } catch (error) {
        console.error('User search failed:', error);
        setError('ユーザー検索に失敗しました');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  React.useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleUserSelect = (selectedUser: User) => {
    if (chatType === 'direct') {
      setSelectedUsers([selectedUser]);
    } else {
      const isAlreadySelected = selectedUsers.some((u) => u.id === selectedUser.id);
      if (isAlreadySelected) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== selectedUser.id));
      } else {
        setSelectedUsers([...selectedUsers, selectedUser]);
      }
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      setError('ユーザーを選択してください');
      return;
    }

    if (chatType === 'group' && !groupName.trim()) {
      setError('グループ名を入力してください');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      let roomId: string;

      if (chatType === 'direct') {
        console.log('[NewChat] Creating direct chat with user:', selectedUsers[0].id);
        roomId = await createDirectChat(selectedUsers[0].id);
      } else {
        const memberIds = selectedUsers.map((u) => u.id);
        console.log('[NewChat] Creating group chat with members:', memberIds);
        roomId = await createGroupChat(groupName.trim(), memberIds);
      }

      console.log('[NewChat] Chat room created with ID:', roomId);
      // チャットルームに移動
      console.log('[NewChat] Navigating to:', `/chat/${roomId}`);
      navigate(`/chat/${roomId}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
      setError('チャットルームの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    navigate('/chat');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center text-indigo-600 hover:text-indigo-500 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>戻るアイコン</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            チャットに戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">新規チャット作成</h1>
          <p className="mt-2 text-gray-600">新しいチャットルームを作成して会話を始めましょう</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-6 space-y-6">
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* チャット種別選択 */}
            <div>
              <label className="text-base font-medium text-gray-900">チャットの種類</label>
              <p className="text-sm leading-5 text-gray-500 mb-4">
                作成するチャットの種類を選択してください
              </p>
              <div className="space-y-4">
                <label className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="radio"
                      name="chatType"
                      value="direct"
                      checked={chatType === 'direct'}
                      onChange={(e) => setChatType(e.target.value as 'direct')}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <div className="font-medium text-gray-900">1対1チャット</div>
                    <div className="text-gray-500">特定のユーザーと直接会話する</div>
                  </div>
                </label>

                <label className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="radio"
                      name="chatType"
                      value="group"
                      checked={chatType === 'group'}
                      onChange={(e) => setChatType(e.target.value as 'group')}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <div className="font-medium text-gray-900">グループチャット</div>
                    <div className="text-gray-500">複数のユーザーでグループを作成する</div>
                  </div>
                </label>
              </div>
            </div>

            {/* グループ名入力 */}
            {chatType === 'group' && (
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                  グループ名
                </label>
                <Input
                  id="groupName"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="例：プロジェクトチーム、友達グループ"
                  fullWidth
                />
              </div>
            )}

            {/* ユーザー検索 */}
            <div>
              <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 mb-1">
                ユーザーを検索して{chatType === 'direct' ? '選択' : '追加'}
              </label>
              <div className="relative">
                <Input
                  id="userSearch"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ユーザー名またはメールアドレス"
                  fullWidth
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <svg
                      className="animate-spin h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* 選択されたユーザー */}
            {selectedUsers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  選択されたユーザー ({selectedUsers.length}人)
                </p>
                <div className="space-y-2">
                  {selectedUsers.map((selectedUser) => (
                    <div
                      key={selectedUser.id}
                      className="flex items-center justify-between p-3 bg-indigo-50 rounded-md"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar name={selectedUser.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{selectedUser.name}</p>
                          <p className="text-sm text-gray-500">{selectedUser.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUserSelect(selectedUser)}
                        className="text-indigo-600 hover:text-indigo-800 p-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 検索結果 */}
            {searchResults.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  検索結果 ({searchResults.length}件)
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((searchUser) => {
                    const isSelected = selectedUsers.some((u) => u.id === searchUser.id);
                    return (
                      <button
                        key={searchUser.id}
                        onClick={() => handleUserSelect(searchUser)}
                        className={`w-full flex items-center space-x-3 p-3 rounded-md text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isSelected
                            ? 'bg-indigo-50 border border-indigo-200'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Avatar name={searchUser.name} size="md" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{searchUser.name}</p>
                          <p className="text-sm text-gray-500">{searchUser.email}</p>
                        </div>
                        {isSelected && (
                          <div className="text-indigo-600">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <Button variant="secondary" onClick={handleBack} disabled={isCreating}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateChat}
              loading={isCreating}
              disabled={selectedUsers.length === 0 || (chatType === 'group' && !groupName.trim())}
            >
              {chatType === 'direct' ? 'チャット開始' : 'グループ作成'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
