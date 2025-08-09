import { DomainError } from '@shared/errors/domain.error';

export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Email {
    if (value === null || value === undefined || typeof value !== 'string') {
      throw new EmailInvalidError('Email is required');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new EmailInvalidError('Email cannot be empty');
    }

    if (trimmed.length > 254) {
      throw new EmailInvalidError('Email is too long (max 254 characters)');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new EmailInvalidError('Invalid email format');
    }

    return new Email(trimmed.toLowerCase());
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class EmailInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailInvalidError';
  }
}
