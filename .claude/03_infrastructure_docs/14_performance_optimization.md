# パフォーマンス最適化

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトのパフォーマンス最適化戦略について詳述します。Core Web Vitals（LCP、FID、CLS）の改善、画像最適化、キャッシュ戦略、バンドル最適化、データベースクエリ最適化など、包括的なパフォーマンス向上施策により、優れたユーザー体験とSEO効果を実現します。

## 現在の実装状況

- **React Router v7**: Server-Side Rendering（SSR）による初期レンダリング最適化
- **Vite**: 高速なビルドシステムとHot Module Replacement
- **Tailwind CSS**: ユーティリティファーストによるCSS最適化
- **画像最適化**: WebP形式への自動変換（基本実装）
- **コード分割**: React.lazyによる動的インポート（部分実装）

## Core Web Vitals 最適化

### 1. Largest Contentful Paint（LCP）改善

```typescript
// app/web/utils/performance/lcp-optimizer.ts

export class LCPOptimizer {
  // クリティカルリソースの優先読み込み
  static preloadCriticalResources() {
    const criticalResources = [
      { href: '/fonts/noto-sans-jp-400.woff2', as: 'font', type: 'font/woff2' },
      { href: '/fonts/noto-sans-jp-700.woff2', as: 'font', type: 'font/woff2' },
      { href: '/images/hero-banner.webp', as: 'image' },
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.type) link.type = resource.type;
      if (resource.as === 'font') link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  // 画像の遅延読み込み設定
  static setupImageLazyLoading() {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px', // 50px前に読み込み開始
      threshold: 0.01
    });

    // 遅延読み込み対象の画像を監視
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Above-the-fold コンテンツの最適化
  static optimizeAboveFold() {
    // クリティカルCSSのインライン挿入
    const criticalCSS = this.extractCriticalCSS();
    if (criticalCSS) {
      const style = document.createElement('style');
      style.textContent = criticalCSS;
      document.head.appendChild(style);
    }

    // 非クリティカルCSSの非同期読み込み
    this.loadNonCriticalCSS();
  }

  private static extractCriticalCSS(): string | null {
    // Above-the-fold で必要な最小限のCSS
    return `
      /* Reset & Base */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Noto Sans JP', sans-serif; line-height: 1.6; }
      
      /* Header & Navigation */
      .header { background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .nav { display: flex; justify-content: space-between; align-items: center; }
      
      /* Hero Section */
      .hero { min-height: 50vh; display: flex; align-items: center; justify-content: center; }
      .hero-title { font-size: 2.5rem; font-weight: 700; text-align: center; }
      
      /* Button */
      .btn { padding: 12px 24px; border-radius: 6px; font-weight: 600; transition: all 0.2s; }
      .btn-primary { background: #3b82f6; color: white; border: none; }
    `;
  }

  private static loadNonCriticalCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/non-critical.css';
    link.media = 'print'; // 一時的にprint media指定
    link.onload = () => link.media = 'all'; // 読み込み完了後にall mediaに変更
    document.head.appendChild(link);
  }
}

// React Router用のパフォーマンス最適化フック
export function useLCPOptimization() {
  useEffect(() => {
    // コンポーネントマウント時にLCP最適化を実行
    LCPOptimizer.preloadCriticalResources();
    LCPOptimizer.setupImageLazyLoading();
    LCPOptimizer.optimizeAboveFold();

    // パフォーマンス測定
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('LCP:', entry.startTime);
          // アナリティクスに送信
          sendPerformanceMetric('lcp', entry.startTime);
        }
      });
    });
    
    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    return () => observer.disconnect();
  }, []);
}

// パフォーマンスメトリクス送信
async function sendPerformanceMetric(metric: string, value: number) {
  if (!window.navigator.sendBeacon) return;
  
  const data = JSON.stringify({
    metric,
    value,
    url: window.location.href,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    connection: (navigator as any).connection?.effectiveType
  });
  
  window.navigator.sendBeacon('/api/performance/metrics', data);
}
```

### 2. First Input Delay（FID）改善

```typescript
// app/web/utils/performance/fid-optimizer.ts

export class FIDOptimizer {
  // メインスレッドのブロッキングタスク分割
  static async executeTasksInChunks<T>(
    tasks: (() => T)[],
    chunkSize = 5,
    delay = 5
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      
      // チャンク内のタスクを実行
      const chunkResults = chunk.map(task => task());
      results.push(...chunkResults);
      
      // 次のチャンクの前に短い遅延を入れてメインスレッドを解放
      if (i + chunkSize < tasks.length) {
        await this.yieldToMain(delay);
      }
    }
    
    return results;
  }

  // メインスレッドに制御を戻す
  private static yieldToMain(delay = 0): Promise<void> {
    return new Promise(resolve => {
      if (delay > 0) {
        setTimeout(resolve, delay);
      } else {
        // MessageChannel を使用したより効率的な方法
        const channel = new MessageChannel();
        channel.port2.onmessage = () => resolve();
        channel.port1.postMessage(null);
      }
    });
  }

  // 重い処理の Web Worker への移譲
  static createWorkerForHeavyTasks(): Worker {
    const workerCode = `
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        switch (type) {
          case 'SORT_LARGE_ARRAY':
            const sorted = data.array.sort((a, b) => a.localeCompare(b));
            self.postMessage({ type: 'SORT_COMPLETE', data: sorted });
            break;
            
          case 'CALCULATE_STATISTICS':
            const stats = calculateGameStatistics(data);
            self.postMessage({ type: 'STATS_COMPLETE', data: stats });
            break;
            
          case 'PROCESS_IMAGE':
            const processed = processImageData(data);
            self.postMessage({ type: 'IMAGE_PROCESSED', data: processed });
            break;
        }
      };
      
      function calculateGameStatistics(gameData) {
        // 重い統計計算処理
        const stats = {
          averageScore: gameData.reduce((sum, game) => sum + game.score, 0) / gameData.length,
          winRate: gameData.filter(game => game.won).length / gameData.length,
          // その他の統計
        };
        return stats;
      }
      
      function processImageData(imageData) {
        // 画像処理ロジック
        return { processed: true, timestamp: Date.now() };
      }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }

  // イベントハンドラーの最適化
  static optimizeEventHandlers() {
    // パッシブリスナーの使用
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'scroll'];
    
    passiveEvents.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        // 最小限の処理のみ
      }, { passive: true });
    });

    // デバウンス処理
    const debouncedHandlers = new Map<string, number>();
    
    return {
      debounce: (key: string, handler: Function, delay = 100) => {
        const existingTimeout = debouncedHandlers.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        const timeoutId = window.setTimeout(() => {
          handler();
          debouncedHandlers.delete(key);
        }, delay);
        
        debouncedHandlers.set(key, timeoutId);
      }
    };
  }

  // コード分割とプリロード
  static setupCodeSplitting() {
    const routes = {
      '/dashboard': () => import('../routes/Dashboard'),
      '/games': () => import('../routes/Games'),
      '/profile': () => import('../routes/Profile'),
    };

    // ホバー時のプリロード
    document.addEventListener('mouseover', (e) => {
      const link = (e.target as Element).closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && routes[href]) {
        // ルートコンポーネントをプリロード
        routes[href]();
      }
    });

    // インターセクション オブザーバーによるプリロード
    const linkObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement;
          const href = link.getAttribute('href');
          
          if (href && routes[href]) {
            routes[href]();
            linkObserver.unobserve(link);
          }
        }
      });
    });

    // 画面内のリンクを監視
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      linkObserver.observe(link);
    });
  }
}

