import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateLoginForm,
  validatePassword,
  validateRegisterForm,
} from './validation';

describe('Validation utilities', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.jp')).toBe(true);
      expect(validateEmail('valid+email@test.org')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid passwords', () => {
      expect(validatePassword('Password123')).toBe(true);
      expect(validatePassword('MyPassword1')).toBe(true);
      expect(validatePassword('StrongPass123')).toBe(true);
    });

    it('should return false for invalid passwords', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('nouppercase123')).toBe(false);
      expect(validatePassword('NOLOWERCASE123')).toBe(false);
      expect(validatePassword('NoNumbers')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('validateLoginForm', () => {
    it('should return no errors for valid login form', () => {
      const result = validateLoginForm({
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(result.errors).toEqual({});
      expect(result.isValid).toBe(true);
    });

    it('should return errors for invalid login form', () => {
      const result = validateLoginForm({
        email: 'invalid-email',
        password: 'short',
      });
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateRegisterForm', () => {
    it('should return no errors for valid registration form', () => {
      const result = validateRegisterForm({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(result.errors).toEqual({});
      expect(result.isValid).toBe(true);
    });

    it('should return errors for password mismatch', () => {
      const result = validateRegisterForm({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Different123',
      });
      expect(result.errors.confirmPassword).toBeDefined();
      expect(result.isValid).toBe(false);
    });
  });
});
