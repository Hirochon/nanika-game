import { User, type UserProps } from '@domain/entities/user.entity';
import type { IUserRepository } from '@domain/repositories/user.repository';
import { Email } from '@domain/value-objects/email.vo';
import { Password } from '@domain/value-objects/password.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import type { PrismaClient } from '@prisma/client';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: id.value },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.value },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async save(user: User): Promise<void> {
    const data = {
      name: user.name,
      email: user.email.value,
      passwordHash: user.password.hashedValue,
      updatedAt: user.updatedAt,
    };

    await this.prisma.user.upsert({
      where: { id: user.id.value },
      update: data,
      create: {
        ...data,
        id: user.id.value,
        createdAt: user.createdAt,
      },
    });
  }

  async delete(id: UserId): Promise<void> {
    await this.prisma.user.delete({
      where: { id: id.value },
    });
  }

  private toDomain(user: any): User {
    const props: UserProps = {
      id: UserId.create(user.id),
      name: user.name,
      email: Email.create(user.email),
      password: Password.fromHash(user.passwordHash),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return User.reconstruct(props);
  }
}
