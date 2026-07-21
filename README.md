# Photasa

Another Picasa App powered by [Electron Vite](https://evite.netlify.app/)

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
npm run dev

# Build
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### 从根目录 / 包内启动 Tauri 应用 (Photasa)

| 场景                             | 根目录 (repo root)                                         | 包内 (apps/photasa) |
| -------------------------------- | ---------------------------------------------------------- | ------------------- |
| 启动 Tauri 开发                  | `pnpm dev` / `pnpm run tauri:dev` / `pnpm run dev:photasa` | `pnpm run dev`      |
| 仅浏览器调试前端 (无 Tauri 窗口) | `pnpm run vite:dev:photasa`                                | `pnpm run vite:dev` |
| Tauri 生产构建                   | `pnpm run build:photasa` / `pnpm run tauri:build`          | `pnpm run build`    |

## Documentation

- 📖 **[Development Guide](docs/DEV_GUIDE.md)** - Complete development setup and workflow
- 🐛 **[Debug Guide](docs/DEBUG.md)** - Debugging setup and troubleshooting
- 🔍 **[MCP Debug Guide](docs/DEBUG_MCP.md)** - Advanced MCP debugging scenarios
- 📋 **[RFCs](docs/rfc/)** - Request for Comments and design decisions
- 🎨 **[Design Docs](docs/design/)** - Architecture and design documentation
- 🐛 **[Issues](docs/issue/)** - Known issues and resolutions

## Project Structure

```
src/
├── main/          # Electron main process
├── preload/       # Preload scripts
├── renderer/      # Vue.js renderer process
├── common/        # Shared utilities (pure functions)
└── shared/        # Node.js utilities (main/preload only)
```

## Technology Stack

- **Frontend**: Vue 3 + TypeScript + Tailwind CSS
- **Backend**: Electron + Node.js
- **Build**: Vite + electron-vite
- **Testing**: Vitest + Playwright
