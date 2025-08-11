/**
 * Test Setup Configuration
 * Infrastructure-specialist による統合テスト設定
 */

import { afterAll, beforeAll } from 'vitest';

// 環境変数の設定
beforeAll(async () => {
  // テスト環境変数の設定
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log('🔧 Test environment setup completed');
});

afterAll(async () => {
  console.log('✅ Test environment cleanup completed');
});
