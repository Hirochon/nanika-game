import type { Session } from '@domain/entities/session.entity';
import type { User } from '@domain/entities/user.entity';

export class LoginResult {
  private constructor(
    public readonly success: boolean,
    public readonly user?: User,
    public readonly session?: Session,
    public readonly error?: string
  ) {}

  static success(user: User, session: Session): LoginResult {
    return new LoginResult(true, user, session);
  }

  static failure(error: string): LoginResult {
    return new LoginResult(false, undefined, undefined, error);
  }

  get sessionToken(): string {
    if (!this.session) {
      throw new Error('No session available in failed login result');
    }
    return this.session.token.value;
  }

  get userData() {
    if (!this.user) {
      throw new Error('No user data available in failed login result');
    }
    return this.user.toJSON();
  }
}
