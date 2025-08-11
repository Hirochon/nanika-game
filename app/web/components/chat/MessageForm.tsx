/**
 * メッセージ送信フォームコンポーネント
 * メッセージ入力とタイピング状態管理
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../hooks/useSocket';
import type { ChatRoomId } from '../../types/chat-types';
import { debounce, validateMessage } from '../../utils/chat-utils';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

export interface MessageFormProps {
  roomId: ChatRoomId | null;
  disabled?: boolean;
  className?: string;
  onMessageSent?: () => void;
}

export function MessageForm({
  roomId,
  disabled = false,
  className,
  onMessageSent,
}: MessageFormProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, startTyping, stopTyping } = useMessages(roomId);

  // タイピング状態の管理（デバウンス）
  const debouncedStopTyping = useCallback(
    debounce(() => {
      stopTyping();
    }, 2000),
    []
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessage(value);
      setError(null);

      // タイピング状態を送信
      if (value.trim() && roomId) {
        startTyping();
        debouncedStopTyping();
      } else {
        stopTyping();
      }

      // テキストエリアの高さを自動調整
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    },
    [roomId, startTyping, stopTyping, debouncedStopTyping]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!roomId || !message.trim() || isSubmitting || disabled) {
        return;
      }

      // バリデーション
      const validation = validateMessage(message);
      if (!validation.isValid) {
        setError(validation.error || '無効なメッセージです');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await sendMessage(message.trim());
        setMessage('');

        // テキストエリアの高さをリセット
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        onMessageSent?.();
      } catch (error) {
        console.error('Failed to send message:', error);

        // エラーメッセージを改善
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('メッセージの送信に失敗しました');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [roomId, message, isSubmitting, disabled, sendMessage, onMessageSent]
  );

  // キーボードショートカット処理
  // 日本語入力を考慮して、Ctrl+EnterまたはCmd+Enterで送信
  // Shift+Enterで改行
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter または Cmd+Enter で送信
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(e as any);
      }
      // Shift+Enter は改行（デフォルト動作）なので何もしない
      // 通常のEnterも改行（日本語入力の確定用）
    },
    [handleSubmit]
  );

  // コンポーネントアンマウント時にタイピング状態をクリア
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  // ルーム変更時にフォームをリセット
  useEffect(() => {
    setMessage('');
    setError(null);
    setIsSubmitting(false);
  }, []);

  if (!roomId) {
    return (
      <div className={cn('p-4 border-t border-gray-200 bg-gray-50', className)}>
        <div className="text-center text-gray-500 text-sm">チャットルームを選択してください</div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 border-t border-gray-200 bg-white', className)}>
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力... (Ctrl+Enterで送信)"
              disabled={disabled || isSubmitting}
              rows={1}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-md',
                'resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
                'placeholder-gray-500 text-sm',
                'min-h-[40px] max-h-32 overflow-y-auto'
              )}
              style={{
                height: 'auto',
                minHeight: '40px',
              }}
            />

            {/* 文字数カウンター */}
            <div className="absolute bottom-1 right-2 text-xs text-gray-400">
              {message.length}/1000
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!message.trim() || isSubmitting || disabled}
            loading={isSubmitting}
            className="flex-shrink-0 self-end"
            title="送信 (Ctrl+Enter / Cmd+Enter)"
          >
            {isSubmitting ? (
              '送信中...'
            ) : (
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                <span className="hidden sm:inline">送信</span>
              </div>
            )}
          </Button>
        </div>
      </form>

      {/* キーボードショートカットの説明 */}
      <div className="mt-2 text-xs text-gray-500">
        <span className="inline-flex items-center space-x-2">
          <span>💡 ヒント:</span>
          <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">
            Ctrl
          </kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">
            Enter
          </kbd>
          <span>で送信</span>
          <span className="mx-2">|</span>
          <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">
            Enter
          </kbd>
          <span>で改行（日本語入力対応）</span>
        </span>
      </div>
    </div>
  );
}
