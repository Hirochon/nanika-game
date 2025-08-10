# パフォーマンス計測・監視

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトのパフォーマンス計測・監視戦略について詳述します。Lighthouse、Web Vitals、Real User Monitoring（RUM）、Application Performance Monitoring（APM）を統合した包括的な監視システムにより、継続的なパフォーマンス改善とユーザー体験最適化を実現します。

## 現在の実装状況

- **基本メトリクス収集**: Web Vitals API による Core Web Vitals 測定
- **開発時測定**: Lighthouse CI による自動監査
- **エラー監視**: JavaScript エラーの基本的な捕捉と記録
- **アナリティクス**: Google Analytics による基本的なパフォーマンストラッキング

## パフォーマンス測定アーキテクチャ

### 1. 測定レイヤー構成

```mermaid
graph TD
    A[ブラウザ側測定] --> D[データ収集API]
    B[サーバー側測定] --> D
    C[外部監視サービス] --> D
    
    A --> A1[Web Vitals]
    A --> A2[Custom Metrics]
    A --> A3[Error Tracking]
    A --> A4[User Journey]
    
    B --> B1[Response Time]
    B --> B2[Database Queries]
    B --> B3[API Performance]
    B --> B4[Resource Usage]
    
    C --> C1[Lighthouse CI]
    C --> C2[Uptime Monitoring]
    C --> C3[Synthetic Testing]
    
    D --> E[データ処理・分析]
    E --> F[ダッシュボード・アラート]
    E --> G[レポート生成]
    
    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
```

### 2. Core Web Vitals 測定システム

```typescript
// app/web/utils/performance/web-vitals-monitor.ts

export class WebVitalsMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.initializeObservers();
  }

  // Web Vitals の初期化と監視開始
  private initializeObservers(): void {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();
    this.observeCustomMetrics();
  }

  // Largest Contentful Paint の監視
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        const metric: PerformanceMetric = {
          name: 'LCP',
          value: lastEntry.startTime,
          rating: this.rateLCP(lastEntry.startTime),
          timestamp: Date.now(),
          url: window.location.href,
          element: lastEntry.element?.tagName || 'unknown'
        };
        
        this.recordMetric(metric);
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.set('lcp', observer);
    } catch (error) {
      console.warn('LCP observation not supported:', error);
    }
  }

  // First Input Delay の監視
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const metric: PerformanceMetric = {
            name: 'FID',
            value: entry.processingStart - entry.startTime,
            rating: this.rateFID(entry.processingStart - entry.startTime),
            timestamp: Date.now(),
            url: window.location.href,
            eventType: entry.name
          };
          
          this.recordMetric(metric);
        });
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.set('fid', observer);
    } catch (error) {
      console.warn('FID observation not supported:', error);
    }
  }

  // Cumulative Layout Shift の監視
  private observeCLS(): void {
    try {
      let clsValue = 0;
      let sessionValue = 0;
      let sessionEntries: any[] = [];

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            // セッションギャップが5秒以上または総セッション時間が5秒以上の場合、新しいセッションを開始
            if (sessionValue &&
                (entry.startTime - lastSessionEntry.startTime > 5000 ||
                 entry.startTime - firstSessionEntry.startTime > 5000)) {
              clsValue = Math.max(clsValue, sessionValue);
              sessionValue = 0;
              sessionEntries = [];
            }

            sessionValue += entry.value;
            sessionEntries.push(entry);
          }
        });

        // 最終的なCLS値を記録
        clsValue = Math.max(clsValue, sessionValue);
        
        const metric: PerformanceMetric = {
          name: 'CLS',
          value: clsValue,
          rating: this.rateCLS(clsValue),
          timestamp: Date.now(),
          url: window.location.href
        };
        
        this.recordMetric(metric);
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('cls', observer);
    } catch (error) {
      console.warn('CLS observation not supported:', error);
    }
  }

  // First Contentful Paint の監視
  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name === 'first-contentful-paint') {
            const metric: PerformanceMetric = {
              name: 'FCP',
              value: entry.startTime,
              rating: this.rateFCP(entry.startTime),
              timestamp: Date.now(),
              url: window.location.href
            };
            
            this.recordMetric(metric);
          }
        });
      });
      
      observer.observe({ entryTypes: ['paint'] });
      this.observers.set('fcp', observer);
    } catch (error) {
      console.warn('FCP observation not supported:', error);
    }
  }

  // Time to First Byte の監視
  private observeTTFB(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.entryType === 'navigation') {
            const ttfb = entry.responseStart - entry.requestStart;
            
            const metric: PerformanceMetric = {
              name: 'TTFB',
              value: ttfb,
              rating: this.rateTTFB(ttfb),
              timestamp: Date.now(),
              url: window.location.href
            };
            
            this.recordMetric(metric);
          }
        });
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.set('ttfb', observer);
    } catch (error) {
      console.warn('TTFB observation not supported:', error);
    }
  }

  // カスタムメトリクスの監視
  private observeCustomMetrics(): void {
    // リソース読み込み時間
    this.observeResourceTiming();
    
    // API レスポンス時間
    this.observeAPIPerformance();
    
    // ユーザーインタラクション時間
    this.observeInteractionTiming();
  }

  private observeResourceTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          // 大きなリソースや遅いリソースのみ記録
          if (entry.transferSize > 100000 || entry.duration > 1000) { // 100KB以上 or 1秒以上
            const metric: PerformanceMetric = {
              name: 'RESOURCE_TIMING',
              value: entry.duration,
              rating: entry.duration > 2000 ? 'poor' : entry.duration > 1000 ? 'needs-improvement' : 'good',
              timestamp: Date.now(),
              url: window.location.href,
              resourceUrl: entry.name,
              resourceType: entry.initiatorType,
              resourceSize: entry.transferSize
            };
            
            this.recordMetric(metric);
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', observer);
    } catch (error) {
      console.warn('Resource timing observation not supported:', error);
    }
  }

  private observeAPIPerformance(): void {
    // Fetch API のインターセプト
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0] instanceof Request ? args[0].url : args[0];
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // API呼び出しのメトリクスを記録
        if (typeof url === 'string' && url.includes('/api/')) {
          const metric: PerformanceMetric = {
            name: 'API_RESPONSE_TIME',
            value: duration,
            rating: duration > 2000 ? 'poor' : duration > 1000 ? 'needs-improvement' : 'good',
            timestamp: Date.now(),
            url: window.location.href,
            apiUrl: url,
            status: response.status
          };
          
          this.recordMetric(metric);
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const metric: PerformanceMetric = {
          name: 'API_ERROR',
          value: duration,
          rating: 'poor',
          timestamp: Date.now(),
          url: window.location.href,
          apiUrl: url,
          error: error.message
        };
        
        this.recordMetric(metric);
        throw error;
      }
    };
  }

  private observeInteractionTiming(): void {
    const interactionEvents = ['click', 'keydown', 'touchstart'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        const startTime = performance.now();
        
        // マイクロタスクで測定（イベントハンドラー完了後）
        Promise.resolve().then(() => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // 遅いインタラクションのみ記録
          if (duration > 100) { // 100ms以上
            const metric: PerformanceMetric = {
              name: 'INTERACTION_TIMING',
              value: duration,
              rating: duration > 300 ? 'poor' : duration > 100 ? 'needs-improvement' : 'good',
              timestamp: Date.now(),
              url: window.location.href,
              eventType,
              target: (event.target as Element)?.tagName || 'unknown'
            };
            
            this.recordMetric(metric);
          }
        });
      }, { passive: true });
    });
  }

  // メトリクスの記録
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.set(`${metric.name}_${Date.now()}`, metric);
    
    // リアルタイム送信（バッチ処理で最適化）
    this.sendMetricToServer(metric);
    
    // ローカルストレージへの保存（オフライン対応）
    this.saveMetricLocally(metric);
    
    // コンソールログ（開発時）
    if (this.config.debug) {
      console.log(`Performance Metric - ${metric.name}:`, metric);
    }
  }

  // 評価関数群
  private rateLCP(value: number): MetricRating {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private rateFID(value: number): MetricRating {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private rateCLS(value: number): MetricRating {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private rateFCP(value: number): MetricRating {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private rateTTFB(value: number): MetricRating {
    if (value <= 800) return 'good';
    if (value <= 1800) return 'needs-improvement';
    return 'poor';
  }

  // サーバーへのメトリクス送信
  private async sendMetricToServer(metric: PerformanceMetric): Promise<void> {
    try {
      if (navigator.sendBeacon) {
        // ページ離脱時でも確実に送信
        navigator.sendBeacon(
          this.config.endpointUrl,
          JSON.stringify(metric)
        );
      } else {
        // フォールバック
        fetch(this.config.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metric),
          keepalive: true
        }).catch(error => {
          console.warn('Failed to send metric:', error);
        });
      }
    } catch (error) {
      console.warn('Failed to send metric to server:', error);
    }
  }

  // ローカルストレージ保存
  private saveMetricLocally(metric: PerformanceMetric): void {
    try {
      const key = 'performance_metrics';
      const stored = localStorage.getItem(key);
      const metrics = stored ? JSON.parse(stored) : [];
      
      metrics.push(metric);
      
      // 最新100件のみ保持
      if (metrics.length > 100) {
        metrics.splice(0, metrics.length - 100);
      }
      
      localStorage.setItem(key, JSON.stringify(metrics));
    } catch (error) {
      console.warn('Failed to save metric locally:', error);
    }
  }

  // 監視の停止
  public stop(): void {
    this.observers.forEach((observer, key) => {
      observer.disconnect();
    });
    this.observers.clear();
  }

  // 統計情報の取得
  public getStats(): PerformanceStats {
    const metricsByName = new Map<string, PerformanceMetric[]>();
    
    for (const metric of this.metrics.values()) {
      if (!metricsByName.has(metric.name)) {
        metricsByName.set(metric.name, []);
      }
      metricsByName.get(metric.name)!.push(metric);
    }

    const stats: PerformanceStats = {
      totalMetrics: this.metrics.size,
      metricsByName: {},
      lastUpdated: Date.now()
    };

    for (const [name, metrics] of metricsByName) {
      const values = metrics.map(m => m.value);
      stats.metricsByName[name] = {
        count: metrics.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: metrics[metrics.length - 1]
      };
    }

    return stats;
  }
}

// 型定義
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: MetricRating;
  timestamp: number;
  url: string;
  element?: string;
  eventType?: string;
  resourceUrl?: string;
  resourceType?: string;
  resourceSize?: number;
  apiUrl?: string;
  status?: number;
  error?: string;
  target?: string;
}

export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface MonitoringConfig {
  endpointUrl: string;
  debug: boolean;
  sampleRate?: number;
}

export interface PerformanceStats {
  totalMetrics: number;
  metricsByName: Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    latest: PerformanceMetric;
  }>;
  lastUpdated: number;
}
```

