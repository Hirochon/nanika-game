import type { IUserRepository } from '../../../../domain/repositories/user.repository';
import type { SessionService } from '../../../../domain/services/session.service';
import { container, TOKENS } from '../../infrastructure/config/container';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
}

export class AuthenticationHandler {
  private sessionService: SessionService;
  private userRepository: IUserRepository;

  constructor() {
    this.sessionService = container.resolve<SessionService>(TOKENS.SessionService);
    this.userRepository = container.resolve<IUserRepository>(TOKENS.UserRepository);
  }

  async authenticateSocket(sessionToken: string): Promise<AuthenticatedUser | null> {
    try {
      // セッショントークンの検証
      const session = await this.sessionService.findByToken(sessionToken);
      if (!session) {
        console.warn('Invalid session token:', sessionToken);
        return null;
      }

      // セッションの有効期限チェック
      if (session.isExpired()) {
        console.warn('Expired session:', sessionToken);
        return null;
      }

      // ユーザー情報の取得
      const user = await this.userRepository.findById(session.userId);
      if (!user) {
        console.warn('User not found for session:', sessionToken);
        return null;
      }

      return {
        id: user.id.value,
        name: user.name,
        email: user.email.value,
      };
    } catch (error) {
      console.error('Socket authentication error:', error);
      return null;
    }
  }

  async validateRoomAccess(_userId: number, _roomId: number): Promise<boolean> {
    try {
      // チャットルームへのアクセス権限をチェック
      // 実装は後でChatRoomRepositoryで行う
      return true; // 暫定的に許可
    } catch (error) {
      console.error('Room access validation error:', error);
      return false;
    }
  }
}