// React フック：FID最適化
export function useFIDOptimization() {
  const workerRef = useRef<Worker | null>(null);
  const eventOptimizerRef = useRef<ReturnType<typeof FIDOptimizer.optimizeEventHandlers> | null>(null);

  useEffect(() => {
    // Web Worker初期化
    workerRef.current = FIDOptimizer.createWorkerForHeavyTasks();
    
    // イベントハンドラー最適化
    eventOptimizerRef.current = FIDOptimizer.optimizeEventHandlers();
    
    // コード分割設定
    FIDOptimizer.setupCodeSplitting();

    // FID測定
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.name === 'first-input') {
          console.log('FID:', entry.processingStart - entry.startTime);
          sendPerformanceMetric('fid', entry.processingStart - entry.startTime);
        }
      });
    });
    
    observer.observe({ entryTypes: ['first-input'] });

    return () => {
      observer.disconnect();
      workerRef.current?.terminate();
    };
  }, []);

  // 重い処理をWorkerに移譲するヘルパー関数
  const executeInWorker = useCallback((type: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        workerRef.current?.removeEventListener('message', handleMessage);
        resolve(e.data.data);
      };

      const handleError = (e: ErrorEvent) => {
        workerRef.current?.removeEventListener('error', handleError);
        reject(e.error);
      };

      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.addEventListener('error', handleError);
      workerRef.current.postMessage({ type, data });
    });
  }, []);

  return {
    executeInWorker,
    debounce: eventOptimizerRef.current?.debounce,
    executeTasksInChunks: FIDOptimizer.executeTasksInChunks,
  };
}
```

### 3. Cumulative Layout Shift（CLS）改善

```typescript
// app/web/utils/performance/cls-optimizer.ts

export class CLSOptimizer {
  // 画像・メディアの寸法予約
  static reserveImageSpace() {
    const images = document.querySelectorAll('img:not([width]):not([height])');
    
    images.forEach(async (img: HTMLImageElement) => {
      // 画像の元サイズを取得して予約
      if (img.dataset.width && img.dataset.height) {
        img.width = parseInt(img.dataset.width);
        img.height = parseInt(img.dataset.height);
      } else {
        // 画像読み込み前にサイズを動的に設定
        await this.setImageDimensions(img);
      }
    });
  }

  private static async setImageDimensions(img: HTMLImageElement): Promise<void> {
    return new Promise((resolve) => {
      const tempImage = new Image();
      
      tempImage.onload = () => {
        const aspectRatio = tempImage.naturalHeight / tempImage.naturalWidth;
        const containerWidth = img.parentElement?.offsetWidth || 300;
        
        img.style.width = `${containerWidth}px`;
        img.style.height = `${Math.round(containerWidth * aspectRatio)}px`;
        img.style.objectFit = 'cover';
        
        resolve();
      };
      
      tempImage.src = img.src || img.dataset.src || '';
    });
  }

  // フォント読み込み最適化
  static optimizeFontLoading() {
    // フォント表示の最適化
    const fontFaces = [
      {
        family: 'Noto Sans JP',
        src: 'url(/fonts/noto-sans-jp-400.woff2) format("woff2")',
        weight: '400',
        display: 'swap' // フォールバックフォントから滑らかに移行
      },
      {
        family: 'Noto Sans JP',
        src: 'url(/fonts/noto-sans-jp-700.woff2) format("woff2")',
        weight: '700',
        display: 'swap'
      }
    ];

    fontFaces.forEach(font => {
      const fontFace = new FontFace(font.family, font.src, {
        weight: font.weight,
        display: font.display as FontDisplay
      });

      fontFace.load().then((loadedFont) => {
        document.fonts.add(loadedFont);
      }).catch(console.error);
    });
  }

  // 動的コンテンツの領域予約
  static reserveContentSpace() {
    // スケルトンローダー用のCSS
    const skeletonCSS = `
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
      }
      
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      .skeleton-text {
        height: 1em;
        margin-bottom: 0.5em;
        border-radius: 4px;
      }
      
      .skeleton-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }
      
      .skeleton-card {
        width: 100%;
        height: 200px;
        border-radius: 8px;
        margin-bottom: 1rem;
      }
    `;

    // CSS を動的に挿入
    if (!document.querySelector('#skeleton-styles')) {
      const style = document.createElement('style');
      style.id = 'skeleton-styles';
      style.textContent = skeletonCSS;
      document.head.appendChild(style);
    }
  }

  // レイアウト シフト測定
  static measureLayoutShift(): Promise<number> {
    return new Promise((resolve) => {
      let cumulativeScore = 0;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            cumulativeScore += entry.value;
          }
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });

      // 5秒後に測定を停止して結果を返す
      setTimeout(() => {
        observer.disconnect();
        resolve(cumulativeScore);
      }, 5000);
    });
  }

  // アニメーションの最適化
  static optimizeAnimations() {
    // GPU アクセラレーションの有効化
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    animatedElements.forEach(element => {
      const el = element as HTMLElement;
      el.style.willChange = 'transform, opacity';
      el.style.transform = 'translateZ(0)'; // レイヤー強制作成
    });

    // Intersection Observer を使用した最適なアニメーション
    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        
        if (entry.isIntersecting) {
          element.classList.add('animate-in');
          // アニメーション完了後にwillChangeをリセット
          setTimeout(() => {
            element.style.willChange = 'auto';
          }, 1000);
        }
      });
    }, {
      rootMargin: '10px'
    });

    animatedElements.forEach(element => {
      animationObserver.observe(element);
    });
  }
}

