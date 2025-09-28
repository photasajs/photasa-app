# RFC 0031: Ma-Liang 统一图像处理引擎

- **Start Date**: 2025-09-27
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

创建名为"Ma-Liang"（马良神笔）的统一图像处理引擎，整合现有的FFmpeg、Sharp、WASM-HEIF和Photon库，提供可扩展的格式支持和图像编辑架构，并补充当前缺失的BMP和MPEG/MPG格式支持。

## Motivation

### 当前问题

1. **格式支持不完整**：应用程序目前不支持BMP图像格式和MPEG/MPG视频格式
2. **处理逻辑分散**：图像处理功能分布在多个模块中，难以维护和扩展
3. **缺乏统一接口**：不同格式的处理方式不一致，代码重复度高
4. **扩展困难**：添加新格式支持需要修改多个文件，容易引入bug
5. **缺乏图像编辑能力**：当前没有集成的图像编辑功能，无法进行滤镜、调色等操作

### 预期收益

1. **统一的处理接口**：所有图像/视频格式通过一致的API处理
2. **易于扩展**：新增格式支持只需实现新的"神笔"处理器
3. **更好的维护性**：每个格式处理器职责单一，便于测试和调试
4. **性能优化**：统一的缓存和优化策略
5. **图像编辑能力**：集成Photon提供强大的图像编辑功能
6. **文化内涵**：以"神笔马良"命名，体现中国传统文化特色

## Detailed Design

### 核心架构

Ma-Liang引擎采用**神笔工坊模式**，每种格式对应一支专门的"神笔"，工坊（引擎）负责管理和调度所有神笔。

#### 1. 核心接口设计

```typescript
// 神笔马良主引擎
interface MaLiang {
  // 选择合适的神笔处理文件
  selectBrush(filePath: string): MagicBrush | null

  // 神笔作画（核心处理方法）
  paint(request: PaintRequest): Promise<PaintResult>

  // 注册新神笔到工坊
  registerBrush(brush: MagicBrush): void

  // 查看工坊里的所有神笔
  listBrushes(): MagicBrush[]

  // 检查格式支持
  isSupported(filePath: string): boolean
}

// 神笔接口 - 每支神笔的基本能力
interface MagicBrush {
  name: string                    // 神笔名称
  supportedFormats: string[]      // 支持的格式

  // 神笔四大绝技 - 严格遵循纯函数设计原则
  extractEssence(file: string): Promise<Metadata>      // 提取精华（元数据）
  createMiniature(file: string, options: ThumbnailOptions): Promise<string> // 制作微缩版（缩略图）

  // 可选能力 - 必须返回输出文件路径，失败时抛异常
  transform?(file: string, targetFormat: string, outputPath: string): Promise<string> // 变形术（格式转换）
  edit?(file: string, operations: EditOperation[], outputPath: string): Promise<string> // 神笔改画（图像编辑）
}

// 作画请求
interface PaintRequest {
  filePath: string
  operations: PaintOperation[]
  options?: PaintOptions
}

// 编辑操作
interface EditOperation {
  type: 'filter' | 'adjust' | 'effect' | 'crop' | 'resize'
  params: Record<string, any>
}

// 常用编辑操作
type FilterType = 'blur' | 'sharpen' | 'vintage' | 'grayscale' | 'sepia'
type AdjustType = 'brightness' | 'contrast' | 'saturation' | 'hue' | 'gamma'
type EffectType = 'vignette' | 'noise' | 'emboss' | 'edge_detection'

// 作画结果
interface PaintResult {
  success: boolean
  outputs: {
    thumbnail?: string
    metadata?: Metadata
    converted?: string
    edited?: string
  }
  brushUsed: string
  performance: PerformanceMetrics
}
```

#### 2. 分层架构

```
┌─────────────────────────────────────┐
│           Ma-Liang 主引擎             │
│  (神笔工坊 - 统一调度和管理)          │
├─────────────────────────────────────┤
│         MagicBrush 抽象层            │
│     (神笔接口 - 标准化能力)          │
├─────────────────────────────────────┤
│       底层库适配层                   │
│  ┌─────────┬─────────┬─────────┬─────────┐
│  │ FFmpeg  │  Sharp  │WASM-HEIF│ Photon  │
│  │ 神笔族  │ 神笔族  │  神笔   │ 编辑笔  │
│  └─────────┴─────────┴─────────┴─────────┘
├─────────────────────────────────────┤
│         格式检测层                   │
│    (智能格式识别和神笔选择)          │
└─────────────────────────────────────┘
```

