# 驺吾工作流系统文档
# ZouWu Workflow System Documentation

> 驺吾（ZouWu）- 源自山海经的仁德神兽，以五彩斑斓之姿守护数据流转

## 📜 驺吾传说 - 山海经中的仁德之兽

### 山海经原典

> "林氏国有珍兽，大若虎，五彩毕具，尾长于身，名曰驺吾，乘之日行千里。"
>
> —— 《山海经·海内北经》

**驺吾**是中国上古神话中的祥瑞之兽，其独特之处在于：

- **🎨 五彩斑斓** - 身披五色皮毛，象征多样性与包容
- **🦁 体型如虎** - 威武雄壮，体现力量与稳定
- **🐉 尾长于身** - 超长的尾巴，寓意链式处理
- **❤️ 性情仁德** - 不食活物，只食自然死亡之物，象征数据保护

### 技术哲学映射

驺吾的特性完美契合现代工作流系统的设计理念：

| 驺吾特性 | 技术映射 | 实现理念 |
|---------|---------|---------|
| **不食活物** | 非破坏性处理 | 始终保护原始数据完整性 |
| **五彩毕具** | 多样性支持 | 支持各种步骤类型和数据格式 |
| **尾长于身** | 链式调用 | 优雅的长链工作流处理 |
| **日行千里** | 高效执行 | 快速可靠的工作流引擎 |
| **性情温和** | 容错处理 | 温和的错误恢复机制 |

## 🚀 快速开始

```typescript
import { ZouWuWorkflow, ZouWuValidator } from '@systembug/zouwu-workflow';

// 创建驺吾工作流
const workflow: ZouWuWorkflow = {
  id: "sample_workflow",
  name: "驺吾示例工作流",
  version: "1.0.0",

  // 驺吾五彩步骤
  colors: [
    {
      id: "guardian_check",
      color: "blue",        // 青色 - 条件判断
      type: "condition",
      guardian: {           // 驺吾守护
        gentle: true,
        safe: true
      }
    }
  ],

  // 驺吾特性配置
  zouwu: {
    benevolence: true,      // 仁德模式
    fiveColors: true,       // 五彩架构
    guardian: true,         // 守护模式
    preserveData: true      // 不食活物
  }
};

// 验证工作流
const validator = new ZouWuValidator();
const result = validator.validate(workflow);

if (result.valid) {
  console.log("🎨 驺吾验证通过 - 五彩斑斓，仁德守护");
}
```

## 🎨 驺吾五彩架构

驺吾工作流采用独特的**五彩步骤系统**，每种颜色代表不同的处理逻辑：

| 颜色 | 类型 | 含义 | 驺吾特性 |
|------|------|------|---------|
| 🔵 **青色** | `condition` | 条件判断 | 智慧判断，守护检查 |
| 🔴 **赤色** | `action` | 动作执行 | 热情执行，仁德处理 |
| 🟡 **黄色** | `builtin` | 内置操作 | 稳定可靠，核心能力 |
| ⚪ **白色** | `parallel` | 并行处理 | 双翼齐飞，纯粹并发 |
| ⚫ **玄色** | `loop` | 循环处理 | 长尾递归，深邃轮回 |

## 📚 核心文档

- **[驺吾工作流规范 v1.0](./zouwu-workflow-specification-v1.0.md)** - 完整的语法规范
- **[驺吾传说详解](./zouwu-legend.md)** - 山海经文化背景
- **[API 参考](./api-reference.md)** - TypeScript接口文档
- **[示例集合](../examples/)** - 实际使用示例

## 🔧 驺吾特色功能

### 仁德模式 (Benevolent Mode)

```yaml
benevolent:
  nonDestructive: true      # 非破坏性处理
  preserveOriginal: true    # 保护原始数据
  gentleErrors: true        # 温和错误处理
```

### 守护模式 (Guardian Mode)

```yaml
guardian:
  gentle: true              # 温和守护
  safe: true                # 安全保护
  validate: true            # 自动验证
```

### 长尾特性 (Long Tail Feature)

```yaml
tail:
  long: true                # 支持长链调用
  graceful: true            # 优雅处理
  recursive: true           # 递归支持
```

### 双翼并行 (Dual Wings Parallel)

```yaml
wings:
  left: "validation"        # 左翼任务
  right: "transformation"   # 右翼任务
  synchronized: true        # 同步飞行
```

## 🌟 为什么选择驺吾

1. **文化传承** - 将千年中华神话融入现代技术
2. **独特理念** - 全球首个以"仁德"为核心的工作流系统
3. **技术创新** - 五彩架构带来直观的工作流设计
4. **生态友好** - 非破坏性处理保护数据生态
5. **易于理解** - 神话隐喻让技术概念更加生动

## 🛠️ 工具生态

- **@systembug/zouwu-workflow** - 驺吾工作流核心包
- **@systembug/zouwu-cli** - 驺吾命令行工具
- **zouwu-vscode** - VS Code 插件（计划中）
- **zouwu-studio** - 可视化设计器（计划中）

## 💡 设计理念

> "技术如驺吾，当以仁德为本，守护为要。"

驺吾工作流不仅是一个技术工具，更是一种设计哲学的体现：

- **仁** - 对数据的仁慈，永不破坏
- **德** - 对用户的德行，温和处理
- **美** - 对代码的美感，五彩斑斓
- **和** - 对系统的和谐，生态共存

## 📖 使用示例

### 基础工作流

```yaml
# sample.zouwu
id: "hello_zouwu"
name: "驺吾问候"
version: "1.0.0"

colors:
  - id: "greeting"
    color: yellow
    type: "builtin"
    action: "log"
    input:
      message: "🎨 驺吾向您问好 - 五彩斑斓，仁德守护"

zouwu:
  benevolence: true
  fiveColors: true
```

### CLI 使用

```bash
# 初始化驺吾工作流
zouwu init

# 验证工作流（五彩鉴别）
zouwu validate sample.zouwu

# 执行工作流（驺吾巡护）
zouwu run sample.zouwu

# 守护模式监控
zouwu guard --watch
```

## 🏛️ 文化意义

驺吾工作流是技术与文化的完美结合：

- 传承中华文化的科技创新
- 将"仁德"理念带入代码世界
- 用神话故事让技术更有温度
- 建立独特的中国技术品牌

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

---

*驺吾工作流 - 传承千年仁德，守护现代数据*

*ZouWu Workflow - Ancient Benevolence, Modern Protection*

> "五彩斑斓护数据，仁德之心永流传"