### 3. Real User Monitoring（RUM）

```typescript
// app/web/utils/performance/rum-monitor.ts

export class RealUserMonitor {
  private config: RUMConfig;
  private sessionId: string;
  private userId?: string;
  private userJourney: UserJourneyEvent[] = [];
  private deviceInfo: DeviceInfo;
  private networkInfo: NetworkInfo;

  constructor(config: RUMConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.deviceInfo = this.collectDeviceInfo();
    this.networkInfo = this.collectNetworkInfo();
    
    this.initializeTracking();
  }

  // トラッキング初期化
  private initializeTracking(): void {
    this.trackPageViews();
    this.trackUserInteractions();
    this.trackErrors();
    this.trackPerformanceIssues();
    this.trackCustomEvents();
    this.setupPeriodicReporting();
  }

  // ページビュー追跡
  private trackPageViews(): void {
    // 初期ページロード
    this.recordPageView('load');

    // SPAルート変更の追跡
    this.setupSPATracking();
    
    // ページ離脱の追跡
    this.trackPageExit();
  }

  private setupSPATracking(): void {
    // History API の変更を監視
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.recordPageView('navigation');
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.recordPageView('navigation');
    };

    // popstate イベント
    window.addEventListener('popstate', () => {
      this.recordPageView('back_forward');
    });
  }

  private recordPageView(type: 'load' | 'navigation' | 'back_forward'): void {
    const event: UserJourneyEvent = {
      type: 'page_view',
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer,
      viewportSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      navigationTiming: this.getNavigationTiming(),
      navigationType: type
    };

    this.addToUserJourney(event);
  }

  // ユーザーインタラクション追跡
  private trackUserInteractions(): void {
    const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.recordInteraction(eventType, event);
      }, { passive: true, capture: true });
    });

    // フォームサブミット
    document.addEventListener('submit', (event) => {
      this.recordFormSubmission(event);
    }, { passive: true });

    // フォーカスの変更
    document.addEventListener('focusin', (event) => {
      this.recordFocusChange(event, 'focus');
    }, { passive: true });

    document.addEventListener('focusout', (event) => {
      this.recordFocusChange(event, 'blur');
    }, { passive: true });
  }

  private recordInteraction(type: string, event: Event): void {
    const target = event.target as Element;
    
    const interactionEvent: UserJourneyEvent = {
      type: 'interaction',
      timestamp: Date.now(),
      url: window.location.href,
      interactionType: type,
      element: {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        textContent: target.textContent?.substring(0, 100) || '',
        xpath: this.getElementXPath(target)
      },
      position: 'mouseEvent' in event ? {
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY
      } : undefined
    };

    this.addToUserJourney(interactionEvent);
  }

  // エラー追跡
  private trackErrors(): void {
    // JavaScript エラー
    window.addEventListener('error', (event) => {
      const errorEvent: UserJourneyEvent = {
        type: 'error',
        timestamp: Date.now(),
        url: window.location.href,
        error: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      };

      this.addToUserJourney(errorEvent);
    });

    // Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      const errorEvent: UserJourneyEvent = {
        type: 'error',
        timestamp: Date.now(),
        url: window.location.href,
        error: {
          message: event.reason?.message || 'Unhandled promise rejection',
          stack: event.reason?.stack,
          type: 'unhandled_rejection'
        }
      };

      this.addToUserJourney(errorEvent);
    });

    // リソース読み込みエラー
    document.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as Element;
        const errorEvent: UserJourneyEvent = {
          type: 'error',
          timestamp: Date.now(),
          url: window.location.href,
          error: {
            message: `Resource load error: ${target.tagName}`,
            resourceUrl: (target as any).src || (target as any).href,
            type: 'resource_error'
          }
        };

        this.addToUserJourney(errorEvent);
      }
    }, true);
  }

  // パフォーマンス問題の追跡
  private trackPerformanceIssues(): void {
    // 長時間タスクの監視
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const performanceEvent: UserJourneyEvent = {
            type: 'performance_issue',
            timestamp: Date.now(),
            url: window.location.href,
            performance: {
              type: 'long_task',
              duration: entry.duration,
              startTime: entry.startTime,
              attribution: entry.attribution
            }
          };

          this.addToUserJourney(performanceEvent);
        });
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Long task observation not supported:', error);
    }

    // メモリ使用量の監視
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          const memoryUsage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
          
          // メモリ使用量が90%を超えた場合
          if (memoryUsage > 0.9) {
            const performanceEvent: UserJourneyEvent = {
              type: 'performance_issue',
              timestamp: Date.now(),
              url: window.location.href,
              performance: {
                type: 'high_memory_usage',
                memoryUsage: memoryUsage,
                usedJSHeapSize: memInfo.usedJSHeapSize,
                totalJSHeapSize: memInfo.totalJSHeapSize
              }
            };

            this.addToUserJourney(performanceEvent);
          }
        }
      }, 30000); // 30秒毎
    }
  }

  // カスタムイベント追跡
  private trackCustomEvents(): void {
    // カスタムイベントリスナー
    document.addEventListener('custom-performance-event', (event: CustomEvent) => {
      const customEvent: UserJourneyEvent = {
        type: 'custom',
        timestamp: Date.now(),
        url: window.location.href,
        custom: {
          name: event.detail.name,
          value: event.detail.value,
          metadata: event.detail.metadata
        }
      };

      this.addToUserJourney(customEvent);
    });
  }

  // 定期レポート送信
  private setupPeriodicReporting(): void {
    // 30秒毎にバッチ送信
    setInterval(() => {
      if (this.userJourney.length > 0) {
        this.sendBatchReport();
      }
    }, 30000);

    // ページ離脱時の最終送信
    window.addEventListener('beforeunload', () => {
      this.sendBatchReport(true);
    });

    // ページが隠れた時の送信
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendBatchReport();
      }
    });
  }

  // ユーザージャーニーへの追加
  private addToUserJourney(event: UserJourneyEvent): void {
    this.userJourney.push(event);
    
    // バッファサイズ制限
    if (this.userJourney.length > this.config.maxEventsBuffer) {
      this.userJourney.splice(0, this.userJourney.length - this.config.maxEventsBuffer);
    }
  }

  // バッチレポート送信
  private async sendBatchReport(isBeforeUnload = false): Promise<void> {
    if (this.userJourney.length === 0) return;

    const report: RUMReport = {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      url: window.location.href,
      deviceInfo: this.deviceInfo,
      networkInfo: this.networkInfo,
      events: [...this.userJourney] // コピーを作成
    };

    try {
      if (isBeforeUnload && navigator.sendBeacon) {
        // ページ離脱時は確実に送信
        navigator.sendBeacon(
          this.config.endpointUrl,
          JSON.stringify(report)
        );
      } else {
        await fetch(this.config.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
          keepalive: true
        });
      }

      // 送信成功したらクリア
      this.userJourney.length = 0;
    } catch (error) {
      console.warn('Failed to send RUM report:', error);
    }
  }

  // デバイス情報収集
  private collectDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  // ネットワーク情報収集
  private collectNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection;
    
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    };
  }

  // ヘルパーメソッド
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2);
  }

  private getNavigationTiming(): NavigationTimingInfo | null {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      return {
        fetchStart: navigation.fetchStart,
        domainLookupStart: navigation.domainLookupStart,
        domainLookupEnd: navigation.domainLookupEnd,
        connectStart: navigation.connectStart,
        connectEnd: navigation.connectEnd,
        requestStart: navigation.requestStart,
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        domContentLoadedEventStart: navigation.domContentLoadedEventStart,
        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
        loadEventStart: navigation.loadEventStart,
        loadEventEnd: navigation.loadEventEnd
      };
    }

    return null;
  }

  private getElementXPath(element: Element): string {
    if (element.id) {
      return `//*[@id='${element.id}']`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.nodeName.toLowerCase();
      parts.unshift(`${tagName}[${index + 1}]`);
      current = current.parentNode as Element;

      if (current === document.body) break;
    }

    return '/' + parts.join('/');
  }

  // パブリックメソッド
  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public trackCustomEvent(name: string, value?: any, metadata?: Record<string, any>): void {
    document.dispatchEvent(new CustomEvent('custom-performance-event', {
      detail: { name, value, metadata }
    }));
  }

  public getSessionSummary(): SessionSummary {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      duration: Date.now() - parseInt(this.sessionId.split('_')[1]),
      eventCount: this.userJourney.length,
      pageViews: this.userJourney.filter(e => e.type === 'page_view').length,
      interactions: this.userJourney.filter(e => e.type === 'interaction').length,
      errors: this.userJourney.filter(e => e.type === 'error').length
    };
  }
}

