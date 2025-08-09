import type { ActionFunctionArgs } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { action as dashboardAction } from './dashboard';

describe('Dashboard Logout Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // コンソールログをモック
    vi.spyOn(console, 'log').mockImplementation(() => {
      // Intentionally empty for testing
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty for testing
    });
  });

  describe('Logout Action', () => {
    it('should have logout action function', () => {
      expect(typeof dashboardAction).toBe('function');
    });

    it('should delete HTTPOnly cookie on logout', async () => {
      const request = new Request('http://localhost/dashboard', {
        method: 'POST',
        headers: {
          Cookie: 'nanika_game_user=test_session_data',
        },
      });

      const result = await dashboardAction({
        request,
        params: {},
        context: {},
      } as ActionFunctionArgs);

      expect((result as Response).status).toBe(302);
      expect((result as Response).headers.get('Location')).toBe('/login');

      const setCookie = (result as Response).headers.get('Set-Cookie');
      expect(setCookie).toContain('nanika_game_user=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('should redirect to login page after logout', async () => {
      const request = new Request('http://localhost/dashboard', {
        method: 'POST',
      });

      const result = await dashboardAction({
        request,
        params: {},
        context: {},
      } as ActionFunctionArgs);

      expect((result as Response).status).toBe(302);
      expect((result as Response).headers.get('Location')).toBe('/login');
    });

    it('should only accept POST method for logout', async () => {
      const getRequest = new Request('http://localhost/dashboard', {
        method: 'GET',
      });

      try {
        await dashboardAction({
          request: getRequest,
          params: {},
          context: {},
        } as ActionFunctionArgs);
        expect.fail('Should throw error for GET request');
      } catch (error) {
        expect((error as Response).status).toBe(405);
      }
    });

    it('should properly clear HTTPOnly cookie', async () => {
      const request = new Request('http://localhost/dashboard', {
        method: 'POST',
        headers: {
          Cookie: 'nanika_game_user=valid_session_data',
        },
      });

      const result = await dashboardAction({
        request,
        params: {},
        context: {},
      } as ActionFunctionArgs);

      const setCookie = (result as Response).headers.get('Set-Cookie');

      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('should complete logout within 100ms', async () => {
      const request = new Request('http://localhost/dashboard', {
        method: 'POST',
      });

      const startTime = Date.now();
      await dashboardAction({
        request,
        params: {},
        context: {},
      } as ActionFunctionArgs);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100);
    });
  });
});
