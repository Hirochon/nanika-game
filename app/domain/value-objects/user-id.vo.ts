import { DomainError } from '@shared/errors/domain.error';

export class UserId {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  static create(value: number): UserId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new UserIdInvalidError('UserId must be a positive integer');
    }
    return new UserId(value);
  }

  static generate(): UserId {
    // 実際の実装ではより適切なID生成方法を使用
    // 今回は開発中なのでシンプルなランダム値を使用
    const id = Math.floor(Math.random() * 1000000) + 1;
    return new UserId(id);
  }

  get value(): number {
    return this._value;
  }

  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}

export class UserIdInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'UserIdInvalidError';
  }
}