// React コンポーネント：スケルトンローダー
interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'avatar' | 'card' | 'button';
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '1em', 
  className = '',
  variant = 'text'
}) => {
  const baseClass = 'skeleton';
  const variantClass = `skeleton-${variant}`;
  
  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`}
      style={{ width, height }}
      aria-label="Loading..."
    />
  );
};

// React フック：CLS最適化
export function useCLSOptimization() {
  const [layoutShiftScore, setLayoutShiftScore] = useState<number | null>(null);

  useEffect(() => {
    // 初期最適化の実行
    CLSOptimizer.reserveImageSpace();
    CLSOptimizer.optimizeFontLoading();
    CLSOptimizer.reserveContentSpace();
    CLSOptimizer.optimizeAnimations();

    // CLS測定
    CLSOptimizer.measureLayoutShift().then(score => {
      setLayoutShiftScore(score);
      sendPerformanceMetric('cls', score);
    });
  }, []);

  return {
    layoutShiftScore,
    Skeleton,
  };
}
```

## 画像・メディア最適化

### 1. 画像最適化パイプライン

```typescript
// app/infrastructure/media/image-optimizer.ts
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

export class ImageOptimizer {
  private static readonly SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif'];
  private static readonly DEFAULT_QUALITY = 85;
  private static readonly MAX_WIDTH = 1920;
  private static readonly MAX_HEIGHT = 1080;

  // 画像の最適化処理
  static async optimizeImage(
    inputPath: string,
    outputDir: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageSet> {
    const {
      quality = this.DEFAULT_QUALITY,
      maxWidth = this.MAX_WIDTH,
      maxHeight = this.MAX_HEIGHT,
      generateWebP = true,
      generateAVIF = true,
      generateResponsiveSizes = true
    } = options;

    const inputBuffer = await fs.readFile(inputPath);
    const metadata = await sharp(inputBuffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    const baseName = path.parse(path.basename(inputPath)).name;
    const results: OptimizedImageSet = {
      original: { path: inputPath, width: metadata.width, height: metadata.height },
      variants: []
    };

    // 元画像のリサイズと最適化
    const originalOptimized = await this.processImage(inputBuffer, {
      width: Math.min(metadata.width, maxWidth),
      height: Math.min(metadata.height, maxHeight),
      quality,
      format: metadata.format as keyof sharp.FormatEnum
    });

    const originalPath = path.join(outputDir, `${baseName}_optimized.${metadata.format}`);
    await fs.writeFile(originalPath, originalOptimized);
    
    results.variants.push({
      path: originalPath,
      width: Math.min(metadata.width, maxWidth),
      height: Math.min(metadata.height, maxHeight),
      format: metadata.format as string,
      size: originalOptimized.length
    });

    // WebP 形式の生成
    if (generateWebP) {
      const webpBuffer = await this.processImage(inputBuffer, {
        width: Math.min(metadata.width, maxWidth),
        height: Math.min(metadata.height, maxHeight),
        quality,
        format: 'webp'
      });

      const webpPath = path.join(outputDir, `${baseName}.webp`);
      await fs.writeFile(webpPath, webpBuffer);
      
      results.variants.push({
        path: webpPath,
        width: Math.min(metadata.width, maxWidth),
        height: Math.min(metadata.height, maxHeight),
        format: 'webp',
        size: webpBuffer.length
      });
    }

    // AVIF 形式の生成
    if (generateAVIF) {
      const avifBuffer = await this.processImage(inputBuffer, {
        width: Math.min(metadata.width, maxWidth),
        height: Math.min(metadata.height, maxHeight),
        quality,
        format: 'avif'
      });

      const avifPath = path.join(outputDir, `${baseName}.avif`);
      await fs.writeFile(avifPath, avifBuffer);
      
      results.variants.push({
        path: avifPath,
        width: Math.min(metadata.width, maxWidth),
        height: Math.min(metadata.height, maxHeight),
        format: 'avif',
        size: avifBuffer.length
      });
    }

    // レスポンシブ用サイズの生成
    if (generateResponsiveSizes) {
      const sizes = [480, 768, 1024, 1280];
      
      for (const size of sizes) {
        if (size < metadata.width) {
          const responsiveBuffer = await this.processImage(inputBuffer, {
            width: size,
            quality,
            format: 'webp'
          });

          const responsivePath = path.join(outputDir, `${baseName}_${size}w.webp`);
          await fs.writeFile(responsivePath, responsiveBuffer);
          
          results.variants.push({
            path: responsivePath,
            width: size,
            height: Math.round((size / metadata.width) * metadata.height),
            format: 'webp',
            size: responsiveBuffer.length,
            descriptor: `${size}w`
          });
        }
      }
    }

    return results;
  }

  private static async processImage(
    inputBuffer: Buffer,
    options: ProcessImageOptions
  ): Promise<Buffer> {
    let pipeline = sharp(inputBuffer);

    // リサイズ
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // フォーマット変換と品質設定
    switch (options.format) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ 
          quality: options.quality,
          progressive: true,
          mozjpeg: true // より良い圧縮
        });
        break;
        
      case 'png':
        pipeline = pipeline.png({ 
          quality: options.quality,
          progressive: true,
          compressionLevel: 9
        });
        break;
        
      case 'webp':
        pipeline = pipeline.webp({ 
          quality: options.quality,
          effort: 6, // 最高品質の圧縮
          lossless: false
        });
        break;
        
      case 'avif':
        pipeline = pipeline.avif({ 
          quality: options.quality,
          effort: 6,
          lossless: false
        });
        break;
    }

    return pipeline.toBuffer();
  }

  // 画像の遅延読み込み用のブラー画像生成
  static async generatePlaceholder(inputPath: string): Promise<string> {
    const inputBuffer = await fs.readFile(inputPath);
    
    const placeholderBuffer = await sharp(inputBuffer)
      .resize(20, 20, { fit: 'inside' })
      .blur(2)
      .jpeg({ quality: 20 })
      .toBuffer();

    // Base64エンコード
    return `data:image/jpeg;base64,${placeholderBuffer.toString('base64')}`;
  }

  // 画像メタデータの取得
  static async getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    const metadata = await sharp(imagePath).metadata();
    const stats = await fs.stat(imagePath);
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stats.size,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation
    };
  }
}

export interface ImageOptimizationOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  generateWebP?: boolean;
  generateAVIF?: boolean;
  generateResponsiveSizes?: boolean;
}

export interface ProcessImageOptions {
  width?: number;
  height?: number;
  quality: number;
  format: keyof sharp.FormatEnum;
}

export interface OptimizedImageSet {
  original: {
    path: string;
    width: number;
    height: number;
  };
  variants: ImageVariant[];
}

export interface ImageVariant {
  path: string;
  width: number;
  height: number;
  format: string;
  size: number;
  descriptor?: string; // "480w", "2x" など
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  density?: number;
  hasAlpha?: boolean;
  orientation?: number;
}
```

### 2. 最適化された画像コンポーネント

```typescript
// app/web/components/common/OptimizedImage.tsx
import { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty';
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  lazy = true,
  placeholder = 'blur',
  sizes = '100vw',
  priority = false,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [placeholderSrc, setPlaceholderSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // 画像形式の優先順位に基づく srcset 生成
  const generateSrcSet = (baseSrc: string): { srcSet: string; fallbackSrc: string } => {
    const baseName = baseSrc.replace(/\.[^.]+$/, '');
    const extension = baseSrc.split('.').pop();
    
    // レスポンシブサイズの生成
    const sizes = [480, 768, 1024, 1280, 1920];
    const webpSrcSet = sizes.map(size => `${baseName}_${size}w.webp ${size}w`).join(', ');
    const avifSrcSet = sizes.map(size => `${baseName}_${size}w.avif ${size}w`).join(', ');
    
    return {
      srcSet: webpSrcSet,
      fallbackSrc: `${baseName}_optimized.${extension}`
    };
  };

  // プレースホルダー画像の生成
  useEffect(() => {
    if (placeholder === 'blur' && !priority) {
      generateBlurPlaceholder(src).then(setPlaceholderSrc);
    }
  }, [src, placeholder, priority]);

  // 遅延読み込みの設定
  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    intersectionObserverRef.current = observer;

    return () => observer.disconnect();
  }, [lazy, priority]);

  // 優先画像のプリロード
  useEffect(() => {
    if (priority && src) {
      const { srcSet, fallbackSrc } = generateSrcSet(src);
      
      // AVIF サポートチェックと最適形式の選択
      preloadOptimalImage(srcSet, fallbackSrc);
    }
  }, [priority, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    onError?.(new Error('Image failed to load'));
  };

  const { srcSet, fallbackSrc } = generateSrcSet(src);

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ 
        width: width ? `${width}px` : 'auto',
        height: height ? `${height}px` : 'auto'
      }}
    >
      {/* プレースホルダー */}
      {!isLoaded && placeholder === 'blur' && placeholderSrc && (
        <img
          src={placeholderSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 transition-opacity duration-300"
          style={{ filter: 'blur(2px)' }}
        />
      )}
      
      {/* メイン画像 */}
      {isInView && !hasError && (
        <picture>
          {/* AVIF 形式（最高効率） */}
          <source 
            type="image/avif"
            srcSet={srcSet.replace(/\.webp/g, '.avif')}
            sizes={sizes}
          />
          
          {/* WebP 形式（広いサポート） */}
          <source 
            type="image/webp"
            srcSet={srcSet}
            sizes={sizes}
          />
          
          {/* フォールバック */}
          <img
            ref={imgRef}
            src={fallbackSrc}
            alt={alt}
            width={width}
            height={height}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleLoad}
            onError={handleError}
            loading={lazy ? 'lazy' : 'eager'}
            decoding="async"
          />
        </picture>
      )}
      
      {/* エラー時のフォールバック */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400 text-sm">画像を読み込めませんでした</span>
        </div>
      )}
      
      {/* ローディングインジケーター */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
    </div>
  );
};

// ユーティリティ関数
async function generateBlurPlaceholder(src: string): Promise<string> {
  try {
    // サーバーサイドでブラープレースホルダーを生成する API を呼び出し
    const response = await fetch(`/api/images/placeholder?src=${encodeURIComponent(src)}`);
    const data = await response.json();
    return data.placeholder;
  } catch {
    // フォールバック：グレーのデータ URI
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZjNmNGY2Ii8+Cjwvc3ZnPgo=';
  }
}

async function preloadOptimalImage(srcSet: string, fallbackSrc: string) {
  // ブラウザのフォーマットサポートを検証
  const supportsAVIF = await checkImageFormatSupport('image/avif');
  const supportsWebP = await checkImageFormatSupport('image/webp');
  
  let preloadSrc = fallbackSrc;
  
  if (supportsAVIF) {
    preloadSrc = srcSet.replace(/\.webp/g, '.avif');
  } else if (supportsWebP) {
    preloadSrc = srcSet;
  }
  
  // プリロード用の link タグを作成
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = preloadSrc;
  document.head.appendChild(link);
}

async function checkImageFormatSupport(mimeType: string): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob?.type === mimeType);
    }, mimeType);
  });
}
```

## キャッシュ戦略

### 1. 多層キャッシュ戦略

```typescript
// app/infrastructure/cache/cache-strategy.ts

export class CacheStrategy {
  // ブラウザキャッシュヘッダーの設定
  static generateCacheHeaders(resourceType: ResourceType): Record<string, string> {
    const cacheConfigs: Record<ResourceType, CacheConfig> = {
      'static-assets': {
        maxAge: 31536000, // 1年
        immutable: true,
        public: true
      },
      'images': {
        maxAge: 2592000, // 30日
        immutable: false,
        public: true
      },
      'api-data': {
        maxAge: 300, // 5分
        immutable: false,
        public: false,
        staleWhileRevalidate: 3600 // 1時間
      },
      'html-pages': {
        maxAge: 0,
        immutable: false,
        public: true,
        noCache: true
      },
      'user-content': {
        maxAge: 0,
        immutable: false,
        public: false,
        noStore: true
      }
    };

    const config = cacheConfigs[resourceType];
    const headers: Record<string, string> = {};

    if (config.noStore) {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
      return headers;
    }

    const cacheControl = [];
    
    if (config.public) {
      cacheControl.push('public');
    } else {
      cacheControl.push('private');
    }

    if (config.noCache) {
      cacheControl.push('no-cache');
    } else {
      cacheControl.push(`max-age=${config.maxAge}`);
    }

    if (config.immutable) {
      cacheControl.push('immutable');
    }

    if (config.staleWhileRevalidate) {
      cacheControl.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    headers['Cache-Control'] = cacheControl.join(', ');

    // ETags for validation
    if (!config.immutable) {
      headers['ETag'] = `"${this.generateETag()}"`;
    }

    return headers;
  }

  // Service Worker キャッシュ戦略
  static generateServiceWorkerCache(): string {
    return `
      const CACHE_NAME = 'nanika-game-v${Date.now()}';
      const STATIC_CACHE_NAME = 'nanika-game-static-v1';
      const RUNTIME_CACHE_NAME = 'nanika-game-runtime';
      
      // キャッシュする静的リソース
      const STATIC_RESOURCES = [
        '/',
        '/manifest.json',
        '/fonts/noto-sans-jp-400.woff2',
        '/fonts/noto-sans-jp-700.woff2',
        '/icons/icon-192.png',
        '/icons/icon-512.png'
      ];

      // インストール時の処理
      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(STATIC_CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_RESOURCES))
        );
        self.skipWaiting();
      });

      // アクティベーション時の処理
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((cacheNames) => {
            return Promise.all(
              cacheNames.map((cacheName) => {
                if (cacheName !== STATIC_CACHE_NAME && 
                    cacheName !== RUNTIME_CACHE_NAME) {
                  return caches.delete(cacheName);
                }
              })
            );
          })
        );
        self.clients.claim();
      });

      // フェッチ時の処理
      self.addEventListener('fetch', (event) => {
        const { request } = event;
        
        // HTML リクエストの処理
        if (request.mode === 'navigate') {
          event.respondWith(
            networkFirst(request, RUNTIME_CACHE_NAME)
          );
          return;
        }

        // 静的リソースの処理
        if (STATIC_RESOURCES.includes(new URL(request.url).pathname)) {
          event.respondWith(
            cacheFirst(request, STATIC_CACHE_NAME)
          );
          return;
        }

        // API リクエストの処理
        if (request.url.includes('/api/')) {
          event.respondWith(
            networkFirst(request, RUNTIME_CACHE_NAME, 5000) // 5秒タイムアウト
          );
          return;
        }

        // 画像リソースの処理
        if (request.destination === 'image') {
          event.respondWith(
            cacheFirst(request, RUNTIME_CACHE_NAME)
          );
          return;
        }
      });

      // キャッシュファーストストラテジー
      async function cacheFirst(request, cacheName) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        
        if (response.ok) {
          await cache.put(request, response.clone());
        }
        
        return response;
      }

      // ネットワークファーストストラテジー
      async function networkFirst(request, cacheName, timeout = 3000) {
        const cache = await caches.open(cacheName);
        
        try {
          const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);

          if (response.ok) {
            await cache.put(request, response.clone());
          }
          
          return response;
        } catch (error) {
          const cached = await cache.match(request);
          
          if (cached) {
            return cached;
          }
          
          throw error;
        }
      }
    `;
  }

  // Redis キャッシュマネージャー
  static createRedisCache() {
    return new RedisCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      keyPrefix: 'nanika-game:',
      defaultTTL: 3600 // 1時間
    });
  }

  private static generateETag(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

export class RedisCache {
  private redis: any;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(config: RedisCacheConfig) {
    const Redis = require('ioredis');
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTTL = config.defaultTTL || 3600;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(`${this.keyPrefix}${key}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.defaultTTL;
      
      await this.redis.setex(`${this.keyPrefix}${key}`, effectiveTTL, serialized);
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(`${this.keyPrefix}${key}`);
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      const prefixedKeys = keys.map(key => `${this.keyPrefix}${key}`);
      const values = await this.redis.mget(...prefixedKeys);
      
      return values.map((value: string | null) => 
        value ? JSON.parse(value) : null
      );
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      
      return 0;
    } catch (error) {
      console.error('Redis invalidate pattern error:', error);
      return 0;
    }
  }
}

