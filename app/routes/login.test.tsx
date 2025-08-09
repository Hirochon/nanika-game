import { describe, expect, it } from 'vitest';
import { validateLoginForm } from '~/utils/validation';

describe('Login Component Logic', () => {
  it('should validate login form data correctly', () => {
    const validData = {
      email: 'admin@example.com',
      password: 'Admin123',
    };

    const result = validateLoginForm(validData);

    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'Admin123',
    };

    const result = validateLoginForm(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Invalid email format');
  });

  it('should reject weak passwords', () => {
    const invalidData = {
      email: 'admin@example.com',
      password: 'weak',
    };

    const result = validateLoginForm(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('Password must be at least 8 characters');
  });
});
