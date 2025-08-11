/**
 * Security Testing Suite
 * Infrastructure-specialist によるセキュリティテスト実装
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
// Type definitions needed for tests
import Redis from 'ioredis';
import { SecurityManager } from '../../app/infrastructure/security/security-manager.js';

interface SecurityTestConfig {
  baseUrl: string;
  testTimeout: number;
  redisUrl?: string;
}

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

class SecurityTester {
  private config: SecurityTestConfig;
  private results: SecurityTestResult[] = [];
  private securityManager?: SecurityManager;

  constructor(config: SecurityTestConfig) {
    this.config = config;

    // Initialize SecurityManager if Redis is available
    if (this.config.redisUrl) {
      try {
        const redis = new Redis(this.config.redisUrl);
        this.securityManager = new SecurityManager(redis, {
          rateLimit: { window: 60, max: 100 },
          csrf: {
            secret: 'test-secret',
            cookieName: 'csrf-token',
            headerName: 'X-CSRF-Token',
          },
          xss: {
            allowedTags: ['b', 'i', 'em', 'strong'],
            allowedAttributes: {},
          },
          headers: {
            hsts: true,
            noSniff: true,
            frameOptions: 'DENY',
            xssProtection: true,
          },
        });
      } catch (error) {
        console.warn('Redis not available for security manager:', error);
      }
    }
  }

  /**
   * 全セキュリティテスト実行
   */
  async runAllTests(): Promise<void> {
    console.log('🛡️ Starting Security Testing Suite...');
    console.log('=====================================\n');

    await this.testBasicEndpointSecurity();
    await this.testXSSProtection();
    await this.testSQLInjectionProtection();
    await this.testRateLimiting();
    await this.testCSRFProtection();
    await this.testInputValidation();
    await this.testSecurityHeaders();
    await this.testSessionSecurity();

    this.printResults();
  }

  /**
   * 基本エンドポイントセキュリティテスト
   */
  private async testBasicEndpointSecurity(): Promise<void> {
    const tests = [
      {
        name: 'Health Endpoint Accessibility',
        endpoint: '/health',
        expectedStatus: 200,
        severity: 'low' as const,
      },
      {
        name: 'API Endpoint Accessibility',
        endpoint: '/api/health',
        expectedStatus: 200,
        severity: 'low' as const,
      },
      {
        name: 'Non-existent Endpoint Handling',
        endpoint: '/this-does-not-exist',
        expectedStatus: 404,
        severity: 'medium' as const,
      },
    ];

    for (const test of tests) {
      try {
        const response = await this.makeRequest(test.endpoint);
        const passed = response.statusCode === test.expectedStatus;

        this.results.push({
          testName: test.name,
          passed,
          details: `Expected ${test.expectedStatus}, got ${response.statusCode}`,
          severity: test.severity,
          recommendations: passed ? [] : [`Review endpoint ${test.endpoint} response handling`],
        });
      } catch (error) {
        this.results.push({
          testName: test.name,
          passed: false,
          details: `Request failed: ${error.message}`,
          severity: 'high',
          recommendations: [`Fix endpoint ${test.endpoint} to handle requests properly`],
        });
      }
    }
  }

  /**
   * XSS攻撃テスト
   */
  private async testXSSProtection(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'XSS Protection Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'high',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      '&lt;script&gt;alert("XSS")&lt;/script&gt;',
    ];

    let passedTests = 0;
    const totalTests = xssPayloads.length;

    for (const payload of xssPayloads) {
      const sanitized = this.securityManager.sanitizeHTML(payload);

      // Check if dangerous scripts are properly escaped/removed
      const isDangerous =
        sanitized.includes('<script>') ||
        sanitized.includes('javascript:') ||
        sanitized.includes('onerror=') ||
        sanitized.includes('onload=');

      if (!isDangerous) {
        passedTests++;
      }
    }

    const passed = passedTests === totalTests;
    this.results.push({
      testName: 'XSS Protection',
      passed,
      details: `${passedTests}/${totalTests} XSS payloads properly sanitized`,
      severity: passed ? 'low' : 'critical',
      recommendations: passed
        ? []
        : [
            'Implement stricter HTML sanitization',
            'Add Content Security Policy headers',
            'Validate and escape user inputs',
          ],
    });
  }

  /**
   * SQLインジェーション攻撃テスト
   */
  private async testSQLInjectionProtection(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'SQL Injection Protection Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'critical',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    const sqlPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "admin'--",
      "1' UNION SELECT * FROM users --",
      "' OR 'a'='a",
      "1; INSERT INTO users VALUES('hacker','password')--",
    ];

    let detectedPayloads = 0;
    const totalPayloads = sqlPayloads.length;

    for (const payload of sqlPayloads) {
      const isDetected = this.securityManager.detectSQLInjection(payload);
      if (isDetected) {
        detectedPayloads++;
      }
    }

    const passed = detectedPayloads === totalPayloads;
    this.results.push({
      testName: 'SQL Injection Detection',
      passed,
      details: `${detectedPayloads}/${totalPayloads} SQL injection attempts detected`,
      severity: passed ? 'low' : 'critical',
      recommendations: passed
        ? []
        : [
            'CRITICAL: Implement parameterized queries',
            'Add input validation for database operations',
            'Use ORM with built-in SQL injection protection',
          ],
    });
  }

  /**
   * レート制限テスト
   */
  private async testRateLimiting(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'Rate Limiting Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'high',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    const testId = `test-${Date.now()}`;
    let blockedRequests = 0;
    const testLimit = { window: 10, max: 5 }; // 5 requests per 10 seconds

    // Make more requests than allowed
    for (let i = 0; i < 10; i++) {
      const result = await this.securityManager.checkRateLimit(testId, 'test', testLimit);
      if (!result.allowed) {
        blockedRequests++;
      }
    }

    const passed = blockedRequests > 0; // Should block some requests
    this.results.push({
      testName: 'Rate Limiting',
      passed,
      details: `${blockedRequests}/10 requests properly blocked`,
      severity: passed ? 'low' : 'high',
      recommendations: passed
        ? []
        : [
            'Implement rate limiting for API endpoints',
            'Add progressive delays for repeated violations',
            'Monitor for DDoS attack patterns',
          ],
    });
  }

  /**
   * CSRF保護テスト
   */
  private async testCSRFProtection(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'CSRF Protection Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'high',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    const sessionId = `test-session-${Date.now()}`;

    try {
      // Generate valid token
      const validToken = await this.securityManager.generateCSRFToken(sessionId);
      const validResult = await this.securityManager.validateCSRFToken(sessionId, validToken);

      // Test invalid token
      const invalidResult = await this.securityManager.validateCSRFToken(
        sessionId,
        'invalid-token'
      );

      // Test missing token
      const missingResult = await this.securityManager.validateCSRFToken(sessionId, '');

      const passed = validResult && !invalidResult && !missingResult;
      this.results.push({
        testName: 'CSRF Token Validation',
        passed,
        details: `Valid token: ${validResult}, Invalid token rejected: ${!invalidResult}, Missing token rejected: ${!missingResult}`,
        severity: passed ? 'low' : 'high',
        recommendations: passed
          ? []
          : [
              'Fix CSRF token generation and validation',
              'Ensure tokens are properly invalidated',
              'Add CSRF protection to all state-changing operations',
            ],
      });
    } catch (error) {
      this.results.push({
        testName: 'CSRF Token Validation',
        passed: false,
        details: `CSRF test failed: ${error.message}`,
        severity: 'high',
        recommendations: ['Fix CSRF implementation'],
      });
    }
  }

  /**
   * 入力検証テスト
   */
  private async testInputValidation(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'Input Validation Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'high',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    const testCases = [
      {
        field: 'email',
        input: 'valid@example.com',
        shouldPass: true,
      },
      {
        field: 'email',
        input: 'invalid-email',
        shouldPass: false,
      },
      {
        field: 'name',
        input: 'John Doe',
        shouldPass: true,
      },
      {
        field: 'name',
        input: '<script>alert("XSS")</script>',
        shouldPass: false,
      },
      {
        field: 'password',
        input: 'ValidP@ssw0rd123',
        shouldPass: true,
      },
      {
        field: 'password',
        input: 'weak',
        shouldPass: false,
      },
    ];

    let passedTests = 0;
    const totalTests = testCases.length;

    for (const testCase of testCases) {
      const result = this.securityManager.validateUserInput(testCase.field, testCase.input);
      const actualResult = result.isValid;

      if (actualResult === testCase.shouldPass) {
        passedTests++;
      }
    }

    const passed = passedTests === totalTests;
    this.results.push({
      testName: 'Input Validation',
      passed,
      details: `${passedTests}/${totalTests} validation tests passed`,
      severity: passed ? 'low' : 'high',
      recommendations: passed
        ? []
        : [
            'Review and strengthen input validation rules',
            'Add validation for all user inputs',
            'Implement proper error messages for validation failures',
          ],
    });
  }

  /**
   * セキュリティヘッダーテスト
   */
  private async testSecurityHeaders(): Promise<void> {
    try {
      const response = await this.makeRequest('/health');
      const headers = response.headers;

      const expectedHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];

      const presentHeaders = expectedHeaders.filter((header) => headers[header]);
      const passed = presentHeaders.length >= expectedHeaders.length * 0.5; // At least 50%

      this.results.push({
        testName: 'Security Headers',
        passed,
        details: `${presentHeaders.length}/${expectedHeaders.length} security headers present`,
        severity: passed ? 'low' : 'medium',
        recommendations: passed
          ? []
          : [
              'Add missing security headers',
              'Implement Content Security Policy',
              'Add Strict-Transport-Security header for HTTPS',
            ],
      });
    } catch (error) {
      this.results.push({
        testName: 'Security Headers',
        passed: false,
        details: `Failed to check headers: ${error.message}`,
        severity: 'medium',
        recommendations: ['Ensure server is responding properly'],
      });
    }
  }

  /**
   * セッションセキュリティテスト
   */
  private async testSessionSecurity(): Promise<void> {
    if (!this.securityManager) {
      this.results.push({
        testName: 'Session Security Test',
        passed: false,
        details: 'Security manager not available',
        severity: 'medium',
        recommendations: ['Enable Redis for security testing'],
      });
      return;
    }

    try {
      const oldSessionId = 'old-session-123';
      const newSessionId = await this.securityManager.regenerateSession(oldSessionId);

      const passed = newSessionId !== oldSessionId && newSessionId.length > 20;

      this.results.push({
        testName: 'Session Regeneration',
        passed,
        details: `Session regenerated: ${passed ? 'Yes' : 'No'}`,
        severity: passed ? 'low' : 'medium',
        recommendations: passed
          ? []
          : [
              'Implement proper session regeneration',
              'Ensure session IDs are cryptographically secure',
              'Regenerate sessions on privilege changes',
            ],
      });
    } catch (error) {
      this.results.push({
        testName: 'Session Regeneration',
        passed: false,
        details: `Session test failed: ${error.message}`,
        severity: 'medium',
        recommendations: ['Fix session management implementation'],
      });
    }
  }

  /**
   * HTTPリクエスト実行
   */
  private async makeRequest(endpoint: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.testTimeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 結果出力
   */
  private printResults(): void {
    console.log('\n🛡️ Security Test Results:');
    console.log('=====================================');

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(2);

    console.log(`Overall: ${passed}/${total} tests passed (${passRate}%)\n`);

    // Group by severity
    const critical = this.results.filter((r) => !r.passed && r.severity === 'critical');
    const high = this.results.filter((r) => !r.passed && r.severity === 'high');
    const medium = this.results.filter((r) => !r.passed && r.severity === 'medium');
    const low = this.results.filter((r) => !r.passed && r.severity === 'low');

    if (critical.length > 0) {
      console.log('🚨 CRITICAL Issues:');
      critical.forEach((result) => {
        console.log(`  ❌ ${result.testName}: ${result.details}`);
        result.recommendations?.forEach((rec) => console.log(`    🔧 ${rec}`));
      });
      console.log();
    }

    if (high.length > 0) {
      console.log('⚠️ HIGH Priority Issues:');
      high.forEach((result) => {
        console.log(`  ❌ ${result.testName}: ${result.details}`);
        result.recommendations?.forEach((rec) => console.log(`    🔧 ${rec}`));
      });
      console.log();
    }

    if (medium.length > 0) {
      console.log('⚡ MEDIUM Priority Issues:');
      medium.forEach((result) => {
        console.log(`  ❌ ${result.testName}: ${result.details}`);
        result.recommendations?.forEach((rec) => console.log(`    🔧 ${rec}`));
      });
      console.log();
    }

    if (low.length > 0) {
      console.log('💡 LOW Priority Issues:');
      low.forEach((result) => {
        console.log(`  ❌ ${result.testName}: ${result.details}`);
        result.recommendations?.forEach((rec) => console.log(`    🔧 ${rec}`));
      });
      console.log();
    }

    // Passed tests
    const passedTests = this.results.filter((r) => r.passed);
    if (passedTests.length > 0) {
      console.log('✅ Passed Tests:');
      passedTests.forEach((result) => {
        console.log(`  ✅ ${result.testName}: ${result.details}`);
      });
      console.log();
    }

    // Security score
    const securityScore = this.calculateSecurityScore();
    console.log(`🏆 Security Score: ${securityScore}/100`);

    if (securityScore >= 90) {
      console.log('🎉 Excellent security posture!');
    } else if (securityScore >= 70) {
      console.log('👍 Good security, minor improvements needed');
    } else if (securityScore >= 50) {
      console.log('⚠️ Moderate security, several issues to address');
    } else {
      console.log('🚨 Poor security, immediate attention required');
    }
  }

  /**
   * セキュリティスコア計算
   */
  private calculateSecurityScore(): number {
    let score = 100;

    this.results.forEach((result) => {
      if (!result.passed) {
        switch (result.severity) {
          case 'critical':
            score -= 25;
            break;
          case 'high':
            score -= 15;
            break;
          case 'medium':
            score -= 10;
            break;
          case 'low':
            score -= 5;
            break;
        }
      }
    });

    return Math.max(0, score);
  }
}

// メイン実行
async function main() {
  const config: SecurityTestConfig = {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    testTimeout: parseInt(process.env.TEST_TIMEOUT || '10000'),
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  };

  console.log('🔒 Security Testing Suite Starting...');
  console.log('=====================================');
  console.log(`Target URL: ${config.baseUrl}`);
  console.log(`Test Timeout: ${config.testTimeout}ms`);
  console.log(`Redis URL: ${config.redisUrl}`);
  console.log('=====================================\n');

  const tester = new SecurityTester(config);

  try {
    await tester.runAllTests();
    console.log('\n✅ Security testing completed');
  } catch (error) {
    console.error('Security test failed:', error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
