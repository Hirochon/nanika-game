export class LogoutCommand {
  constructor(public readonly sessionToken: string) {}

  static fromRequest(request: Request): LogoutCommand {
    const cookie = request.headers.get('Cookie');

    if (!cookie) {
      throw new Error('No session token found in cookies');
    }

    const sessionData = cookie.split('nanika_game_user=')[1]?.split(';')[0];

    if (!sessionData) {
      throw new Error('Invalid session token in cookies');
    }

    return new LogoutCommand(sessionData);
  }

  static create(sessionToken: string): LogoutCommand {
    return new LogoutCommand(sessionToken);
  }
}
