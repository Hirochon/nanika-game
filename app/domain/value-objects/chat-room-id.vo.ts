import { ChatDomainError } from '../../shared/errors/chat.error';

export class ChatRoomId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new ChatDomainError('ChatRoomIdは正の整数である必要があります');
    }
  }

  static create(value: number): ChatRoomId {
    return new ChatRoomId(value);
  }

  static generate(): ChatRoomId {
    // 実際の実装では、データベースのAUTO_INCREMENTに依存
    // ここでは一時的なIDを生成
    return new ChatRoomId(Math.floor(Math.random() * 1000000) + 1);
  }

  get value(): number {
    return this._value;
  }

  equals(other: ChatRoomId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