// 型定義
export interface RUMConfig {
  endpointUrl: string;
  maxEventsBuffer: number;
  sampleRate: number;
}

export interface UserJourneyEvent {
  type: 'page_view' | 'interaction' | 'error' | 'performance_issue' | 'custom';
  timestamp: number;
  url: string;
  referrer?: string;
  viewportSize?: { width: number; height: number };
  navigationTiming?: NavigationTimingInfo;
  navigationType?: 'load' | 'navigation' | 'back_forward';
  interactionType?: string;
  element?: {
    tagName: string;
    id: string;
    className: string;
    textContent: string;
    xpath: string;
  };
  position?: { x: number; y: number };
  error?: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    resourceUrl?: string;
    type?: string;
  };
  performance?: {
    type: string;
    duration?: number;
    startTime?: number;
    attribution?: any;
    memoryUsage?: number;
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
  };
  custom?: {
    name: string;
    value?: any;
    metadata?: Record<string, any>;
  };
}

export interface RUMReport {
  sessionId: string;
  userId?: string;
  timestamp: number;
  url: string;
  deviceInfo: DeviceInfo;
  networkInfo: NetworkInfo;
  events: UserJourneyEvent[];
}

export interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  onLine: boolean;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  timezone: string;
}

export interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface NavigationTimingInfo {
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  loadEventStart: number;
  loadEventEnd: number;
}