#### 2. 核心设计原则

**纯函数设计规则**

Ma-Liang引擎严格遵循纯函数设计原则，确保API的一致性、可预测性和类型安全：

1. **单一返回类型**：`transform`和`edit`方法必须返回明确的单一类型`Promise<string>`
   - ✅ 正确：`transform(): Promise<string>` - 返回输出文件路径
   - ❌ 错误：`transform(): Promise<string | boolean>` - 联合类型导致调用方困惑

2. **错误处理策略**：使用异常机制处理失败情况，而不是特殊返回值
   - ✅ 正确：成功返回文件路径，失败抛出具体异常
   - ❌ 错误：返回`false`或`null`表示失败

3. **语义清晰性**：返回值必须有明确的业务含义
   - `transform()`返回转换后的输出文件路径
   - `edit()`返回编辑后的输出文件路径
   - `extractEssence()`返回元数据对象
   - `createMiniature()`返回缩略图数据或路径

4. **类型安全性**：调用方无需进行运行时类型检查
   ```typescript
   // ✅ 正确的API使用
   const outputPath = await brush.transform(input, format, output, logger);
   // 直接使用outputPath，无需类型检查

   // ❌ 错误的设计会导致这样的代码
   const result = await brush.transform(input, format, output, logger);
   if (typeof result === 'string') {
     // 处理文件路径
   } else {
     // 处理boolean结果 - 这是糟糕的设计
   }
   ```

5. **一致性要求**：所有神笔实现必须遵循相同的接口契约
   - 基类定义接口规范
   - 子类严格遵循父类契约
   - 不允许随意改变返回类型语义

**违反设计原则的后果**：
- API语义不清晰，增加调用方负担
- 类型安全性丧失，容易引入运行时错误
- 代码可维护性下降，测试复杂度增加
- 违背函数式编程最佳实践

**最佳实践示例**：

```typescript
// ✅ 正确的神笔实现
export class BmpBrush extends SharpBrushBase {
  public async transform(
    inputPath: string,
    targetFormat: string,
    outputPath: string,
    logger: PhotasaLogger
  ): Promise<string> {
    try {
      // 执行转换逻辑
      await this.performConversion(inputPath, targetFormat, outputPath);

      // 验证输出文件
      if (!(await fs.pathExists(outputPath))) {
        throw new BmpProcessingError('转换完成但输出文件不存在', 'TRANSFORM_FAILED');
      }

      // 返回输出文件路径
      return outputPath;
    } catch (error) {
      // 失败时抛出具体异常，不返回false或null
      throw new BmpProcessingError(`BMP转换失败: ${error.message}`, 'TRANSFORM_ERROR');
    }
  }
}

// ✅ 正确的调用方式
try {
  const outputPath = await brush.transform(input, 'png', output, logger);
  // 直接使用outputPath，无需类型检查
  console.log(`转换成功，输出文件：${outputPath}`);
} catch (error) {
  // 统一的错误处理
  console.error(`转换失败：${error.message}`);
}
```

#### 3. 错误处理与恢复机制

**统一错误处理架构**

Ma-Liang引擎实现分层错误处理机制，确保系统的健壮性和可恢复性：

1. **错误分类体系**
   ```typescript
   // 基础错误类 - 所有Ma-Liang错误的基类
   export class MaLiangError extends Error {
     public readonly code: string;           // 错误代码
     public readonly recoverable: boolean;   // 是否可恢复
     public readonly retryable: boolean;     // 是否可重试
     public readonly severity: 'low' | 'medium' | 'high' | 'critical';
     public readonly context?: any;          // 错误上下文
     public readonly timestamp: Date;        // 错误时间戳

     constructor(message: string, code: string, options?: ErrorOptions) {
       super(message);
       this.code = code;
       this.recoverable = options?.recoverable ?? false;
       this.retryable = options?.retryable ?? false;
       this.severity = options?.severity ?? 'medium';
       this.context = options?.context;
       this.timestamp = new Date();
     }
   }

   // 具体错误类型
   export class ValidationError extends MaLiangError { }      // 参数验证错误
   export class FormatError extends MaLiangError { }          // 格式不支持错误
   export class ProcessingError extends MaLiangError { }      // 处理过程错误
   export class ResourceError extends MaLiangError { }        // 资源访问错误
   export class TimeoutError extends MaLiangError { }         // 超时错误
   ```

