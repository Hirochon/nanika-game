import type { User } from '@domain/entities/user.entity';
import type { Email } from '@domain/value-objects/email.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
