export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}

  static fromFormData(formData: FormData): LoginCommand {
    const email = formData.get('email');
    const password = formData.get('password');

    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new Error('Invalid form data: email and password must be strings');
    }

    return new LoginCommand(email, password);
  }

  static create(email: string, password: string): LoginCommand {
    return new LoginCommand(email, password);
  }
}
