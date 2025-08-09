export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'DomainError';

    // TypeScriptの推奨設定に従ってprototypeを復元
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
