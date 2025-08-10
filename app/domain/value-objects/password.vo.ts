import { DomainError } from '@shared/errors/domain.error';
import { hash, verify } from '@node-rs/argon2';

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

    // argon2でハッシュ化（seed.tsと同じ設定）
    const hashed = await hash(plainPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });
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
    // argon2で検証
    return await verify(this._hashedValue, plainPassword);
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