// 型定義
export type ResourceType = 'static-assets' | 'images' | 'api-data' | 'html-pages' | 'user-content';

export interface CacheConfig {
  maxAge: number;
  immutable: boolean;
  public: boolean;
  staleWhileRevalidate?: number;
  noCache?: boolean;
  noStore?: boolean;
}

export interface RedisCacheConfig {
  host: string;
  port: number;
  keyPrefix?: string;
  defaultTTL?: number;
}
```

### 2. アプリケーションレベルキャッシュ

```typescript
// app/web/utils/cache/application-cache.ts

export class ApplicationCache {
  private memoryCache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttl = 300000) { // 5分デフォルト
    this.memoryCache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  // キャッシュ取得
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // TTL チェック
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    // LRU 更新
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);

    return entry.value;
  }

  // キャッシュ設定
  set<T>(key: string, value: T, customTTL?: number): void {
    // サイズ制限チェック
    if (this.memoryCache.size >= this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    const expiresAt = Date.now() + (customTTL || this.ttl);
    
    this.memoryCache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt
    });
  }

  // キャッシュ削除
  delete(key: string): boolean {
    return this.memoryCache.delete(key);
  }

  // パターンによるキャッシュクリア
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    
    for (const [key] of this.memoryCache) {
      if (pattern.test(key)) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  // 期限切れエントリのクリーンアップ
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  // 統計情報
  getStats(): CacheStats {
    const totalEntries = this.memoryCache.size;
    const now = Date.now();
    let expiredEntries = 0;
    let totalSize = 0;

    for (const [, entry] of this.memoryCache) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      }
      totalSize += this.estimateSize(entry.value);
    }

    return {
      totalEntries,
      expiredEntries,
      hitRate: this.calculateHitRate(),
      totalSize,
      maxSize: this.maxSize
    };
  }

  private hitCount = 0;
  private missCount = 0;

  private calculateHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2; // 概算
  }
}