export interface SessionSummary {
  sessionId: string;
  userId?: string;
  duration: number;
  eventCount: number;
  pageViews: number;
  interactions: number;
  errors: number;
}
```

## Application Performance Monitoring（APM）

### 1. サーバーサイドAPM

```typescript
// app/infrastructure/monitoring/apm-monitor.ts
import { PrismaClient } from '@prisma/client';

export class APMMonitor {
  private metrics: Map<string, MetricCollector> = new Map();
  private activeTransactions: Map<string, Transaction> = new Map();

  // HTTP リクエスト監視
  static createHTTPMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = process.hrtime();
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const transaction: Transaction = {
        id: transactionId,
        type: 'http_request',
        name: `${req.method} ${req.route?.path || req.url}`,
        startTime: Date.now(),
        context: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id
        }
      };

      // トランザクション開始
      const monitor = APMMonitor.getInstance();
      monitor.startTransaction(transaction);

      // レスポンス完了時の処理
      res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        transaction.duration = duration;
        transaction.endTime = Date.now();
        transaction.context.statusCode = res.statusCode;
        transaction.context.responseSize = parseInt(res.get('Content-Length') || '0');

        monitor.endTransaction(transactionId);

        // スロークエリやエラーの記録
        if (duration > 5000 || res.statusCode >= 400) {
          monitor.recordSlowOrErrorTransaction(transaction);
        }
      });

      next();
    };
  }

  // データベースクエリ監視
  static instrumentPrisma(prisma: PrismaClient): PrismaClient {
    const monitor = APMMonitor.getInstance();

    return new Proxy(prisma, {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);
        
        if (typeof originalMethod === 'object' && originalMethod !== null) {
          // モデル操作の監視
          return new Proxy(originalMethod, {
            get(modelTarget, modelProp, modelReceiver) {
              const originalModelMethod = Reflect.get(modelTarget, modelProp, modelReceiver);
              
              if (typeof originalModelMethod === 'function') {
                return async (...args: any[]) => {
                  const queryStartTime = process.hrtime();
                  const operation = `${String(prop)}.${String(modelProp)}`;
                  
                  try {
                    const result = await originalModelMethod.apply(modelTarget, args);
                    const [seconds, nanoseconds] = process.hrtime(queryStartTime);
                    const duration = seconds * 1000 + nanoseconds / 1000000;

                    monitor.recordDatabaseQuery({
                      operation,
                      duration,
                      args: JSON.stringify(args).substring(0, 1000), // 最初の1000文字のみ
                      timestamp: Date.now()
                    });

                    return result;
                  } catch (error) {
                    const [seconds, nanoseconds] = process.hrtime(queryStartTime);
                    const duration = seconds * 1000 + nanoseconds / 1000000;

                    monitor.recordDatabaseError({
                      operation,
                      duration,
                      error: error.message,
                      args: JSON.stringify(args).substring(0, 1000),
                      timestamp: Date.now()
                    });

                    throw error;
                  }
                };
              }
              
              return originalModelMethod;
            }
          });
        }
        
        return originalMethod;
      }
    });
  }

  // メトリクス収集
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, new MetricCollector(name));
    }

    const collector = this.metrics.get(name)!;
    collector.record(value, labels);
  }

  // システムメトリクスの収集
  collectSystemMetrics(): void {
    setInterval(() => {
      // CPU使用率
      const cpuUsage = process.cpuUsage();
      this.recordMetric('cpu_usage_user', cpuUsage.user / 1000); // マイクロ秒からミリ秒
      this.recordMetric('cpu_usage_system', cpuUsage.system / 1000);

      // メモリ使用量
      const memoryUsage = process.memoryUsage();
      this.recordMetric('memory_usage_rss', memoryUsage.rss);
      this.recordMetric('memory_usage_heap_used', memoryUsage.heapUsed);
      this.recordMetric('memory_usage_heap_total', memoryUsage.heapTotal);
      this.recordMetric('memory_usage_external', memoryUsage.external);

      // イベントループレイテンシ
      const start = process.hrtime();
      setImmediate(() => {
        const delta = process.hrtime(start);
        const latency = delta[0] * 1000 + delta[1] / 1000000;
        this.recordMetric('event_loop_latency', latency);
      });

      // アクティブハンドル数
      this.recordMetric('active_handles', (process as any)._getActiveHandles().length);
      this.recordMetric('active_requests', (process as any)._getActiveRequests().length);

    }, 30000); // 30秒間隔
  }

  // カスタムスパンの作成
  createSpan(name: string, parentTransactionId?: string): Span {
    const span: Span = {
      id: `span_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      name,
      startTime: Date.now(),
      parentTransactionId
    };

    return span;
  }

  // エラー記録
  recordError(error: Error, context?: Record<string, any>): void {
    const errorRecord: ErrorRecord = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      context
    };

    this.sendErrorToAPMService(errorRecord);
  }

  // インスタンス管理
  private static instance: APMMonitor;
  
  static getInstance(): APMMonitor {
    if (!APMMonitor.instance) {
      APMMonitor.instance = new APMMonitor();
    }
    return APMMonitor.instance;
  }

  private startTransaction(transaction: Transaction): void {
    this.activeTransactions.set(transaction.id, transaction);
  }

  private endTransaction(transactionId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (transaction) {
      this.sendTransactionToAPMService(transaction);
      this.activeTransactions.delete(transactionId);
    }
  }

  private recordSlowOrErrorTransaction(transaction: Transaction): void {
    console.warn('Slow or error transaction:', transaction);
    // 詳細な分析のためにAPMサービスに送信
    this.sendTransactionToAPMService(transaction, true);
  }

  private recordDatabaseQuery(query: DatabaseQuery): void {
    if (query.duration > 1000) { // 1秒以上のスロークエリ
      console.warn('Slow database query:', query);
    }

    this.recordMetric('database_query_duration', query.duration, {
      operation: query.operation
    });
  }

  private recordDatabaseError(error: DatabaseError): void {
    console.error('Database error:', error);
    this.recordMetric('database_error_count', 1, {
      operation: error.operation
    });
  }

  private async sendTransactionToAPMService(transaction: Transaction, highPriority = false): Promise<void> {
    // APMサービス（New Relic、DataDog等）への送信
    try {
      const payload = {
        ...transaction,
        service: 'nanika-game',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      if (process.env.APM_ENDPOINT) {
        await fetch(process.env.APM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.APM_API_KEY}`
          },
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      console.error('Failed to send transaction to APM service:', error);
    }
  }

  private async sendErrorToAPMService(errorRecord: ErrorRecord): Promise<void> {
    try {
      const payload = {
        ...errorRecord,
        service: 'nanika-game',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      if (process.env.APM_ENDPOINT) {
        await fetch(`${process.env.APM_ENDPOINT}/errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.APM_API_KEY}`
          },
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      console.error('Failed to send error to APM service:', error);
    }
  }
}

class MetricCollector {
  private name: string;
  private values: number[] = [];
  private labels: Record<string, string>[] = [];

  constructor(name: string) {
    this.name = name;
  }

  record(value: number, labels?: Record<string, string>): void {
    this.values.push(value);
    this.labels.push(labels || {});

    // バッファサイズ制限
    if (this.values.length > 1000) {
      this.values.shift();
      this.labels.shift();
    }
  }

  getStats(): MetricStats {
    if (this.values.length === 0) {
      return {
        name: this.name,
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        sum: 0
      };
    }

    const sum = this.values.reduce((a, b) => a + b, 0);
    return {
      name: this.name,
      count: this.values.length,
      min: Math.min(...this.values),
      max: Math.max(...this.values),
      avg: sum / this.values.length,
      sum
    };
  }
}

// 型定義
export interface Transaction {
  id: string;
  type: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  context?: Record<string, any>;
}

export interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parentTransactionId?: string;
}

