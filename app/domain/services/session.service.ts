import { Session } from '@domain/entities/session.entity';
import type { User } from '@domain/entities/user.entity';
import type { ISessionRepository } from '@domain/repositories/session.repository';
import { SessionToken } from '@domain/value-objects/session-token.vo';
import { DomainError } from '@shared/errors/domain.error';

export class SessionService {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async createSession(user: User, expirationMinutes: number = 30): Promise<Session> {
    const session = Session.create(user.id, expirationMinutes);
    await this.sessionRepository.save(session);
    return session;
  }

  async validateSession(token: string): Promise<Session> {
    const tokenVO = SessionToken.create(token);
    const session = await this.sessionRepository.findByToken(tokenVO);

    if (!session) {
      throw new SessionNotFoundError('Session not found');
    }

    if (session.isExpired()) {
      await this.sessionRepository.deleteByToken(tokenVO);
      throw new SessionExpiredError('Session has expired');
    }

    return session;
  }

  async extendSession(token: string, additionalMinutes: number = 30): Promise<Session> {
    const session = await this.validateSession(token);
    const extendedSession = session.extend(additionalMinutes);

    await this.sessionRepository.save(extendedSession);
    return extendedSession;
  }

  async destroySession(token: string): Promise<void> {
    const tokenVO = SessionToken.create(token);
    await this.sessionRepository.deleteByToken(tokenVO);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository.deleteExpiredSessions();
  }
}

export class SessionNotFoundError extends DomainError {
  constructor(message: string = 'Session not found') {
    super(message, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends DomainError {
  constructor(message: string = 'Session expired') {
    super(message, 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}
