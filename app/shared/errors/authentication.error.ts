import { DomainError } from './domain.error';

export class AuthenticationError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'AuthenticationError';
  }
}

export class AuthenticationFailedError extends AuthenticationError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_FAILED');
    this.name = 'AuthenticationFailedError';
  }
}

export class SessionNotFoundError extends AuthenticationError {
  constructor(message: string = 'Session not found') {
    super(message, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor(message: string = 'Session expired') {
    super(message, 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class UserAlreadyExistsError extends AuthenticationError {
  constructor(message: string = 'User already exists') {
    super(message, 'USER_EXISTS');
    this.name = 'UserAlreadyExistsError';
  }
}
