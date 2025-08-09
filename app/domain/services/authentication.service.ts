import { User } from '@domain/entities/user.entity';
import type { IUserRepository } from '@domain/repositories/user.repository';
import { Email } from '@domain/value-objects/email.vo';
import { DomainError } from '@shared/errors/domain.error';

export class AuthenticationService {
  constructor(private readonly userRepository: IUserRepository) {}

  async authenticate(email: string, password: string): Promise<User> {
    const emailVO = Email.create(email);
    const user = await this.userRepository.findByEmail(emailVO);

    if (!user) {
      throw new AuthenticationFailedError('Invalid email or password');
    }

    const isAuthenticated = await user.authenticate(password);

    if (!isAuthenticated) {
      throw new AuthenticationFailedError('Invalid email or password');
    }

    return user;
  }

  async registerUser(name: string, email: string, password: string): Promise<User> {
    const emailVO = Email.create(email);
    const existingUser = await this.userRepository.findByEmail(emailVO);

    if (existingUser) {
      throw new UserAlreadyExistsError('User with this email already exists');
    }

    const user = await User.create(name, email, password);
    await this.userRepository.save(user);

    return user;
  }
}

export class AuthenticationFailedError extends DomainError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_FAILED');
    this.name = 'AuthenticationFailedError';
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(message: string = 'User already exists') {
    super(message, 'USER_EXISTS');
    this.name = 'UserAlreadyExistsError';
  }
}
