/**
 * ユーザー選択モーダルコンポーネント
 * 新規チャットルーム作成時のユーザー検索・選択機能
 */

import { useCallback, useEffect, useState } from 'react';
import { useChatRoomCreation, useUserSearch } from '../../hooks/useSocket';
import type { User } from '../../types/chat-types';
import { debounce } from '../../utils/chat-utils';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface UserSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onRoomCreated?: (roomId: string) => void;
  mode?: 'direct' | 'group';
}

export function UserSelectModal({
  isOpen,
  onClose,
  currentUser,
  onRoomCreated,
  mode = 'direct',
}: UserSelectModalProps) {
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
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsers(query);
        // 現在のユーザーを除外
        const filteredResults = results.filter((user: User) => user.id !== currentUser.id);
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

  // 検索クエリ変更時の処理
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // モーダル状態リセット
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
      setGroupName('');
      setError(null);
    }
  }, [isOpen]);

  const handleUserSelect = (user: User) => {
    if (mode === 'direct') {
      setSelectedUsers([user]);
    } else {
      const isAlreadySelected = selectedUsers.some((u) => u.id === user.id);
      if (isAlreadySelected) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      setError('ユーザーを選択してください');
      return;
    }

    if (mode === 'group' && !groupName.trim()) {
      setError('グループ名を入力してください');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      let roomId: string;

      if (mode === 'direct') {
        roomId = await createDirectChat(selectedUsers[0].id);
      } else {
        const memberIds = selectedUsers.map((user) => user.id);
        roomId = await createGroupChat(groupName.trim(), memberIds);
      }

      onRoomCreated?.(roomId);
      onClose();
    } catch (error) {
      console.error('Failed to create chat:', error);
      setError('チャットルームの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダル本体 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md">
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {mode === 'direct' ? '新しいチャット' : '新しいグループ'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="p-6 space-y-4">
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* グループ名入力（グループモードの場合） */}
            {mode === 'group' && (
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                  グループ名
                </label>
                <Input
                  id="groupName"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="グループ名を入力"
                  fullWidth
                />
              </div>
            )}

            {/* ユーザー検索 */}
            <div>
              <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 mb-1">
                ユーザーを検索
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
                <p className="text-sm font-medium text-gray-700 mb-2">
                  選択されたユーザー ({selectedUsers.length}人)
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-2 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                    >
                      <Avatar name={user.name} size="sm" />
                      <span>{user.name}</span>
                      <button
                        onClick={() => handleUserSelect(user)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <svg
                          className="w-3 h-3"
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
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    検索結果 ({searchResults.length}件)
                  </p>
                  {searchResults.map((user) => {
                    const isSelected = selectedUsers.some((u) => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className={cn(
                          'w-full flex items-center space-x-3 p-3 rounded-md text-left',
                          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                          isSelected && 'bg-indigo-50 border border-indigo-200'
                        )}
                      >
                        <Avatar name={user.name} size="md" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
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
              ) : searchQuery && !isSearching ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">該当するユーザーが見つかりませんでした</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose} disabled={isCreating}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateChat}
              loading={isCreating}
              disabled={selectedUsers.length === 0 || (mode === 'group' && !groupName.trim())}
            >
              {mode === 'direct' ? 'チャット開始' : 'グループ作成'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
