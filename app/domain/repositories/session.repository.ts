import type { Session } from '@domain/entities/session.entity';
import type { SessionToken } from '@domain/value-objects/session-token.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface ISessionRepository {
  findByToken(token: SessionToken): Promise<Session | null>;
  findByUserId(userId: UserId): Promise<Session[]>;
  save(session: Session): Promise<void>;
  deleteByToken(token: SessionToken): Promise<void>;
  deleteByUserId(userId: UserId): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}
