import { Email } from '@domain/value-objects/email.vo';
import { Password } from '@domain/value-objects/password.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { DomainError } from '@shared/errors/domain.error';

export interface UserProps {
  id: UserId;
  name: string;
  email: Email;
  password: Password;
  createdAt: Date;
  updatedAt?: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static async create(name: string, email: string, password: string): Promise<User> {
    if (!name || typeof name !== 'string') {
      throw new UserInvalidError('Name is required');
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new UserInvalidError('Name cannot be empty');
    }

    if (trimmedName.length > 50) {
      throw new UserInvalidError('Name is too long (max 50 characters)');
    }

    return new User({
      id: UserId.generate(),
      name: trimmedName,
      email: Email.create(email),
      password: await Password.create(password),
      createdAt: new Date(),
    });
  }

  static reconstruct(props: UserProps): User {
    return new User(props);
  }

  async authenticate(plainPassword: string): Promise<boolean> {
    return await this.props.password.verify(plainPassword);
  }

  updateName(newName: string): User {
    if (!newName || typeof newName !== 'string') {
      throw new UserInvalidError('Name is required');
    }

    const trimmedName = newName.trim();
    if (trimmedName.length === 0) {
      throw new UserInvalidError('Name cannot be empty');
    }

    if (trimmedName.length > 50) {
      throw new UserInvalidError('Name is too long (max 50 characters)');
    }

    return new User({
      ...this.props,
      name: trimmedName,
      updatedAt: new Date(),
    });
  }

  // Getters
  get id(): UserId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get password(): Password {
    return this.props.password;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  equals(other: User): boolean {
    return this.props.id.equals(other.props.id);
  }

  toJSON() {
    return {
      id: this.props.id.value,
      name: this.props.name,
      email: this.props.email.value,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt?.toISOString(),
    };
  }
}

export class UserInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'UserInvalidError';
  }
}