2. **错误恢复策略**
   ```typescript
   interface ErrorRecoveryStrategy {
     // 判断是否可以恢复
     canRecover(error: MaLiangError): boolean;

     // 执行恢复操作
     recover(error: MaLiangError, context: PaintRequest): Promise<RecoveryResult>;

     // 判断是否应该重试
     shouldRetry(error: MaLiangError, attempt: number): boolean;

     // 获取重试延迟时间（指数退避）
     getRetryDelay(attempt: number): number;
   }

   // 恢复结果
   interface RecoveryResult {
     success: boolean;
     recovered?: any;           // 恢复后的结果
     fallback?: any;           // 降级方案结果
     newRequest?: PaintRequest; // 修正后的请求
   }
   ```

3. **错误处理流程**
   ```typescript
   class MaLiang {
     private errorManager: ErrorManager;

     public async paint(request: PaintRequest): Promise<PaintResult> {
       try {
         // 正常处理逻辑
         return await this.executePaint(request);
       } catch (error) {
         // 统一错误处理
         const handled = await this.errorManager.handleError(error, request);

         if (handled.recovered) {
           return handled.recovered;
         }

         if (handled.fallback) {
           return handled.fallback;
         }

         // 如果无法恢复，返回错误结果
         return this.createErrorResult(error);
       }
     }
   }
   ```

4. **内置恢复策略**

   - **格式转换失败恢复**：尝试使用备选神笔
   - **内存不足恢复**：降低处理质量或分块处理
   - **超时恢复**：增加超时时间并重试
   - **文件损坏恢复**：尝试部分读取或修复
   - **资源锁定恢复**：等待并重试

5. **错误上报与监控**
   ```typescript
   interface ErrorReporter {
     report(error: MaLiangError): void;
     getStatistics(): ErrorStatistics;
     getFrequentErrors(): MaLiangError[];
   }
   ```

6. **降级策略**
   ```typescript
   interface FallbackStrategy {
     // 处理质量降级
     reducedQuality(request: PaintRequest): PaintRequest;

     // 功能降级
     reducedFeatures(request: PaintRequest): PaintRequest;

     // 使用缓存结果
     useCached(request: PaintRequest): PaintResult | null;
   }
   ```

**错误处理最佳实践**：

1. **快速失败原则**：验证错误立即抛出，不尝试恢复
2. **优雅降级**：提供降级方案而不是完全失败
3. **错误聚合**：批处理中收集所有错误，最后统一处理
4. **上下文保持**：错误中包含足够的上下文信息用于调试
5. **用户友好**：将技术错误转换为用户可理解的信息

#### 4. API使用规范与集成指南

**服务层集成**

Ma-Liang引擎设计为可被多种上层服务和Worker消费的独立模块：

1. **单例模式使用**
   ```typescript
   // 在主进程中初始化单例
   export class ImageProcessingService {
     private static maLiang: MaLiang;

     public static getInstance(): MaLiang {
       if (!this.maLiang) {
         this.maLiang = new MaLiang({
           debug: false,
           performance: { enableMonitoring: true },
           cache: { enabled: true, maxSize: 100 }
         }, logger);

         // 注册所有神笔
         this.maLiang.registerBrush(new BmpBrush());
         this.maLiang.registerBrush(new MpegBrush());
         // ... 注册其他神笔
       }
       return this.maLiang;
     }
   }
   ```

2. **Worker进程集成**
   ```typescript
   // 在Worker中处理任务
   export class ImageProcessingWorker {
     private maLiang: MaLiang;

     constructor() {
       this.maLiang = new MaLiang({
         cache: { enabled: false } // Worker不使用缓存
       });
       this.registerBrushes();
     }

     public async processTask(task: ProcessingTask): Promise<ProcessingResult> {
       try {
         const request: PaintRequest = {
           filePath: task.inputPath,
           operations: task.operations,
           outputPath: task.outputPath,
           options: task.options
         };

         const result = await this.maLiang.paint(request);
         return {
           success: true,
           output: result.outputs,
           performance: result.performance
         };
       } catch (error) {
         // 错误已经被ErrorManager处理
         return {
           success: false,
           error: error.message
         };
       }
     }
   }
   ```

