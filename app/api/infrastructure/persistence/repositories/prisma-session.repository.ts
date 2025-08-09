import { Session, type SessionProps } from '@domain/entities/session.entity';
import type { ISessionRepository } from '@domain/repositories/session.repository';
import { SessionToken } from '@domain/value-objects/session-token.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import type { PrismaClient } from '@prisma/client';

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByToken(token: SessionToken): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: token.value },
    });

    if (!session) {
      return null;
    }

    return this.toDomain(session);
  }

  async findByUserId(userId: UserId): Promise<Session[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: userId.value },
    });

    return sessions.map((session) => this.toDomain(session));
  }

  async save(session: Session): Promise<void> {
    const data = {
      id: session.token.value,
      userId: session.userId.value,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };

    await this.prisma.session.upsert({
      where: { id: session.token.value },
      update: {
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
      create: data,
    });
  }

  async deleteByToken(token: SessionToken): Promise<void> {
    await this.prisma.session.delete({
      where: { id: token.value },
    });
  }

  async deleteByUserId(userId: UserId): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId: userId.value },
    });
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  private toDomain(session: {
    id: string;
    userId: number;
    expiresAt: Date;
    createdAt: Date;
  }): Session {
    const props: SessionProps = {
      token: SessionToken.create(session.id),
      userId: UserId.create(session.userId),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };

    return Session.reconstruct(props);
  }
}