export interface ErrorRecord {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface DatabaseQuery {
  operation: string;
  duration: number;
  args: string;
  timestamp: number;
}

export interface DatabaseError {
  operation: string;
  duration: number;
  error: string;
  args: string;
  timestamp: number;
}

export interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
}
```

## Lighthouse CI 統合

### 1. Lighthouse CI設定

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: lhci_user
          POSTGRES_PASSWORD: lhci_password
          POSTGRES_DB: lhci_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://lhci_user:lhci_password@localhost:5432/lhci_db
          
      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production
          
      - name: Start preview server
        run: |
          npm run preview &
          npx wait-on http://localhost:3000 --timeout 60000
        env:
          DATABASE_URL: postgresql://lhci_user:lhci_password@localhost:5432/lhci_db
          PORT: 3000
          
      - name: Install Lighthouse CI
        run: npm install -g @lhci/cli
        
      - name: Run Lighthouse CI
        run: lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
          LHCI_TOKEN: ${{ secrets.LHCI_TOKEN }}
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    build: {
      command: 'npm run build',
      outputDir: './build',
    },
    upload: {
      target: 'lhci',
      serverBaseUrl: 'https://your-lhci-server.com',
      token: process.env.LHCI_TOKEN,
    },
    server: {
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'postgres',
        sqlConnectionUrl: process.env.DATABASE_URL,
      },
    },
    assert: {
      assertions: {
        // Performance assertions
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.85 }],
        
        // Core Web Vitals assertions
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'first-input-delay': ['error', { maxNumericValue: 100 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
        
        // Resource optimization
        'unused-css-rules': ['warn', { maxLength: 0 }],
        'unused-javascript': ['warn', { maxLength: 0 }],
        'modern-image-formats': ['warn', { maxLength: 0 }],
        'offscreen-images': ['warn', { maxLength: 0 }],
        
        // Security and best practices
        'is-on-https': 'error',
        'uses-http2': 'warn',
        'no-vulnerable-libraries': 'error',
      },
    },
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/games',
        'http://localhost:3000/login',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        emulatedFormFactor: 'mobile',
        locale: 'ja',
      },
    },
  },
};
```

### 2. カスタムLighthouseプラグイン

```typescript
// lighthouse/custom-audits/game-performance-audit.ts

export class GamePerformanceAudit {
  static get meta() {
    return {
      id: 'game-performance-audit',
      title: 'Game Performance Metrics',
      failureTitle: 'Game performance needs improvement',
      description: 'Measures game-specific performance metrics',
      requiredArtifacts: ['traces', 'devtoolsLogs'],
    };
  }

  static audit(artifacts: any, context: any) {
    const trace = artifacts.traces[0];
    const devtoolsLog = artifacts.devtoolsLogs[0];
    
    return new Promise((resolve) => {
      // ゲーム固有のメトリクスを計算
      const gameMetrics = this.calculateGameMetrics(trace, devtoolsLog);
      
      const score = this.calculateScore(gameMetrics);
      const displayValue = `${gameMetrics.gameLoadTime}ms`;
      
      resolve({
        score,
        displayValue,
        details: {
          type: 'table',
          headings: [
            { key: 'metric', itemType: 'text', text: 'Metric' },
            { key: 'value', itemType: 'ms', text: 'Value' },
            { key: 'rating', itemType: 'text', text: 'Rating' },
          ],
          items: [
            {
              metric: 'Game Load Time',
              value: gameMetrics.gameLoadTime,
              rating: gameMetrics.gameLoadTime < 3000 ? 'Good' : 'Needs Improvement',
            },
            {
              metric: 'Game Board Render Time',
              value: gameMetrics.gameBoardRenderTime,
              rating: gameMetrics.gameBoardRenderTime < 100 ? 'Good' : 'Needs Improvement',
            },
            {
              metric: 'First Interaction Ready',
              value: gameMetrics.firstInteractionReady,
              rating: gameMetrics.firstInteractionReady < 2000 ? 'Good' : 'Needs Improvement',
            },
          ],
        },
      });
    });
  }

  private static calculateGameMetrics(trace: any, devtoolsLog: any): GameMetrics {
    // トレースデータからゲーム固有のメトリクスを抽出
    const events = trace.traceEvents;
    
    // ゲームロード時間の計算
    const gameLoadStart = events.find(e => e.name === 'game-load-start')?.ts || 0;
    const gameLoadEnd = events.find(e => e.name === 'game-load-end')?.ts || 0;
    const gameLoadTime = (gameLoadEnd - gameLoadStart) / 1000; // マイクロ秒からミリ秒

    // ゲームボード描画時間の計算
    const boardRenderStart = events.find(e => e.name === 'game-board-render-start')?.ts || 0;
    const boardRenderEnd = events.find(e => e.name === 'game-board-render-end')?.ts || 0;
    const gameBoardRenderTime = (boardRenderEnd - boardRenderStart) / 1000;

    // 最初のインタラクション準備完了時間
    const firstInteractionReady = events.find(e => e.name === 'first-interaction-ready')?.ts || 0;
    const navigationStart = events.find(e => e.name === 'navigationStart')?.ts || 0;
    const firstInteractionReadyTime = (firstInteractionReady - navigationStart) / 1000;

    return {
      gameLoadTime,
      gameBoardRenderTime,
      firstInteractionReady: firstInteractionReadyTime,
    };
  }

  private static calculateScore(metrics: GameMetrics): number {
    // ゲームパフォーマンスのスコア計算
    let score = 1.0;
    
    if (metrics.gameLoadTime > 5000) score -= 0.3;
    else if (metrics.gameLoadTime > 3000) score -= 0.1;
    
    if (metrics.gameBoardRenderTime > 200) score -= 0.2;
    else if (metrics.gameBoardRenderTime > 100) score -= 0.1;
    
    if (metrics.firstInteractionReady > 3000) score -= 0.2;
    else if (metrics.firstInteractionReady > 2000) score -= 0.1;
    
    return Math.max(0, score);
  }
}

interface GameMetrics {
  gameLoadTime: number;
  gameBoardRenderTime: number;
  firstInteractionReady: number;
}
```

