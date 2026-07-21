# Photasa

Another Picasa App powered by [Electron Vite](https://evite.netlify.app/)

pnpm workspaces monorepo；桌面端为 `@photasa/desktop`（Electron）。

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:desktop

# Build
pnpm --filter @photasa/desktop build:mac    # macOS
pnpm --filter @photasa/desktop build:win    # Windows
pnpm --filter @photasa/desktop build:linux  # Linux
```

## Documentation

- 📖 **[Development Guide](docs/DEV_GUIDE.md)** - Complete development setup and workflow
- 🐛 **[Debug Guide](docs/DEBUG.md)** - Debugging setup and troubleshooting
- 🔍 **[MCP Debug Guide](docs/DEBUG_MCP.md)** - Advanced MCP debugging scenarios
- 📋 **[RFCs & Roadmap](.spec/ROADMAP.md)** - Request for Comments and design decisions (files in `.spec/rfc/`)
- 🎨 **[Design Docs](docs/design/)** - Architecture and design documentation
- 🐛 **[Issues](docs/issue/)** - Known issues and resolutions

## Project Structure

```
apps/
└── desktop/              # @photasa/desktop — Electron 主应用
    └── src/
        ├── main/           # Electron main process
        ├── preload/        # Preload scripts
        ├── renderer/       # Vue.js renderer process
        ├── common/         # Shared utilities (pure functions)
        └── shared/         # Node.js utilities (main/preload only)
packages/
├── common/               # @photasa/common
└── @photasa/             # 共享引擎与服务包
```

## Technology Stack

- **Frontend**: Vue 3 + TypeScript + Tailwind CSS
- **Backend**: Electron + Node.js
- **Build**: Vite + electron-vite + pnpm workspaces
- **Testing**: Vitest + Playwright