3. **现有IPC集成**
   ```typescript
   // Ma-Liang通过现有的ThumbnailService IPC接口使用
   // 无需创建新的IPC层，保持现有架构

   // 渲染进程继续使用现有API
   import { createThumbnailTask } from '@renderer/utils/api';

   // BMP文件将自动使用Ma-Liang处理（在thumbnail-handler中判断）
   const result = await createThumbnailTask.perform({
     path: '/path/to/image.bmp',
     thumbnail: '/path/to/thumbnail.png',
     width: 200,
     height: 200
   });
   ```

4. **批处理模式**
   ```typescript
   export class BatchProcessor {
     private maLiang: MaLiang;
     private concurrency: number = 4;

     public async processBatch(requests: PaintRequest[]): Promise<BatchResult> {
       const results: PaintResult[] = [];
       const errors: Error[] = [];

       // 使用 p-limit 控制并发
       const limit = pLimit(this.concurrency);
       const promises = requests.map(request =>
         limit(async () => {
           try {
             return await this.maLiang.paint(request);
           } catch (error) {
             errors.push(error);
             return null;
           }
         })
       );

       const completed = await Promise.all(promises);

       return {
         successful: completed.filter(r => r !== null),
         failed: errors,
         statistics: this.maLiang.getStatistics()
       };
     }
   }
   ```

5. **流式处理模式**
   ```typescript
   export class StreamProcessor {
     private maLiang: MaLiang;

     public createProcessingStream(): Transform {
       return new Transform({
         objectMode: true,
         async transform(chunk: PaintRequest, encoding, callback) {
           try {
             const result = await this.maLiang.paint(chunk);
             callback(null, result);
           } catch (error) {
             // 错误不中断流，记录并继续
             this.emit('error', error);
             callback(null, { error: error.message });
           }
         }
       });
     }
   }
   ```

**现有服务集成指南**

Ma-Liang引擎专为Node.js环境设计，适合在主进程和Worker进程中运行。以下是与现有应用服务集成的最佳实践。

**集成边界与职责**

1. **Ma-Liang职责边界**
   - **仅负责**：图像/视频处理逻辑、格式转换、缩略图生成
   - **不涉及**：IPC通信、UI交互、服务生命周期管理
   - **运行环境**：Node.js主进程或Worker进程

2. **应用服务职责**
   - **负责**：IPC处理、Worker管理、任务调度、业务逻辑
   - **调用Ma-Liang**：作为底层处理引擎使用

**缩略图服务集成示例**

发现关键架构信息：thumbnail-handler.ts是**多个服务的共同底层**：
- **ThumbnailService**: 单个缩略图处理服务
- **Scan Service**: 批量扫描服务（通过Worker Pool调用）

两个服务调用路径：
```
ThumbnailService → thumbnail-worker.ts → thumbnail-handler.ts
Scan Service → Worker Pool → thumbnail-worker.ts → thumbnail-handler.ts
```

因此，**统一的集成点应该在thumbnail-handler.ts**：