## ダッシュボードとアラート

### 1. パフォーマンスダッシュボード

```typescript
// app/web/components/admin/PerformanceDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

interface PerformanceData {
  webVitals: WebVitalsData;
  rumData: RUMData;
  apmData: APMData;
  lighthouseScores: LighthouseData;
}

export const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformanceData(timeRange);
  }, [timeRange]);

  const loadPerformanceData = async (range: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/performance?range=${range}`);
      const data = await response.json();
      setPerformanceData(data);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!performanceData) {
    return <div className="text-red-600">Failed to load performance data</div>;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Largest Contentful Paint"
          value={`${performanceData.webVitals.lcp.p75}ms`}
          rating={performanceData.webVitals.lcp.rating}
          change={performanceData.webVitals.lcp.change}
          target="< 2.5s"
        />
        <MetricCard
          title="First Input Delay"
          value={`${performanceData.webVitals.fid.p75}ms`}
          rating={performanceData.webVitals.fid.rating}
          change={performanceData.webVitals.fid.change}
          target="< 100ms"
        />
        <MetricCard
          title="Cumulative Layout Shift"
          value={performanceData.webVitals.cls.p75.toFixed(3)}
          rating={performanceData.webVitals.cls.rating}
          change={performanceData.webVitals.cls.change}
          target="< 0.1"
        />
      </div>

      {/* パフォーマンストレンド */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Core Web Vitals Trend</h3>
          <Line data={generateWebVitalsChartData(performanceData.webVitals.trend)} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Page Load Time Distribution</h3>
          <Bar data={generatePageLoadDistributionData(performanceData.rumData.pageLoads)} />
        </div>
      </div>

      {/* RUM データ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Error Rate</h3>
          <div className="text-3xl font-bold text-red-600">
            {(performanceData.rumData.errorRate * 100).toFixed(2)}%
          </div>
          <div className="text-sm text-gray-500">
            {performanceData.rumData.errorCount} errors in {performanceData.rumData.totalSessions} sessions
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Bounce Rate</h3>
          <div className="text-3xl font-bold text-orange-600">
            {(performanceData.rumData.bounceRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Pages with less than 2 interactions
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Average Session Duration</h3>
          <div className="text-3xl font-bold text-blue-600">
            {Math.round(performanceData.rumData.avgSessionDuration / 1000)}s
          </div>
          <div className="text-sm text-gray-500">
            Across all user sessions
          </div>
        </div>
      </div>

      {/* Lighthouse スコア */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Lighthouse Scores</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(performanceData.lighthouseScores.latest).map(([category, score]) => (
            <div key={category} className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-2">
                <Doughnut 
                  data={generateScoreChartData(score as number)}
                  options={{ cutout: '80%', plugins: { legend: { display: false } } }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{score}</span>
                </div>
              </div>
              <div className="text-sm font-medium capitalize">{category}</div>
            </div>
          ))}
        </div>
      </div>

      {/* APM メトリクス */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Server Performance</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {performanceData.apmData.avgResponseTime}ms
            </div>
            <div className="text-sm text-gray-500">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {performanceData.apmData.throughput}
            </div>
            <div className="text-sm text-gray-500">Requests/min</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {performanceData.apmData.errorRate.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500">Error Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {performanceData.apmData.dbQueryTime}ms
            </div>
            <div className="text-sm text-gray-500">Avg DB Query Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// メトリクスカードコンポーネント
const MetricCard: React.FC<{
  title: string;
  value: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  change?: number;
  target: string;
}> = ({ title, value, rating, change, target }) => {
  const ratingColors = {
    good: 'text-green-600 bg-green-100',
    'needs-improvement': 'text-yellow-600 bg-yellow-100',
    poor: 'text-red-600 bg-red-100'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${ratingColors[rating]}`}>
          {rating === 'needs-improvement' ? 'Needs Improvement' : rating}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Target: {target}</span>
        {change !== undefined && (
          <span className={`font-medium ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ヘルパー関数
const generateWebVitalsChartData = (trendData: any) => ({
  labels: trendData.timestamps.map((t: number) => new Date(t).toLocaleTimeString()),
  datasets: [
    {
      label: 'LCP',
      data: trendData.lcp,
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    {
      label: 'FID',
      data: trendData.fid,
      borderColor: 'rgb(245, 158, 11)',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      label: 'CLS (×100)',
      data: trendData.cls.map((v: number) => v * 100),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
    }
  ]
});

const generateScoreChartData = (score: number) => ({
  datasets: [{
    data: [score, 100 - score],
    backgroundColor: [
      score >= 90 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444',
      '#E5E7EB'
    ],
    borderWidth: 0
  }]
});

// 型定義
interface WebVitalsData {
  lcp: { p75: number; rating: MetricRating; change?: number };
  fid: { p75: number; rating: MetricRating; change?: number };
  cls: { p75: number; rating: MetricRating; change?: number };
  trend: {
    timestamps: number[];
    lcp: number[];
    fid: number[];
    cls: number[];
  };
}

interface RUMData {
  errorRate: number;
  errorCount: number;
  totalSessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  pageLoads: number[];
}

interface APMData {
  avgResponseTime: number;
  throughput: number;
  errorRate: number;
  dbQueryTime: number;
}

interface LighthouseData {
  latest: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
}
```

### 2. アラートシステム

```typescript
// app/infrastructure/monitoring/alert-system.ts

export class AlertSystem {
  private rules: AlertRule[] = [];
  private channels: NotificationChannel[] = [];

  constructor() {
    this.initializeDefaultRules();
    this.initializeChannels();
  }

  // デフォルトアラートルールの設定
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'lcp-degradation',
        name: 'LCP Performance Degradation',
        condition: {
          metric: 'lcp',
          operator: '>',
          threshold: 4000, // 4秒
          duration: 300000 // 5分間継続
        },
        severity: 'high',
        enabled: true
      },
      {
        id: 'error-rate-spike',
        name: 'Error Rate Spike',
        condition: {
          metric: 'error_rate',
          operator: '>',
          threshold: 0.05, // 5%
          duration: 60000 // 1分間継続
        },
        severity: 'critical',
        enabled: true
      },
      {
        id: 'response-time-high',
        name: 'High Response Time',
        condition: {
          metric: 'avg_response_time',
          operator: '>',
          threshold: 5000, // 5秒
          duration: 180000 // 3分間継続
        },
        severity: 'medium',
        enabled: true
      },
      {
        id: 'memory-usage-high',
        name: 'High Memory Usage',
        condition: {
          metric: 'memory_usage_percentage',
          operator: '>',
          threshold: 0.9, // 90%
          duration: 600000 // 10分間継続
        },
        severity: 'high',
        enabled: true
      }
    ];
  }

  // 通知チャンネルの初期化
  private initializeChannels(): void {
    this.channels = [
      new SlackChannel({
        webhookUrl: process.env.SLACK_WEBHOOK_URL!,
        channel: '#performance-alerts',
        enabled: !!process.env.SLACK_WEBHOOK_URL
      }),
      new EmailChannel({
        smtpConfig: {
          host: process.env.SMTP_HOST!,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER!,
            pass: process.env.SMTP_PASS!
          }
        },
        from: process.env.ALERT_FROM_EMAIL!,
        to: process.env.ALERT_TO_EMAILS?.split(',') || [],
        enabled: !!(process.env.SMTP_HOST && process.env.ALERT_TO_EMAILS)
      }),
      new WebhookChannel({
        url: process.env.ALERT_WEBHOOK_URL!,
        enabled: !!process.env.ALERT_WEBHOOK_URL
      })
    ];
  }

  // メトリクスの評価とアラート発火
  async evaluateMetric(metric: string, value: number): Promise<void> {
    const relevantRules = this.rules.filter(rule => 
      rule.enabled && rule.condition.metric === metric
    );

    for (const rule of relevantRules) {
      const isTriggered = this.evaluateCondition(rule.condition, value);
      
      if (isTriggered) {
        await this.handleAlert(rule, value);
      }
    }
  }

  // 条件の評価
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  // アラートの処理
  private async handleAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity,
      currentValue,
      threshold: rule.condition.threshold,
      timestamp: new Date(),
      status: 'active'
    };

    // 重複アラートの確認
    const isDuplicate = await this.isDuplicateAlert(rule.id);
    if (isDuplicate) {
      return; // 既に同じルールのアラートがアクティブ
    }

    // アラートの保存
    await this.saveAlert(alert);

    // 通知の送信
    await this.sendNotifications(alert);

    console.log(`Alert triggered: ${rule.name} (${currentValue})`);
  }

  // 重複アラートの確認
  private async isDuplicateAlert(ruleId: string): Promise<boolean> {
    // 実装では Redis や データベースで重複確認
    // ここでは簡易実装
    const activeAlertKey = `active_alert:${ruleId}`;
    
    try {
      const redis = require('ioredis');
      const client = new redis(process.env.REDIS_URL);
      const exists = await client.exists(activeAlertKey);
      
      if (!exists) {
        // 5分間のクールダウン期間を設定
        await client.setex(activeAlertKey, 300, '1');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to check duplicate alert:', error);
      return false;
    }
  }

  // アラートの保存
  private async saveAlert(alert: Alert): Promise<void> {
    // データベースへのアラート保存
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.performanceAlert.create({
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          name: alert.name,
          severity: alert.severity,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          timestamp: alert.timestamp,
          status: alert.status
        }
      });
    } catch (error) {
      console.error('Failed to save alert:', error);
    }
  }

  // 通知送信
  private async sendNotifications(alert: Alert): Promise<void> {
    const enabledChannels = this.channels.filter(channel => channel.isEnabled());
    
    await Promise.all(
      enabledChannels.map(channel => 
        channel.sendNotification(alert).catch(error => {
          console.error(`Failed to send notification via ${channel.constructor.name}:`, error);
        })
      )
    );
  }

  // アラートルールの動的追加
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  // アラートルールの更新
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex !== -1) {
      this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    }
  }

  // アラートルールの削除
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }
}

