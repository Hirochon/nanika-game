import { DomainError } from '@shared/errors/domain.error';

export class SessionToken {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): SessionToken {
    if (!value || typeof value !== 'string') {
      throw new SessionTokenInvalidError('SessionToken is required');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new SessionTokenInvalidError('SessionToken cannot be empty');
    }

    if (trimmed.length > 255) {
      throw new SessionTokenInvalidError('SessionToken is too long (max 255 characters)');
    }

    return new SessionToken(trimmed);
  }

  static generate(): SessionToken {
    // 実際の実装ではより安全なトークン生成方法を使用
    // 今回は開発中なのでシンプルな生成方法を使用
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const token = `session_${timestamp}_${random}`;

    return new SessionToken(token);
  }

  get value(): string {
    return this._value;
  }

  equals(other: SessionToken): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class SessionTokenInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionTokenInvalidError';
  }
}
