# @systembug/logger

平台中立的日志库，支持Node.js和浏览器环境。

## 特性

- ✅ 平台中立（Node.js + 浏览器）
- ✅ TypeScript支持
- ✅ 多日志级别（DEBUG, INFO, WARN, ERROR）
- ✅ 可插拔传输器
- ✅ 上下文支持
- ✅ 生产环境自动禁用日志
- ✅ ESM + CJS双格式

## 安装

```bash
pnpm add @systembug/logger
```

## 使用

### 基本用法

```typescript
import { createLogger, LogLevel } from "@systembug/logger";

const logger = createLogger({
    level: LogLevel.INFO,
    context: "MyApp",
});

logger.debug("调试信息"); // 不会输出（级别低于INFO）
logger.info("普通信息");
logger.warn("警告信息");
logger.error("错误信息");
```

### 带上下文的子Logger

```typescript
const logger = createLogger({ context: "App" });
const dbLogger = logger.child("Database");

dbLogger.info("连接成功"); // 输出: [App:Database] 连接成功
```

### 自定义传输器

```typescript
import { Logger, LogTransport, LogEntry } from "@systembug/logger";

class FileTransport implements LogTransport {
    log(entry: LogEntry): void {
        // 写入文件
    }
}

const logger = new Logger({
    transports: [new FileTransport()],
});
```

### 生产环境

在生产环境下（`NODE_ENV=production`），所有日志会自动禁用。

也可以手动控制：

```typescript
const logger = createLogger({
    isProduction: true, // 强制禁用日志
});
```

## API

### LogLevel

```typescript
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}
```

### Logger

- `debug(message, ...args)` - 记录调试日志
- `info(message, ...args)` - 记录信息日志
- `warn(message, ...args)` - 记录警告日志
- `error(message, ...args)` - 记录错误日志
- `setLevel(level)` - 设置日志级别
- `getLevel()` - 获取日志级别
- `child(context)` - 创建子Logger
- `isProduction()` - 检查是否为生产环境

## License

MIT