// Slack通知チャンネル
class SlackChannel implements NotificationChannel {
  constructor(private config: SlackConfig) {}

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.webhookUrl;
  }

  async sendNotification(alert: Alert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const message = {
      channel: this.config.channel,
      attachments: [{
        color,
        title: `🚨 Performance Alert: ${alert.name}`,
        fields: [
          {
            title: 'Current Value',
            value: alert.currentValue.toFixed(2),
            short: true
          },
          {
            title: 'Threshold',
            value: alert.threshold.toFixed(2),
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ]
      }]
    };

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    const colors = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff4500',
      critical: '#ff0000'
    };
    return colors[severity];
  }
}

// Email通知チャンネル
class EmailChannel implements NotificationChannel {
  constructor(private config: EmailConfig) {}

  isEnabled(): boolean {
    return this.config.enabled && this.config.to.length > 0;
  }

  async sendNotification(alert: Alert): Promise<void> {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter(this.config.smtpConfig);

    const subject = `Performance Alert: ${alert.name}`;
    const html = this.generateEmailHTML(alert);

    await transporter.sendMail({
      from: this.config.from,
      to: this.config.to.join(','),
      subject,
      html
    });
  }

  private generateEmailHTML(alert: Alert): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #e53e3e;">🚨 Performance Alert</h2>
        <h3>${alert.name}</h3>
        
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Current Value:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.currentValue.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Threshold:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.threshold.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.severity.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.timestamp.toLocaleString()}</td>
          </tr>
        </table>
        
        <p style="margin-top: 20px;">
          Please check the performance dashboard for more details.
        </p>
      </div>
    `;
  }
}

// Webhook通知チャンネル
class WebhookChannel implements NotificationChannel {
  constructor(private config: WebhookConfig) {}

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.url;
  }

  async sendNotification(alert: Alert): Promise<void> {
    const payload = {
      type: 'performance_alert',
      alert: {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        timestamp: alert.timestamp.toISOString()
      }
    };

    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }
}

// 型定義
interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
}

interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration: number;
}

type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  status: 'active' | 'resolved';
}

interface NotificationChannel {
  isEnabled(): boolean;
  sendNotification(alert: Alert): Promise<void>;
}

interface SlackConfig {
  webhookUrl: string;
  channel: string;
  enabled: boolean;
}

interface EmailConfig {
  smtpConfig: any;
  from: string;
  to: string[];
  enabled: boolean;
}

interface WebhookConfig {
  url: string;
  enabled: boolean;
}
```