```typescript
// thumbnail-handler.ts - 统一集成点
import { MaLiang } from '../ma-liang/core/MaLiang';
import { BmpBrush } from '../ma-liang/brushes/sharp/BmpBrush';

// 延迟初始化Ma-Liang实例
let maLiangInstance: MaLiang | null = null;

function getMaLiangInstance(): MaLiang {
  if (!maLiangInstance) {
    maLiangInstance = new MaLiang({
      debug: false,
      cache: { enabled: false }, // Worker环境不使用缓存
      performance: { enableMonitoring: true }
    });

    // 注册神笔
    maLiangInstance.registerBrush(new BmpBrush());
    // TODO: 注册其他神笔
  }
  return maLiangInstance;
}

export async function createThumbnail(
  arg: ThumbnailRequest,
  logger: PhotasaLogger,
  ffmpegPath?: string,
  ffprobePath?: string,
): Promise<ThumbnailRequest> {
  logger.info("[thumbnail-handler] Create Thumbnail for : " + arg.path);

  // 现有的业务逻辑检查（文件存在性、重复性等）
  // ... 保持原有逻辑 ...

  try {
    // 判断是否使用Ma-Liang处理
    if (shouldUseMaLiang(arg.path)) {
      try {
        const maLiang = getMaLiangInstance();
        const result = await maLiang.paint({
          filePath: arg.path,
          operations: ['generateThumbnail'],
          thumbnailOptions: {
            width: Number(arg.width),
            height: Number(arg.height),
          },
          outputPath: arg.thumbnail
        });

        if (result.success) {
          logger.info(`[thumbnail-handler] Ma-Liang processed: ${arg.path}`);
          return arg;
        }
      } catch (maLiangError) {
        logger.warn(`[thumbnail-handler] Ma-Liang failed, fallback to legacy: ${maLiangError.message}`);
      }
    }

    // 回退到原有处理逻辑
    return await legacyCreateThumbnail(arg, logger, ffmpegPath, ffprobePath);

  } catch (error) {
    logger.error("[thumbnail-handler] Failed to create thumbnail: " + arg.path + " due to: " + error);
    return arg;
  }
}

function shouldUseMaLiang(filePath: string): boolean {
  // 渐进式启用：先针对当前系统不支持的格式
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.bmp' || ext === '.mpg' || ext === '.mpeg';
}

// 重构现有逻辑为legacy函数
async function legacyCreateThumbnail(
  arg: ThumbnailRequest,
  logger: PhotasaLogger,
  ffmpegPath?: string,
  ffprobePath?: string,
): Promise<ThumbnailRequest> {
  // 原有的Sharp/FFmpeg处理逻辑
  // ... 现有实现 ...
}
```

**集成优势**：
- **Single Point Integration**: 一次集成，ThumbnailService和Scan Service同时受益
- **Zero Worker Changes**: thumbnail-worker.ts无需任何修改
- **Backward Compatible**: 保持现有业务逻辑和错误处理
- **Gradual Migration**: 通过shouldUseMaLiang()控制渐进式迁移

**渐进式迁移策略**

1. **第一阶段**：BMP格式概念验证
   - 仅对BMP格式启用Ma-Liang处理
   - 保持原有处理逻辑作为回退方案
   - 验证集成效果和性能表现

2. **第二阶段**：扩展格式支持
   - 逐步扩展到其他图像格式
   - 根据Ma-Liang神笔支持情况决定启用范围

3. **第三阶段**：全面迁移
   - 评估性能和稳定性后完全切换到Ma-Liang
   - 移除冗余的legacy处理代码

**API调用示例**

1. **简单图像转换**
   ```typescript
   const maLiang = ImageProcessingService.getInstance();

   // 转换BMP到PNG
   const result = await maLiang.paint({
     filePath: '/path/to/image.bmp',
     operations: ['convertFormat'],
     outputPath: '/path/to/output.png',
     options: { format: 'png', quality: 90 }
   });
   ```

2. **生成缩略图**
   ```typescript
   const result = await maLiang.paint({
     filePath: '/path/to/video.mp4',
     operations: ['generateThumbnail'],
     thumbnailOptions: {
       width: 200,
       height: 150,
       timestamp: 5.0 // 视频第5秒
     }
   });
   ```

3. **复合操作**
   ```typescript
   const result = await maLiang.paint({
     filePath: '/path/to/image.jpg',
     operations: ['extractMetadata', 'generateThumbnail', 'editImage'],
     thumbnailOptions: { width: 100, height: 100 },
     editOperations: [
       { type: 'filter', filter: { brightness: { value: 10 } } },
       { type: 'crop', crop: { x: 0, y: 0, width: 800, height: 600 } }
     ],
     outputPath: '/path/to/edited.jpg'
   });
   ```

**错误处理模式**

```typescript
export class SafeMaLiangService {
  private maLiang: MaLiang;

  public async safeProcess(request: PaintRequest): Promise<SafeResult> {
    try {
      const result = await this.maLiang.paint(request);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ValidationError) {
        // 参数错误，返回用户友好消息
        return {
          success: false,
          error: '请检查输入参数',
          details: error.context
        };
      }

      if (error instanceof FormatError) {
        // 格式不支持，提供建议
        return {
          success: false,
          error: '该文件格式暂不支持',
          suggestion: '请尝试转换为其他格式'
        };
      }

      // 未知错误，记录并返回通用消息
      logger.error('MaLiang处理失败', error);
      return {
        success: false,
        error: '处理失败，请稍后重试'
      };
    }
  }
}
```