// React フック：キャッシュ付きデータフェッチ
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cache = useMemo(() => new ApplicationCache(), []);

  const fetchData = useCallback(async (force = false) => {
    if (!force) {
      const cached = cache.get<T>(key);
      if (cached) {
        setData(cached);
        return cached;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cache.set(key, result, options.ttl);
      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);
      throw error;
    }
  }, [key, fetcher, cache, options.ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidate: () => cache.delete(key)
  };
}

// 型定義
interface CacheEntry {
  value: any;
  createdAt: number;
  expiresAt: number;
}

interface CacheStats {
  totalEntries: number;
  expiredEntries: number;
  hitRate: number;
  totalSize: number;
  maxSize: number;
}

interface CacheOptions {
  ttl?: number;
  staleWhileRevalidate?: boolean;
}
```

## バンドル最適化

### 1. コード分割とツリーシェイキング

```typescript
// vite.config.ts - 最適化設定
import { defineConfig } from 'vite';
import { vitePlugin as remix } from '@remix-run/dev';
import { visualizer } from 'rollup-plugin-visualizer';
import { comlink } from 'vite-plugin-comlink';

export default defineConfig({
  plugins: [
    remix(),
    comlink(), // Web Workers の最適化
    visualizer({ // バンドル分析
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  build: {
    // チャンク分割戦略
    rollupOptions: {
      output: {
        manualChunks: {
          // ベンダーチャンク
          vendor: ['react', 'react-dom'],
          router: ['@remix-run/react'],
          
          // UIライブラリチャンク
          ui: ['date-fns', 'clsx'],
          
          // 大きなライブラリの分離
          charts: ['recharts'],
          editor: ['monaco-editor'],
          
          // ユーティリティチャンク
          utils: ['lodash-es', 'ramda'],
        },
        
        // チャンクファイル名の最適化
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId?.includes('node_modules')) {
            return 'vendor/[name].[hash].js';
          }
          return 'chunks/[name].[hash].js';
        },
        
        // アセットファイル名の最適化
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType ?? '')) {
            return 'images/[name].[hash][extname]';
          }
          if (/woff2?|ttf|eot/i.test(extType ?? '')) {
            return 'fonts/[name].[hash][extname]';
          }
          return 'assets/[name].[hash][extname]';
        },
      },
      
      // 外部依存関係の最適化
      external: (id) => {
        // CDN から読み込む大きなライブラリ
        if (id === 'react' && process.env.NODE_ENV === 'production') {
          return true;
        }
        return false;
      },
    },
    
    // ファイルサイズ警告の閾値
    chunkSizeWarningLimit: 1000, // 1MB
    
    // 圧縮設定
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // console.log を削除
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // 指定関数を削除
      },
      mangle: {
        safari10: true, // Safari 10 対応
      },
    },
    
    // Source map の最適化
    sourcemap: process.env.NODE_ENV === 'development',
  },
  
  // 依存関係の最適化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@remix-run/react',
      'date-fns',
      'clsx',
    ],
    exclude: [
      'monaco-editor', // 大きなエディターは動的読み込み
    ],
  },
  
  // CSS の最適化
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
        require('cssnano')({
          preset: ['default', {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
          }],
        }),
      ],
    },
  },
});
```

### 2. 動的インポートとルート分割

```typescript
// app/web/utils/dynamic-imports.ts