## React統合とフック

### 1. パフォーマンス監視フック

```typescript
// app/web/hooks/usePerformanceMonitoring.ts

export function usePerformanceMonitoring(config?: PerformanceMonitoringConfig) {
  const [webVitalsData, setWebVitalsData] = useState<WebVitalsMetrics>({});
  const [rumData, setRumData] = useState<RUMMetrics>({});
  const monitorRef = useRef<WebVitalsMonitor | null>(null);
  const rumMonitorRef = useRef<RealUserMonitor | null>(null);

  useEffect(() => {
    // Web Vitals監視の初期化
    monitorRef.current = new WebVitalsMonitor({
      endpointUrl: config?.endpointUrl || '/api/performance/metrics',
      debug: config?.debug || false,
      sampleRate: config?.sampleRate || 1.0
    });

    // RUM監視の初期化
    rumMonitorRef.current = new RealUserMonitor({
      endpointUrl: config?.rumEndpointUrl || '/api/performance/rum',
      maxEventsBuffer: config?.maxEventsBuffer || 100,
      sampleRate: config?.sampleRate || 1.0
    });

    // ユーザーIDの設定（認証済みの場合）
    if (config?.userId) {
      rumMonitorRef.current.setUserId(config.userId);
    }

    return () => {
      monitorRef.current?.stop();
      rumMonitorRef.current = null;
    };
  }, [config]);

  // カスタムイベントの記録
  const trackCustomEvent = useCallback((name: string, value?: any, metadata?: Record<string, any>) => {
    rumMonitorRef.current?.trackCustomEvent(name, value, metadata);
  }, []);

  // パフォーマンスマーク
  const markPerformance = useCallback((name: string) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }, []);

  // パフォーマンス測定
  const measurePerformance = useCallback((name: string, startMark: string, endMark?: string) => {
    if ('performance' in window && 'measure' in performance) {
      try {
        const measure = endMark ? 
          performance.measure(name, startMark, endMark) :
          performance.measure(name, startMark);
        
        // カスタムイベントとして記録
        trackCustomEvent('performance_measure', measure.duration, {
          name,
          startMark,
          endMark
        });
        
        return measure.duration;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
        return null;
      }
    }
    return null;
  }, [trackCustomEvent]);

  // セッション情報の取得
  const getSessionSummary = useCallback(() => {
    return rumMonitorRef.current?.getSessionSummary();
  }, []);

  return {
    webVitalsData,
    rumData,
    trackCustomEvent,
    markPerformance,
    measurePerformance,
    getSessionSummary
  };
}

// ゲーム固有のパフォーマンス監視フック
export function useGamePerformanceMonitoring() {
  const { trackCustomEvent, markPerformance, measurePerformance } = usePerformanceMonitoring();

  // ゲーム読み込み時間の測定
  const trackGameLoad = useCallback(() => {
    markPerformance('game-load-start');
    
    return {
      finish: () => {
        markPerformance('game-load-end');
        const duration = measurePerformance('game-load-time', 'game-load-start', 'game-load-end');
        trackCustomEvent('game_load_time', duration);
      }
    };
  }, [trackCustomEvent, markPerformance, measurePerformance]);

  // ゲームボード描画時間の測定
  const trackGameBoardRender = useCallback(() => {
    markPerformance('game-board-render-start');
    
    return {
      finish: () => {
        markPerformance('game-board-render-end');
        const duration = measurePerformance('game-board-render-time', 'game-board-render-start', 'game-board-render-end');
        trackCustomEvent('game_board_render_time', duration);
      }
    };
  }, [trackCustomEvent, markPerformance, measurePerformance]);

  // ゲームアクション時間の測定
  const trackGameAction = useCallback((actionType: string) => {
    const startMark = `game-action-${actionType}-start`;
    markPerformance(startMark);
    
    return {
      finish: () => {
        const endMark = `game-action-${actionType}-end`;
        markPerformance(endMark);
        const duration = measurePerformance(`game-action-${actionType}-time`, startMark, endMark);
        trackCustomEvent('game_action_time', duration, { actionType });
      }
    };
  }, [trackCustomEvent, markPerformance, measurePerformance]);

  // ゲームエラーの記録
  const trackGameError = useCallback((error: Error, context?: Record<string, any>) => {
    trackCustomEvent('game_error', null, {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }, [trackCustomEvent]);

  return {
    trackGameLoad,
    trackGameBoardRender,
    trackGameAction,
    trackGameError
  };
}

interface PerformanceMonitoringConfig {
  endpointUrl?: string;
  rumEndpointUrl?: string;
  debug?: boolean;
  sampleRate?: number;
  maxEventsBuffer?: number;
  userId?: string;
}

interface WebVitalsMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

interface RUMMetrics {
  sessionId?: string;
  pageViews?: number;
  interactions?: number;
  errors?: number;
  sessionDuration?: number;
}
```

## 今後の拡張計画

### Phase 1: 基本監視強化（3ヶ月）
1. **機械学習ベース異常検知**: 正常なパフォーマンスパターンを学習し、異常を自動検出
2. **リアルタイムダッシュボード**: WebSocketを使用したリアルタイム監視画面
3. **モバイルパフォーマンス監視**: モバイルデバイス固有のメトリクス追加
4. **地域別パフォーマンス分析**: CDNとエッジサーバーのパフォーマンス監視

### Phase 2: 高度な分析機能（6ヶ月）
1. **予測分析**: パフォーマンス悪化の予兆検知と事前アラート
2. **ユーザージャーニー分析**: パフォーマンスがユーザー行動に与える影響分析
3. **A/Bテスト統合**: パフォーマンス施策の効果測定
4. **ビジネス影響分析**: パフォーマンスがコンバージョンに与える影響測定

### Phase 3: 自動最適化システム（12ヶ月）
1. **自動スケーリング**: パフォーマンスメトリクスに基づく自動リソース調整
2. **自動キャッシュ最適化**: アクセスパターンに基づくキャッシュ戦略の自動調整
3. **自動コード分割**: 使用パターンに基づく動的なバンドル最適化
4. **自動回復システム**: パフォーマンス問題の自動修復

## まとめ

本パフォーマンス計測・監視設計は、Web Vitals、RUM、APM、Lighthouse CI を統合した包括的な監視システムにより、ユーザー体験の継続的な向上を実現します。リアルタイムな監視とアラートシステムにより、パフォーマンス問題の早期発見と迅速な対応が可能になります。

詳細なメトリクス収集と分析により、データドリブンなパフォーマンス最適化を継続し、競合優位性のあるゲームアプリケーションの運用を支援します。