**性能优化建议**

1. **预热神笔**：应用启动时初始化常用神笔
2. **复用实例**：使用单例模式避免重复初始化
3. **并发控制**：批处理时限制并发数量
4. **内存管理**：定期清理缓存和历史记录
5. **监控指标**：定期收集和分析性能统计

#### 5. 神笔家族设计

**FFmpeg神笔家族** - 专攻视频和部分图像格式
- `MpegBrush` - 新增.mpg/.mpeg格式支持
- `AviBrush` - 增强AVI格式支持
- `Mp4Brush` - MP4格式优化处理
- `MovBrush` - QuickTime格式处理

**Sharp神笔家族** - 专攻主流图像格式
- `BmpBrush` - 新增BMP格式支持
- `JpegBrush` - JPEG优化处理
- `PngBrush` - PNG格式处理
- `WebpBrush` - WebP格式处理
- `TiffBrush` - TIFF格式处理

**WASM-HEIF神笔** - 专攻HEIC/HEIF
- `HeifBrush` - HEIC/HEIF处理（重构现有实现）

**Photon编辑神笔** - 专攻图像编辑和特效
- `PhotonBrush` - 图像滤镜、调色、特效处理
- `FilterBrush` - 专门的滤镜处理器
- `AdjustBrush` - 亮度、对比度、饱和度调整

#### 4. 文件结构

```
src/main/ma-liang/
├── core/
│   ├── MaLiang.ts              # 主引擎实现
│   ├── MagicBrush.ts           # 神笔接口定义
│   ├── BrushRegistry.ts        # 神笔注册器
│   └── FormatDetector.ts       # 格式检测器
├── brushes/
│   ├── base/
│   │   ├── SharpBrushBase.ts   # Sharp神笔基类
│   │   ├── FfmpegBrushBase.ts  # FFmpeg神笔基类
│   │   ├── HeifBrushBase.ts    # HEIF神笔基类
│   │   └── PhotonBrushBase.ts  # Photon编辑神笔基类
│   ├── image/
│   │   ├── BmpBrush.ts         # 新增BMP支持
│   │   ├── JpegBrush.ts        # JPEG处理
│   │   ├── PngBrush.ts         # PNG处理
│   │   ├── WebpBrush.ts        # WebP处理
│   │   └── TiffBrush.ts        # TIFF处理
│   ├── video/
│   │   ├── MpegBrush.ts        # 新增MPEG支持
│   │   ├── AviBrush.ts         # AVI处理
│   │   ├── Mp4Brush.ts         # MP4处理
│   │   └── MovBrush.ts         # QuickTime处理
│   ├── heif/
│   │   └── HeifBrush.ts        # HEIC/HEIF处理
│   └── editing/
│       ├── PhotonBrush.ts      # Photon编辑引擎
│       ├── FilterBrush.ts      # 滤镜处理
│       └── AdjustBrush.ts      # 色彩调整
├── types/
│   ├── PaintRequest.ts         # 请求类型
│   ├── PaintResult.ts          # 结果类型
│   ├── BrushTypes.ts           # 神笔类型
│   ├── Metadata.ts             # 元数据类型
│   └── EditTypes.ts            # 编辑操作类型
├── utils/
│   ├── BrushFactory.ts         # 神笔工厂
│   ├── PerformanceMonitor.ts   # 性能监控
│   └── CacheManager.ts         # 缓存管理
└── __tests__/
    ├── core/                   # 核心功能测试
    ├── brushes/                # 神笔功能测试
    └── integration/            # 集成测试
```

#### 5. 关键实现细节

**格式检测策略**
1. **文件头检测** - 读取文件前几个字节，识别真实格式
2. **扩展名回退** - 当文件头检测失败时使用扩展名
3. **神笔匹配** - 根据检测结果选择合适的神笔

**性能优化**
1. **神笔选择缓存** - 避免重复格式检测
2. **懒加载神笔** - 按需加载神笔实例
3. **并行处理** - 支持多个神笔同时工作
4. **资源池管理** - 复用昂贵的资源（如FFmpeg实例）

