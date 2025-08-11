/**
 * Load Testing Suite
 * Infrastructure-specialist による負荷テスト実装
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { io as Client } from 'socket.io-client';

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDuration: number; // seconds
  messageInterval: number; // milliseconds
  rampUpTime: number; // seconds
}

interface TestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  websocketConnections: number;
  websocketMessages: number;
  websocketErrors: number;
  errors: string[];
}

class LoadTester {
  private config: LoadTestConfig;
  private results: TestResults;
  private clients: ReturnType<typeof Client>[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private responseTimes: number[] = [];

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      websocketConnections: 0,
      websocketMessages: 0,
      websocketErrors: 0,
      errors: [],
    };
  }

  /**
   * HTTP リクエスト負荷テスト
   */
  async runHttpLoadTest(): Promise<void> {
    console.log('🚀 Starting HTTP Load Test...');
    console.log(
      `Config: ${this.config.concurrentUsers} users, ${this.config.testDuration}s duration`
    );

    const endpoints = ['/health', '/api/health', '/api/chat/rooms'];

    this.startTime = Date.now();
    const promises: Promise<void>[] = [];

    // Ramp-up pattern: gradually increase load
    const rampUpInterval = (this.config.rampUpTime * 1000) / this.config.concurrentUsers;

    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const delay = i * rampUpInterval;

      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.simulateUser(endpoints).then(resolve);
          }, delay);
        })
      );
    }

    // Wait for all users to complete
    await Promise.all(promises);
    this.endTime = Date.now();

    this.calculateResults();
    this.printHttpResults();
  }

  /**
   * WebSocket 負荷テスト
   */
  async runWebSocketLoadTest(): Promise<void> {
    console.log('🔌 Starting WebSocket Load Test...');

    const promises: Promise<void>[] = [];
    const rampUpInterval = (this.config.rampUpTime * 1000) / this.config.concurrentUsers;

    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const delay = i * rampUpInterval;

      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.simulateWebSocketUser(i).then(resolve);
          }, delay);
        })
      );
    }

    await Promise.all(promises);
    this.printWebSocketResults();
  }

  /**
   * 単一ユーザーのHTTPリクエストシミュレーション
   */
  private async simulateUser(endpoints: string[]): Promise<void> {
    const endTime = Date.now() + this.config.testDuration * 1000;

    while (Date.now() < endTime) {
      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          await this.makeRequest(endpoint);
          const responseTime = Date.now() - startTime;

          this.results.totalRequests++;
          this.results.successfulRequests++;
          this.responseTimes.push(responseTime);
          this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
          this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
        } catch (error) {
          this.results.totalRequests++;
          this.results.failedRequests++;
          this.results.errors.push(error.message);
        }

        // Small delay between requests from same user
        await this.sleep(100);
      }

      // Wait before next cycle
      await this.sleep(1000);
    }
  }

  /**
   * 単一WebSocketユーザーのシミュレーション
   */
  private async simulateWebSocketUser(userId: number): Promise<void> {
    return new Promise((resolve) => {
      const socket = Client(this.config.baseUrl, {
        transports: ['websocket'],
        timeout: 5000,
      });

      let connected = false;
      let messagesSent = 0;
      const roomId = `room${(userId % 3) + 1}`; // Distribute across 3 rooms

      socket.on('connect', () => {
        console.log(`WebSocket ${userId} connected`);
        connected = true;
        this.results.websocketConnections++;

        // Join a room
        socket.emit('join-room', roomId);

        // Send periodic messages
        const messageInterval = setInterval(() => {
          if (connected) {
            socket.emit('send-message', {
              roomId,
              message: `Test message ${messagesSent} from user ${userId}`,
              userId: `user_${userId}`,
            });
            messagesSent++;
            this.results.websocketMessages++;
          } else {
            clearInterval(messageInterval);
          }
        }, this.config.messageInterval);

        // Disconnect after test duration
        setTimeout(() => {
          connected = false;
          clearInterval(messageInterval);
          socket.disconnect();
          resolve();
        }, this.config.testDuration * 1000);
      });

      socket.on('connect_error', (error) => {
        console.error(`WebSocket ${userId} connection error:`, error.message);
        this.results.websocketErrors++;
        resolve();
      });

      socket.on('disconnect', () => {
        console.log(`WebSocket ${userId} disconnected`);
        connected = false;
      });

      socket.on('new-message', (_data) => {
        // Handle incoming messages (for realistic simulation)
        // console.log(`User ${userId} received message:`, data);
      });

      // Store reference for cleanup
      this.clients.push(socket);
    });
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
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 結果計算
   */
  private calculateResults(): void {
    if (this.responseTimes.length > 0) {
      this.results.averageResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    const durationSeconds = (this.endTime - this.startTime) / 1000;
    this.results.requestsPerSecond = this.results.totalRequests / durationSeconds;
  }

  /**
   * HTTP結果出力
   */
  private printHttpResults(): void {
    console.log('\n📊 HTTP Load Test Results:');
    console.log('=====================================');
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(
      `Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%)`
    );
    console.log(
      `Failed: ${this.results.failedRequests} (${((this.results.failedRequests / this.results.totalRequests) * 100).toFixed(2)}%)`
    );
    console.log(`Requests/Second: ${this.results.requestsPerSecond.toFixed(2)}`);
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${this.results.minResponseTime}ms`);
    console.log(`Max Response Time: ${this.results.maxResponseTime}ms`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      const errorCounts = this.results.errors.reduce(
        (acc, error) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  ${error}: ${count} occurrences`);
      });
    }
  }

  /**
   * WebSocket結果出力
   */
  private printWebSocketResults(): void {
    console.log('\n🔌 WebSocket Load Test Results:');
    console.log('=====================================');
    console.log(`Connections: ${this.results.websocketConnections}`);
    console.log(`Messages Sent: ${this.results.websocketMessages}`);
    console.log(`Connection Errors: ${this.results.websocketErrors}`);
    console.log(
      `Success Rate: ${((this.results.websocketConnections / this.config.concurrentUsers) * 100).toFixed(2)}%`
    );
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.clients.forEach((client) => {
      if (client?.connected) {
        client.disconnect();
      }
    });
    this.clients = [];
  }

  /**
   * スリープユーティリティ
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// メイン実行
async function main() {
  const config: LoadTestConfig = {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '50'),
    testDuration: parseInt(process.env.TEST_DURATION || '30'),
    messageInterval: parseInt(process.env.MESSAGE_INTERVAL || '2000'),
    rampUpTime: parseInt(process.env.RAMP_UP_TIME || '10'),
  };

  console.log('🏋️ Load Testing Suite Starting...');
  console.log('=====================================');
  console.log(`Target URL: ${config.baseUrl}`);
  console.log(`Concurrent Users: ${config.concurrentUsers}`);
  console.log(`Test Duration: ${config.testDuration} seconds`);
  console.log(`Ramp-up Time: ${config.rampUpTime} seconds`);
  console.log('=====================================\n');

  const tester = new LoadTester(config);

  try {
    // Run HTTP load test
    await tester.runHttpLoadTest();

    console.log('\nWaiting 5 seconds before WebSocket test...\n');
    await tester.sleep(5000);

    // Run WebSocket load test
    await tester.runWebSocketLoadTest();

    tester.printPerformanceStats();
  } catch (error) {
    console.error('Load test failed:', error);
  } finally {
    tester.cleanup();
    console.log('\n✅ Load testing completed');
    process.exit(0);
  }
}

// 実行時エラーハンドリング
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
