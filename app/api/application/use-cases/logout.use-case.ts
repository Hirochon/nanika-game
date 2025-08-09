import type { LogoutCommand } from '@api/application/commands/logout.command';
import { LogoutResult } from '@api/application/results/logout.result';
import type { SessionService } from '@domain/services/session.service';

export class LogoutUseCase {
  constructor(private readonly sessionService: SessionService) {}

  async execute(command: LogoutCommand): Promise<LogoutResult> {
    try {
      // セッションを破棄
      await this.sessionService.destroySession(command.sessionToken);

      return LogoutResult.success('Successfully logged out');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      return LogoutResult.failure(errorMessage);
    }
  }
}
