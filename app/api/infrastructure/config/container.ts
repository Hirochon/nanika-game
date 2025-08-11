import 'reflect-metadata';

import { CreateChatRoomUseCase } from '@api/application/use-cases/create-chat-room.use-case';
import { GetChatRoomsUseCase } from '@api/application/use-cases/get-chat-rooms.use-case';
import { GetMessagesUseCase } from '@api/application/use-cases/get-messages.use-case';
// Use Cases
import { LoginUseCase } from '@api/application/use-cases/login.use-case';
import { LogoutUseCase } from '@api/application/use-cases/logout.use-case';
import { SendMessageUseCase } from '@api/application/use-cases/send-message.use-case';
import { PrismaChatMemberRepository } from '@api/infrastructure/persistence/repositories/prisma-chat-member.repository';
import { PrismaChatRoomRepository } from '@api/infrastructure/persistence/repositories/prisma-chat-room.repository';
import { PrismaMessageRepository } from '@api/infrastructure/persistence/repositories/prisma-message.repository';
import { PrismaSessionRepository } from '@api/infrastructure/persistence/repositories/prisma-session.repository';
// Infrastructure implementations
import { PrismaUserRepository } from '@api/infrastructure/persistence/repositories/prisma-user.repository';
import type { IChatMemberRepository } from '@domain/repositories/chat-member.repository';
import type { IChatRoomRepository } from '@domain/repositories/chat-room.repository';
import type { IMessageRepository } from '@domain/repositories/message.repository';
import type { ISessionRepository } from '@domain/repositories/session.repository';
// Repository Interfaces
import type { IUserRepository } from '@domain/repositories/user.repository';

// Domain Services
import { AuthenticationService } from '@domain/services/authentication.service';
import { SessionService } from '@domain/services/session.service';
import { PrismaClient } from '@prisma/client';
import { container } from 'tsyringe';

export const TOKENS = {
  // Infrastructure
  PrismaClient: Symbol.for('PrismaClient'),

  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  SessionRepository: Symbol.for('SessionRepository'),
  ChatRoomRepository: Symbol.for('ChatRoomRepository'),
  MessageRepository: Symbol.for('MessageRepository'),
  ChatMemberRepository: Symbol.for('ChatMemberRepository'),

  // Services
  AuthenticationService: Symbol.for('AuthenticationService'),
  SessionService: Symbol.for('SessionService'),

  // Use Cases
  LoginUseCase: Symbol.for('LoginUseCase'),
  LogoutUseCase: Symbol.for('LogoutUseCase'),
  CreateChatRoomUseCase: Symbol.for('CreateChatRoomUseCase'),
  SendMessageUseCase: Symbol.for('SendMessageUseCase'),
  GetChatRoomsUseCase: Symbol.for('GetChatRoomsUseCase'),
  GetMessagesUseCase: Symbol.for('GetMessagesUseCase'),
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

// Register chat repositories
container.register<IChatRoomRepository>(TOKENS.ChatRoomRepository, {
  useFactory: (dependencyContainer) => {
    const prisma = dependencyContainer.resolve<PrismaClient>(TOKENS.PrismaClient);
    return new PrismaChatRoomRepository(prisma);
  },
});

container.register<IMessageRepository>(TOKENS.MessageRepository, {
  useFactory: (dependencyContainer) => {
    const prisma = dependencyContainer.resolve<PrismaClient>(TOKENS.PrismaClient);
    return new PrismaMessageRepository(prisma);
  },
});

container.register<IChatMemberRepository>(TOKENS.ChatMemberRepository, {
  useFactory: (dependencyContainer) => {
    const prisma = dependencyContainer.resolve<PrismaClient>(TOKENS.PrismaClient);
    return new PrismaChatMemberRepository(prisma);
  },
});

// Register chat use cases
container.register<CreateChatRoomUseCase>(TOKENS.CreateChatRoomUseCase, {
  useFactory: (dependencyContainer) => {
    const chatRoomRepository = dependencyContainer.resolve<IChatRoomRepository>(
      TOKENS.ChatRoomRepository
    );
    return new CreateChatRoomUseCase(chatRoomRepository);
  },
});

container.register<SendMessageUseCase>(TOKENS.SendMessageUseCase, {
  useFactory: (dependencyContainer) => {
    const chatRoomRepository = dependencyContainer.resolve<IChatRoomRepository>(
      TOKENS.ChatRoomRepository
    );
    const messageRepository = dependencyContainer.resolve<IMessageRepository>(
      TOKENS.MessageRepository
    );
    return new SendMessageUseCase(chatRoomRepository, messageRepository);
  },
});

container.register<GetChatRoomsUseCase>(TOKENS.GetChatRoomsUseCase, {
  useFactory: (dependencyContainer) => {
    const chatRoomRepository = dependencyContainer.resolve<IChatRoomRepository>(
      TOKENS.ChatRoomRepository
    );
    return new GetChatRoomsUseCase(chatRoomRepository);
  },
});

container.register<GetMessagesUseCase>(TOKENS.GetMessagesUseCase, {
  useFactory: (dependencyContainer) => {
    const messageRepository = dependencyContainer.resolve<IMessageRepository>(
      TOKENS.MessageRepository
    );
    const chatRoomRepository = dependencyContainer.resolve<IChatRoomRepository>(
      TOKENS.ChatRoomRepository
    );
    return new GetMessagesUseCase(messageRepository, chatRoomRepository);
  },
});

export { container };