**错误处理**
1. **神笔隔离** - 单个神笔故障不影响整个引擎
2. **降级策略** - 主神笔失败时尝试备用神笔
3. **详细日志** - 记录每个处理步骤的详细信息

### 实施阶段

#### 阶段1：核心框架 (Week 1-2)
- 实现MaLiang核心引擎
- 创建MagicBrush接口和基类
- 实现格式检测器和注册机制

#### 阶段2：Sharp神笔家族 (Week 2-3)
- 实现SharpBrushBase基类
- 创建BmpBrush（新增BMP支持）
- 重构现有图像处理为神笔模式

#### 阶段3：FFmpeg神笔家族 (Week 3-4)
- 实现FfmpegBrushBase基类
- 创建MpegBrush（新增MPEG支持）
- 增强现有视频处理能力

#### 阶段4：HEIF神笔重构 (Week 4-5)
- 重构现有HEIC处理为HeifBrush
- 优化错误处理和内存管理

#### 阶段5：Photon编辑神笔 (Week 5-6)
- 实现PhotonBrushBase基类
- 创建FilterBrush和AdjustBrush
- 集成Photon图像编辑功能

#### 阶段6：集成和优化 (Week 6-7)
- 替换现有处理器为Ma-Liang
- 性能优化和测试
- 文档和示例

### 向后兼容性

- **保持现有API** - 现有的thumbnail-handler等接口保持不变
- **渐进式迁移** - 内部逐步迁移到MaLiang，外部无感知
- **配置兼容** - 现有配置参数继续有效

## Drawbacks

1. **初期开发成本** - 需要较大的重构工作量
2. **复杂性增加** - 引入新的抽象层，可能增加调试难度
3. **内存开销** - 多个神笔实例可能占用更多内存
4. **学习成本** - 团队需要熟悉新的架构模式

## Alternatives

### 替代方案1：简单扩展现有代码
**方案**：直接在现有的thumbnail-handler中添加BMP和MPEG支持
**优点**：工作量小，风险低
**缺点**：无法解决架构问题，未来扩展仍然困难

### 替代方案2：微服务架构
**方案**：将图像处理拆分为独立的微服务
**优点**：完全解耦，可独立部署
**缺点**：引入网络复杂性，不适合桌面应用

### 替代方案3：插件系统
**方案**：基于插件的动态加载架构
**优点**：高度可扩展
**缺点**：复杂度过高，调试困难

### 为什么选择Ma-Liang方案

1. **平衡性好** - 在扩展性和复杂性之间找到平衡
2. **渐进式** - 可以逐步迁移，风险可控
3. **文化特色** - 神笔马良的概念有趣且易于理解
4. **实用性强** - 解决实际问题的同时提供良好的扩展性

## Unresolved Questions

1. **神笔实例管理** - 是否需要实现神笔的生命周期管理？
2. **缓存策略** - 如何在内存使用和性能之间取得平衡？
3. **错误恢复** - 当所有神笔都失败时的降级策略？
4. **性能基准** - 需要建立哪些性能指标来评估引擎效果？
5. **扩展机制** - 是否需要支持外部神笔插件？

## Success Criteria

### 功能目标
- [ ] 支持BMP图像格式的完整处理（元数据、缩略图）
- [ ] 支持MPEG/MPG视频格式的完整处理
- [ ] 集成Photon图像编辑功能（滤镜、调色、特效）
- [ ] 所有现有格式功能保持不变
- [ ] 新增格式支持只需实现新神笔，无需修改核心代码

### 性能目标
- [ ] 处理性能不低于现有实现
- [ ] 内存使用增长不超过20%
- [ ] 格式检测时间<10ms

### 质量目标
- [ ] 单元测试覆盖率>90%
- [ ] 集成测试覆盖所有支持格式
- [ ] 错误处理覆盖所有异常场景

### 可维护性目标
- [ ] 新增格式支持工作量<1天
- [ ] 代码重复度<5%
- [ ] 所有神笔有完整的文档和示例

## Implementation Plan

详细的实施计划将在RFC批准后制定，大致时间线：

