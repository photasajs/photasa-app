# Photasa

Another Picasa App powered by [Electron Vite](https://evite.netlify.app/)

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

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
