import { DomainError } from '@shared/errors/domain.error';
import * as bcrypt from 'bcrypt';

export class Password {
  private readonly _hashedValue: string;

  private constructor(hashedValue: string) {
    this._hashedValue = hashedValue;
  }

  static async create(plainPassword: string): Promise<Password> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new PasswordInvalidError('Password is required');
    }

    if (plainPassword.length < 6) {
      throw new PasswordInvalidError('Password must be at least 6 characters long');
    }

    if (plainPassword.length > 128) {
      throw new PasswordInvalidError('Password is too long (max 128 characters)');
    }

    // bcryptでハッシュ化
    const saltRounds = 12;
    const hashed = await bcrypt.hash(plainPassword, saltRounds);
    return new Password(hashed);
  }

  static fromHash(hashedValue: string): Password {
    if (!hashedValue || typeof hashedValue !== 'string') {
      throw new PasswordInvalidError('Hashed password is required');
    }
    return new Password(hashedValue);
  }

  async verify(plainPassword: string): Promise<boolean> {
    if (!plainPassword) {
      return false;
    }
    // bcryptで検証
    return await bcrypt.compare(plainPassword, this._hashedValue);
  }

  get hashedValue(): string {
    return this._hashedValue;
  }

  equals(other: Password): boolean {
    return this._hashedValue === other._hashedValue;
  }
}

export class PasswordInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordInvalidError';
  }
}