export class DynamicImportOptimizer {
  private static importCache = new Map<string, Promise<any>>();
  
  // プリロード付き動的インポート
  static async importWithPreload<T>(
    importFn: () => Promise<T>,
    preloadCondition?: () => boolean
  ): Promise<T> {
    const importKey = importFn.toString();
    
    // キャッシュチェック
    if (this.importCache.has(importKey)) {
      return this.importCache.get(importKey);
    }
    
    const importPromise = importFn();
    this.importCache.set(importKey, importPromise);
    
    // プリロード条件のチェック
    if (preloadCondition?.()) {
      this.preloadModule(importFn);
    }
    
    return importPromise;
  }
  
  // モジュールのプリロード
  static preloadModule(importFn: () => Promise<any>): void {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 0);
    }
  }
  
  // ルート依存のプリロード
  static preloadRouteModules(currentRoute: string): void {
    const routePreloadMap: Record<string, (() => Promise<any>)[]> = {
      '/': [
        () => import('../routes/Dashboard'),
        () => import('../routes/Games'),
      ],
      '/dashboard': [
        () => import('../routes/Profile'),
        () => import('../routes/Games'),
      ],
      '/games': [
        () => import('../routes/GameRoom'),
        () => import('../components/game/GameBoard'),
      ],
    };
    
    const preloadFunctions = routePreloadMap[currentRoute];
    if (preloadFunctions) {
      preloadFunctions.forEach(fn => this.preloadModule(fn));
    }
  }
  
  // 条件付きインポート
  static async conditionalImport<T>(
    condition: boolean,
    importFn: () => Promise<T>,
    fallback?: T
  ): Promise<T | undefined> {
    if (condition) {
      return this.importWithPreload(importFn);
    }
    return fallback;
  }
  
  // Feature flag ベースのインポート
  static async featureBasedImport<T>(
    featureFlag: string,
    importFn: () => Promise<T>
  ): Promise<T | null> {
    const isEnabled = await this.checkFeatureFlag(featureFlag);
    
    if (isEnabled) {
      return this.importWithPreload(importFn);
    }
    
    return null;
  }
  
  private static async checkFeatureFlag(flag: string): Promise<boolean> {
    // Feature flag の確認ロジック
    // 実際の実装では API 呼び出しや設定ファイル確認など
    return localStorage.getItem(`feature_${flag}`) === 'enabled';
  }
}

// React フック：動的インポート
export function useDynamicImport<T>(
  importFn: () => Promise<{ default: T }>,
  deps: React.DependencyList = []
) {
  const [component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    DynamicImportOptimizer.importWithPreload(importFn)
      .then((module) => {
        if (mounted) {
          setComponent(module.default);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });
    
    return () => {
      mounted = false;
    };
  }, deps);
  
  return { component, loading, error };
}

// HOC：遅延コンポーネント読み込み
export function withLazyLoading<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  fallback: React.ReactNode = <div>Loading...</div>
) {
  return React.lazy(() => 
    DynamicImportOptimizer.importWithPreload(importFn)
  );
}

// 使用例
export const LazyDashboard = withLazyLoading(
  () => import('../routes/Dashboard'),
  <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
);

export const LazyGameBoard = withLazyLoading(
  () => import('../components/game/GameBoard'),
  <div className="flex items-center justify-center h-96">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
  </div>
);
```

### 3. リソース優先度の最適化

```typescript
// app/web/utils/resource-priority.ts

export class ResourcePriorityOptimizer {
  // リソースプリロード管理
  static preloadCriticalResources(): void {
    const criticalResources = [
      {
        href: '/fonts/noto-sans-jp-400.woff2',
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous'
      },
      {
        href: '/api/user/profile',
        as: 'fetch',
        crossorigin: 'anonymous'
      },
      {
        href: '/images/hero-bg.webp',
        as: 'image'
      }
    ];

    criticalResources.forEach(resource => {
      this.createPreloadLink(resource);
    });
  }

