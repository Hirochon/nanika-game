import type { LoginCommand } from '@api/application/commands/login.command';
import { LoginResult } from '@api/application/results/login.result';
import type { AuthenticationService } from '@domain/services/authentication.service';
import type { SessionService } from '@domain/services/session.service';

export class LoginUseCase {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly sessionService: SessionService
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    try {
      // 1. ユーザー認証
      const user = await this.authService.authenticate(command.email, command.password);

      // 2. セッション作成
      const session = await this.sessionService.createSession(user, 30);

      return LoginResult.success(user, session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      return LoginResult.failure(errorMessage);
    }
  }
}
