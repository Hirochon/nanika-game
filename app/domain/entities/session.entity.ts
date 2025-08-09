import { SessionToken } from '@domain/value-objects/session-token.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { DomainError } from '@shared/errors/domain.error';

export interface SessionProps {
  token: SessionToken;
  userId: UserId;
  expiresAt: Date;
  createdAt: Date;
}

export class Session {
  private constructor(private readonly props: SessionProps) {}

  static create(userId: UserId, expirationMinutes: number = 30): Session {
    if (expirationMinutes <= 0) {
      throw new SessionInvalidError('Expiration minutes must be positive');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    return new Session({
      token: SessionToken.generate(),
      userId,
      expiresAt,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: SessionProps): Session {
    return new Session(props);
  }

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  isValid(): boolean {
    return !this.isExpired();
  }

  extend(additionalMinutes: number = 30): Session {
    if (additionalMinutes <= 0) {
      throw new SessionInvalidError('Additional minutes must be positive');
    }

    const newExpiresAt = new Date(this.props.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);

    return new Session({
      ...this.props,
      expiresAt: newExpiresAt,
    });
  }

  // Getters
  get token(): SessionToken {
    return this.props.token;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  equals(other: Session): boolean {
    return this.props.token.equals(other.props.token);
  }

  toJSON() {
    return {
      token: this.props.token.value,
      userId: this.props.userId.value,
      expiresAt: this.props.expiresAt.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}

export class SessionInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionInvalidError';
  }
}
