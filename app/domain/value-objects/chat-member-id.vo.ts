import { ChatDomainError } from '../../shared/errors/chat.error';

export class ChatMemberId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new ChatDomainError('ChatMemberIdは正の整数である必要があります');
    }
  }

  static create(value: number): ChatMemberId {
    return new ChatMemberId(value);
  }

  static generate(): ChatMemberId {
    return new ChatMemberId(Math.floor(Math.random() * 1000000) + 1);
  }

  get value(): number {
    return this._value;
  }

  equals(other: ChatMemberId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