  // DNS プリフェッチ
  static setupDNSPrefetch(): void {
    const domains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://api.example.com',
      'https://cdn.example.com'
    ];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
  }

  // モジュールプリロード
  static preloadModules(): void {
    const modules = [
      '/assets/vendor.js',
      '/assets/router.js',
      '/assets/ui.js'
    ];

    modules.forEach(module => {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = module;
      document.head.appendChild(link);
    });
  }

  // 優先度に基づくリソース読み込み
  static loadResourceByPriority(
    resources: ResourceWithPriority[],
    maxConcurrent = 3
  ): Promise<void> {
    return new Promise((resolve) => {
      const sortedResources = resources.sort((a, b) => a.priority - b.priority);
      let loadedCount = 0;
      let currentIndex = 0;

      const loadNext = () => {
        if (currentIndex >= sortedResources.length) {
          if (loadedCount >= sortedResources.length) {
            resolve();
          }
          return;
        }

        const resource = sortedResources[currentIndex++];
        
        this.loadResource(resource).finally(() => {
          loadedCount++;
          loadNext();
        });

        // 並列読み込みの制御
        if (currentIndex - loadedCount < maxConcurrent && currentIndex < sortedResources.length) {
          setTimeout(loadNext, 10);
        }
      };

      // 初期読み込み開始
      for (let i = 0; i < Math.min(maxConcurrent, sortedResources.length); i++) {
        loadNext();
      }
    });
  }

  private static createPreloadLink(resource: PreloadResource): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    
    if (resource.type) link.type = resource.type;
    if (resource.crossorigin) link.crossOrigin = resource.crossorigin;
    if (resource.media) link.media = resource.media;

    document.head.appendChild(link);
  }

  private static loadResource(resource: ResourceWithPriority): Promise<void> {
    return new Promise((resolve, reject) => {
      switch (resource.type) {
        case 'script':
          this.loadScript(resource.url).then(resolve).catch(reject);
          break;
        case 'style':
          this.loadStylesheet(resource.url).then(resolve).catch(reject);
          break;
        case 'image':
          this.loadImage(resource.url).then(resolve).catch(reject);
          break;
        case 'font':
          this.loadFont(resource.url, resource.fontFamily).then(resolve).catch(reject);
          break;
        default:
          resolve();
      }
    });
  }

  private static loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  private static loadStylesheet(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`));
      document.head.appendChild(link);
    });
  }

  private static loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private static loadFont(url: string, fontFamily?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fontFamily) {
        reject(new Error('Font family is required'));
        return;
      }

      const fontFace = new FontFace(fontFamily, `url(${url})`);
      
      fontFace.load()
        .then((loadedFont) => {
          document.fonts.add(loadedFont);
          resolve();
        })
        .catch(() => reject(new Error(`Failed to load font: ${url}`)));
    });
  }
}

// React フック：リソース最適化
export function useResourceOptimization() {
  useEffect(() => {
    // クリティカルリソースのプリロード
    ResourcePriorityOptimizer.preloadCriticalResources();
    
    // DNS プリフェッチ
    ResourcePriorityOptimizer.setupDNSPrefetch();
    
    // モジュールプリロード
    ResourcePriorityOptimizer.preloadModules();
    
    // 接続が遅い場合の最適化
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // 低速回線用の最適化
        document.documentElement.classList.add('slow-connection');
      }
    }
  }, []);
}

// 型定義
interface PreloadResource {
  href: string;
  as: string;
  type?: string;
  crossorigin?: string;
  media?: string;
}

interface ResourceWithPriority {
  url: string;
  type: 'script' | 'style' | 'image' | 'font';
  priority: number; // 1が最高優先度
  fontFamily?: string;
}
```

## データベースクエリ最適化

### 1. Prismaクエリ最適化

```typescript
// app/infrastructure/database/optimized-queries.ts
import { PrismaClient, Prisma } from '@prisma/client';

export class OptimizedQueries {
  constructor(private prisma: PrismaClient) {}

  // N+1 問題の回避
  async getGamesWithUsers(limit = 20, offset = 0): Promise<GameWithUsers[]> {
    return this.prisma.game.findMany({
      skip: offset,
      take: limit,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            // パスワードなどの機密情報は除外
          }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  // バッチクエリの使用
  async getUsersWithGameCounts(userIds: number[]): Promise<UserWithGameCount[]> {
    // 単一クエリで必要なデータを取得
    const usersWithCounts = await this.prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            createdGames: true,
            gameParticipations: true
          }
        }
      }
    });

    return usersWithCounts.map(user => ({
      ...user,
      totalGames: user._count.createdGames + user._count.gameParticipations,
      createdGames: user._count.createdGames,
      participatedGames: user._count.gameParticipations
    }));
  }

  // インデックスを活用した効率的な検索
  async searchGames(query: GameSearchQuery): Promise<SearchResult<GameSummary>> {
    const conditions: Prisma.GameWhereInput = {};

    if (query.name) {
      conditions.name = {
        contains: query.name,
        mode: 'insensitive' // 大文字小文字を区別しない
      };
    }

    if (query.status) {
      conditions.status = { in: query.status };
    }

    if (query.maxPlayers) {
      conditions.maxPlayers = { lte: query.maxPlayers };
    }

    if (query.createdAfter) {
      conditions.createdAt = { gte: query.createdAfter };
    }

    // カウントクエリと実データクエリを並列実行
    const [totalCount, games] = await Promise.all([
      this.prisma.game.count({ where: conditions }),
      this.prisma.game.findMany({
        where: conditions,
        select: {
          id: true,
          name: true,
          status: true,
          maxPlayers: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: query.orderBy || { createdAt: 'desc' },
        skip: query.offset || 0,
        take: query.limit || 20
      })
    ]);

    return {
      items: games.map(game => ({
        id: game.id,
        name: game.name,
        status: game.status,
        currentPlayers: game._count.participants,
        maxPlayers: game.maxPlayers,
        creator: game.creator,
        createdAt: game.createdAt
      })),
      totalCount,
      hasMore: (query.offset || 0) + (query.limit || 20) < totalCount
    };
  }

  // トランザクションの最適化
  async createGameWithInitialData(
    gameData: CreateGameData,
    creatorId: number
  ): Promise<GameAggregate> {
    return this.prisma.$transaction(async (tx) => {
      // ゲームの作成
      const game = await tx.game.create({
        data: {
          name: gameData.name,
          maxPlayers: gameData.maxPlayers,
          settings: gameData.settings,
          createdBy: creatorId,
          status: 'waiting'
        }
      });

      // 作成者を参加者として追加
      const participation = await tx.gameParticipant.create({
        data: {
          gameId: game.id,
          userId: creatorId,
          role: 'host',
          joinedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // 初期ゲーム状態の作成
      const gameState = await tx.gameState.create({
        data: {
          gameId: game.id,
          currentTurn: creatorId,
          turnNumber: 1,
          state: {}
        }
      });

      return {
        game,
        participants: [participation],
        gameState
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000 // 10秒タイムアウト
    });
  }

  // キャッシュ最適化されたクエリ
  async getCachedUserProfile(userId: number, useCache = true): Promise<UserProfile | null> {
    const cacheKey = `user_profile:${userId}`;
    
    if (useCache) {
      // Redis キャッシュから取得を試行
      const cached = await this.getCachedData<UserProfile>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            createdGames: true,
            gameParticipations: true
          }
        },
        createdGames: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5 // 最新5件のみ
        }
      }
    });

    if (profile && useCache) {
      // 5分間キャッシュ
      await this.setCachedData(cacheKey, profile, 300);
    }

    return profile;
  }

  // 集約データの効率的な計算
  async getGameStatistics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<GameStatistics> {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    // 複数の集約クエリを並列実行
    const [
      totalGames,
      activeGames,
      completedGames,
      totalUsers,
      newUsers,
      averagePlayersPerGame
    ] = await Promise.all([
      this.prisma.game.count(),
      this.prisma.game.count({ where: { status: 'playing' } }),
      this.prisma.game.count({ 
        where: { 
          status: 'finished',
          createdAt: { gte: startDate }
        } 
      }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: startDate } }
      }),
      this.prisma.game.aggregate({
        where: { createdAt: { gte: startDate } },
        _avg: { maxPlayers: true }
      })
    ]);

    return {
      totalGames,
      activeGames,
      completedGames,
      totalUsers,
      newUsers,
      averagePlayersPerGame: averagePlayersPerGame._avg.maxPlayers || 0,
      timeRange
    };
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    // Redis からキャッシュデータを取得
    // 実装は省略
    return null;
  }

  private async setCachedData<T>(key: string, data: T, ttl: number): Promise<void> {
    // Redis にキャッシュデータを保存
    // 実装は省略
  }
}

// 型定義
interface GameSearchQuery {
  name?: string;
  status?: string[];
  maxPlayers?: number;
  createdAfter?: Date;
  orderBy?: Prisma.GameOrderByWithRelationInput;
  limit?: number;
  offset?: number;
}

interface SearchResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
}

interface GameWithUsers {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  creator: {
    id: number;
    name: string;
    email: string;
  };
  participants: Array<{
    id: string;
    userId: number;
    joinedAt: Date;
    user: {
      id: number;
      name: string;
    };
  }>;
}

interface UserWithGameCount {
  id: number;
  name: string;
  email: string;
  totalGames: number;
  createdGames: number;
  participatedGames: number;
}

interface CreateGameData {
  name: string;
  maxPlayers: number;
  settings: any;
}

interface GameAggregate {
  game: any;
  participants: any[];
  gameState: any;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  _count: {
    createdGames: number;
    gameParticipations: number;
  };
  createdGames: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
  }>;
}

interface GameStatistics {
  totalGames: number;
  activeGames: number;
  completedGames: number;
  totalUsers: number;
  newUsers: number;
  averagePlayersPerGame: number;
  timeRange: string;
}
```

### 2. データベース接続最適化

```typescript
// app/infrastructure/database/connection-optimizer.ts

export class DatabaseConnectionOptimizer {
  // 接続プール最適化
  static optimizePrismaClient(): PrismaClient {
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      
      // 接続プールの設定
      __internal: {
        engine: {
          // 接続プールサイズ
          poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
          
          // 接続タイムアウト（ミリ秒）
          connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
          
          // プリズマエンジンタイムアウト
          requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '10000'),
        }
      }
    });
  }

  // 読み書き分離
  static createReadWriteClients(): { read: PrismaClient; write: PrismaClient } {
    const readClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_READ_URL || process.env.DATABASE_URL
        }
      }
    });

    const writeClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_WRITE_URL || process.env.DATABASE_URL
        }
      }
    });

    return { read: readClient, write: writeClient };
  }

  // 接続プールの監視
  static monitorConnectionPool(prisma: PrismaClient): void {
    const originalQuery = prisma.$queryRaw;
    
    prisma.$queryRaw = new Proxy(originalQuery, {
      apply: async (target, thisArg, args) => {
        const startTime = Date.now();
        
        try {
          const result = await target.apply(thisArg, args);
          const duration = Date.now() - startTime;
          
          // スロークエリの記録
          if (duration > 1000) { // 1秒以上
            console.warn('Slow query detected:', {
              query: args[0],
              duration,
              timestamp: new Date()
            });
          }
          
          return result;
        } catch (error) {
          console.error('Database query error:', {
            query: args[0],
            error: error.message,
            duration: Date.now() - startTime
          });
          throw error;
        }
      }
    });
  }

  // バッチ処理の最適化
  static async executeBatch<T>(
    operations: (() => Promise<T>)[],
    batchSize = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(op => op().catch(error => {
          console.error('Batch operation error:', error);
          return null; // エラーを null に変換
        }))
      );
      
      results.push(...batchResults.filter(result => result !== null));
    }
    
    return results;
  }

  // データベースヘルスチェック
  static async healthCheck(prisma: PrismaClient): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // 簡単なクエリでDB接続を確認
      await prisma.$queryRaw`SELECT 1 as health_check`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  error?: string;
}
```

## 今後の拡張計画

### Phase 1: 基本パフォーマンス強化（3ヶ月）
1. **Service Worker拡張**: より高度なキャッシュ戦略とオフライン対応
2. **画像CDN統合**: Cloudinary、ImageKitなどの画像最適化サービス連携
3. **バンドル分析自動化**: CI/CDパイプラインでのバンドルサイズ監視
4. **データベースインデックス最適化**: 実使用パターンに基づくインデックス追加

### Phase 2: 高度なパフォーマンス最適化（6ヶ月）
1. **Edge Computing**: Cloudflare Workers、Vercel Edge Functions活用
2. **ストリーミング**: React 18 Suspense、ストリーミングSSRの完全活用
3. **HTTP/3対応**: 次世代プロトコルによる通信最適化
4. **WebAssembly統合**: 重い計算処理のWASM化

### Phase 3: AIパフォーマンス最適化（12ヶ月）
1. **予測プリロード**: ユーザー行動予測による最適なプリロード
2. **動的最適化**: リアルタイム使用状況に基づく自動最適化
3. **パーソナライゼーション**: ユーザー毎の最適化戦略
4. **自動A/Bテスト**: パフォーマンス施策の自動効果測定

## まとめ

本パフォーマンス最適化設計は、Core Web Vitalsの改善から始まり、画像最適化、キャッシュ戦略、バンドル最適化、データベース最適化まで、包括的なパフォーマンス向上施策を提供します。これらの最適化により、優れたユーザー体験とSEO効果を実現し、競合優位性のあるゲームアプリケーションを構築します。

段階的な実装と継続的な監視・改善により、常に最高のパフォーマンスを維持し、ユーザーエンゲージメントとビジネス成果の最大化を目指します。