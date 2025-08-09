export class LogoutResult {
  private constructor(
    public readonly success: boolean,
    public readonly message?: string,
    public readonly error?: string
  ) {}

  static success(message: string = 'Successfully logged out'): LogoutResult {
    return new LogoutResult(true, message);
  }

  static failure(error: string): LogoutResult {
    return new LogoutResult(false, undefined, error);
  }
}