- **Week 1-2**: 核心框架开发
- **Week 2-3**: Sharp神笔家族实现
- **Week 3-4**: FFmpeg神笔家族实现
- **Week 4-5**: HEIF神笔重构
- **Week 5-6**: Photon编辑神笔实现
- **Week 6-7**: 集成测试和优化
- **Week 7-8**: 文档和代码审查

总计约8周完成全部开发工作。

### Photon编辑能力详细规划

**滤镜功能**：
- 基础滤镜：模糊、锐化、灰度、怀旧、噪点
- 艺术滤镜：浮雕、边缘检测、油画效果
- 色彩滤镜：暖色调、冷色调、反色

**调整功能**：
- 基础调整：亮度、对比度、饱和度、色相
- 高级调整：伽马值、高光/阴影、色彩平衡
- 曲线调整：RGB曲线、色调曲线

**特效功能**：
- 晕影效果、渐变叠加、纹理叠加
- 光线效果、镜头光晕、景深模拟

## Future Technology Roadmap

### 🚀 Phase 1: Core Enhancement (3-6 months)
**Computer Vision & AI Capabilities**
- **OpenCV.js** - `VisionBrush` for intelligent cropping, auto composition, red-eye removal
- **TensorFlow.js** - `AiBrush` for style transfer, super-resolution, auto enhancement
- **WebCodecs API** - `WebCodecsBrush` for native browser encoding/decoding
- **Origin Private File System API** - `OpfsBrush` for high-performance large file caching

### 🌈 Phase 2: Advanced Processing (6-12 months)
**Scientific & Professional Tools**
- **ImageMagick WASM** - `MagickBrush` for complex image operations
- **NumJs/Danfo.js** - `SciCompBrush` for scientific image analysis
- **Paper.js** - `VectorBrush` for vectorization and path operations
- **ML5.js** - `CreativeAIBrush` for creative machine learning

### 🎭 Phase 3: Creative & Interactive (12-18 months)
**Artistic & Gaming Capabilities**
- **Three.js** - `ThreeDBrush` for 3D effects and stereoscopic display
- **Fabric.js** - `DesignBrush` for graphic design and interactive editing
- **PixiJS** - `GameBrush` for gamified editing interfaces
- **Lottie** - `AnimationBrush` for dynamic effects overlay

### 🔬 Phase 4: Specialized Domains (18-24 months)
**Scientific & Medical Applications**
- **ImageJ.js** - `ScientificBrush` for scientific image analysis
- **VTK.js** - `Medical3DBrush` for medical imaging processing
- **Turf.js** - `GeoAnalyticsBrush` for geospatial analysis
- **Apache Arrow** - `BigDataBrush` for massive image analysis

### 🔮 Phase 5: Future Technologies (2+ years)
**Emerging & Experimental**
- **WebXR** - `XRBrush` for VR/AR content creation
- **Web Neural Network API** - `WebNNBrush` for hardware-accelerated AI
- **Brain-Computer Interface** - `BciBrush` for mind-controlled editing
- **Gesture Recognition** - `GestureBrush` for touchless editing

### 🌍 Long-term Vision: Ma-Liang Universe
**Complete Creative Ecosystem**
```typescript
interface MaLiangUniverse {
  core: MaLiangEngine           // Core processing engine
  marketplace: BrushStore       // Community brush marketplace
  ai: MaLiangAI                // AI assistant and automation
  cloud: MaLiangCloud          // Cloud processing services
  sdk: MaLiangSDK              // Developer tools and APIs
  community: MaLiangCommunity  // User community and sharing
}
```

### Technology Integration Principles
1. **Gradual Adoption** - Introduce new brushes without breaking existing functionality
2. **Performance First** - Leverage WebAssembly and GPU acceleration where possible
3. **User-Centric** - Focus on capabilities that enhance user creativity
4. **Open Ecosystem** - Enable community-developed brushes and extensions
5. **Cultural Heritage** - Maintain the artistic philosophy of the magic brush legend

### Success Metrics for Future Phases
- **Capability Coverage** - Support for 50+ image/video formats and 100+ processing operations
- **Performance** - Real-time processing for common operations, sub-second response for AI features
- **Ecosystem Growth** - Active community with 100+ community-developed brushes
- **Innovation Index** - Integration of 3+ cutting-edge technologies per year
- **User Adoption** - 10x improvement in user engagement with editing features