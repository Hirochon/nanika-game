import { ChatDomainError } from '../../shared/errors/chat.error';

export class MessageId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new ChatDomainError('MessageIdは正の整数である必要があります');
    }
  }

  static create(value: number): MessageId {
    return new MessageId(value);
  }

  static generate(): MessageId {
    return new MessageId(Math.floor(Math.random() * 1000000) + 1);
  }

  get value(): number {
    return this._value;
  }

  equals(other: MessageId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
