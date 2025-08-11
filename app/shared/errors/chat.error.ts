import { DomainError } from './domain.error';

export class ChatDomainError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'ChatDomainError';
  }
}

export class ChatRoomError extends ChatDomainError {
  static roomNotFound(roomId: number): ChatRoomError {
    return new ChatRoomError(`チャットルーム(ID: ${roomId})が見つかりません`, 'ROOM_NOT_FOUND');
  }

  static accessDenied(roomId: number): ChatRoomError {
    return new ChatRoomError(
      `チャットルーム(ID: ${roomId})へのアクセス権限がありません`,
      'ROOM_ACCESS_DENIED'
    );
  }

  static memberLimitExceeded(limit: number): ChatRoomError {
    return new ChatRoomError(`メンバー数の上限(${limit}人)を超えています`, 'MEMBER_LIMIT_EXCEEDED');
  }
}

export class MessageError extends ChatDomainError {
  static messageNotFound(messageId: number): MessageError {
    return new MessageError(`メッセージ(ID: ${messageId})が見つかりません`, 'MESSAGE_NOT_FOUND');
  }

  static editNotAllowed(messageId: number): MessageError {
    return new MessageError(`メッセージ(ID: ${messageId})は編集できません`, 'MESSAGE_EDIT_DENIED');
  }

  static deleteNotAllowed(messageId: number): MessageError {
    return new MessageError(
      `メッセージ(ID: ${messageId})は削除できません`,
      'MESSAGE_DELETE_DENIED'
    );
  }

  static contentTooLong(maxLength: number): MessageError {
    return new MessageError(
      `メッセージは${maxLength}文字以内で入力してください`,
      'MESSAGE_TOO_LONG'
    );
  }
}
