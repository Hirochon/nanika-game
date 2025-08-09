/**
 * Email validation utility
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Password validation utility
 * For registration: Must be at least 8 characters and contain uppercase, lowercase letters and numbers
 * For login: Must be at least 6 characters (less strict for existing users)
 */
export function validatePassword(password: string, strict: boolean = true): boolean {
  // For login, we only check minimum length (6 characters, matching Password VO)
  if (!strict) {
    return password.length >= 6;
  }

  // For registration, we enforce stricter rules
  if (password.length < 8) return false;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Login form validation
 */
export interface LoginFormData {
  email: string;
  password: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateLoginForm(data: LoginFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  } else if (!validatePassword(data.password, false)) {
    // Use non-strict validation for login
    errors.password = 'Password must be at least 6 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Registration form validation
 */
export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegisterForm(data: RegisterFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name) {
    errors.name = 'Name is required';
  } else if (data.name.length < 2 || data.name.length > 50) {
    errors.name = 'Name must be between 2 and 50 characters';
  }

  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  } else if (!validatePassword(data.password)) {
    errors.password =
      'Password must be at least 8 characters with uppercase, lowercase letters and numbers';
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
