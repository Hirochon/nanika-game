import 'reflect-metadata';

// Use Cases
import { LoginUseCase } from '@api/application/use-cases/login.use-case';
import { LogoutUseCase } from '@api/application/use-cases/logout.use-case';
import { PrismaSessionRepository } from '@api/infrastructure/persistence/repositories/prisma-session.repository';
// Infrastructure implementations
import { PrismaUserRepository } from '@api/infrastructure/persistence/repositories/prisma-user.repository';
import type { ISessionRepository } from '@domain/repositories/session.repository';
// Repository Interfaces
import type { IUserRepository } from '@domain/repositories/user.repository';
// Domain Services
import { AuthenticationService } from '@domain/services/authentication.service';
import { SessionService } from '@domain/services/session.service';
import { PrismaClient } from '@prisma/client';
import { container } from 'tsyringe';

export const TOKENS = {
  PrismaClient: Symbol.for('PrismaClient'),
  UserRepository: Symbol.for('UserRepository'),
  SessionRepository: Symbol.for('SessionRepository'),
  AuthenticationService: Symbol.for('AuthenticationService'),
  SessionService: Symbol.for('SessionService'),
  LoginUseCase: Symbol.for('LoginUseCase'),
  LogoutUseCase: Symbol.for('LogoutUseCase'),
} as const;

// Register Prisma client
const prismaClient = new PrismaClient();
container.registerInstance<PrismaClient>(TOKENS.PrismaClient, prismaClient);

// Register repositories
container.register<IUserRepository>(TOKENS.UserRepository, {
  useFactory: (dependencyContainer) => {
    const prisma = dependencyContainer.resolve<PrismaClient>(TOKENS.PrismaClient);
    return new PrismaUserRepository(prisma);
  },
});

container.register<ISessionRepository>(TOKENS.SessionRepository, {
  useFactory: (dependencyContainer) => {
    const prisma = dependencyContainer.resolve<PrismaClient>(TOKENS.PrismaClient);
    return new PrismaSessionRepository(prisma);
  },
});

// Register services
container.register<AuthenticationService>(TOKENS.AuthenticationService, {
  useFactory: (dependencyContainer) => {
    const userRepository = dependencyContainer.resolve<IUserRepository>(TOKENS.UserRepository);
    return new AuthenticationService(userRepository);
  },
});

container.register<SessionService>(TOKENS.SessionService, {
  useFactory: (dependencyContainer) => {
    const sessionRepository = dependencyContainer.resolve<ISessionRepository>(
      TOKENS.SessionRepository
    );
    return new SessionService(sessionRepository);
  },
});

// Register use cases
container.register<LoginUseCase>(TOKENS.LoginUseCase, {
  useFactory: (dependencyContainer) => {
    const authService = dependencyContainer.resolve<AuthenticationService>(
      TOKENS.AuthenticationService
    );
    const sessionService = dependencyContainer.resolve<SessionService>(TOKENS.SessionService);
    return new LoginUseCase(authService, sessionService);
  },
});

container.register<LogoutUseCase>(TOKENS.LogoutUseCase, {
  useFactory: (dependencyContainer) => {
    const sessionService = dependencyContainer.resolve<SessionService>(TOKENS.SessionService);
    return new LogoutUseCase(sessionService);
  },
});

export { container };
