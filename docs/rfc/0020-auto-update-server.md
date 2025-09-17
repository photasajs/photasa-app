# RFC 0020: Auto-Update System - Server Implementation

- **Start Date**: 2025-09-14
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

专注于Photasa桌面应用自动更新系统的服务器端实现。基于photasa.me现有Next.js架构，集成Supabase数据库，提供版本管理、文件分发、下载统计等完整的更新服务器功能。配套的客户端实现在RFC 0019中详细说明。

## Motivation

### Why are we doing this?

1. **自主可控**：完全掌控更新分发流程，不依赖第三方服务
2. **品牌体验**：提供一致的品牌体验和自定义更新页面
3. **详细分析**：获得详细的下载统计和用户行为数据
4. **灵活策略**：支持A/B测试、分阶段发布等高级更新策略
5. **性能优化**：利用CDN和边缘计算提供更好的下载体验

### What use cases does it support?

- 自动版本检查和更新分发
- 手动下载页面和版本历史浏览
- 实时下载统计和用户分析
- 分平台文件管理和分发
- 更新公告和发布说明展示

## Detailed Design

### Architecture Overview

```
photasa.me Update Server Architecture
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                         │
├─────────────────────────────────────────────────────────────┤
│  API Routes           │  Pages              │  Components   │
│  ├── /api/updates/    │  ├── /updates/     │  ├── UI       │
│  │   ├── releases/    │  │   ├── download  │  ├── Analytics│
│  │   ├── download/    │  │   └── changelog │  └── Admin    │
│  │   └── stats        │  └── /admin/       │              │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Integration                     │
│  ├── PostgreSQL Database                                   │
│  ├── Realtime Subscriptions                               │
│  ├── Edge Functions                                       │
│  └── Storage (Optional)                                   │
├─────────────────────────────────────────────────────────────┤
│  File Storage & CDN    │  Analytics       │  Monitoring    │
│  ├── Vercel Blob      │  ├── Supabase    │  ├── Sentry     │
│  ├── AWS S3 (Option)  │  ├── Vercel      │  ├── Vercel     │
│  └── Vercel CDN       │  └── Custom      │  └── Custom     │
└─────────────────────────────────────────────────────────────┘
```

### Server Implementation Options

#### Option 1: GitHub Releases (参考实现)

**优点**：

- 免费且可靠的托管服务
- 与代码仓库天然集成
- 自动版本管理和发布流程
- 全球CDN加速下载

**缺点**：

- 依赖第三方服务可用性
- 下载速度可能受网络环境影响
- 品牌展示受限
- 统计功能有限

#### Option 2: photasa.me 自托管服务 (推荐)

**优点**：

- 完全自主控制更新流程
- 可自定义更新页面和品牌展示
- 更好的下载速度和可用性保障
- 支持详细的更新统计和用户行为分析
- 可实现更复杂的更新策略和A/B测试

### File Structure

```
photasa.me/
├── pages/api/updates/
│   ├── check.ts           # 版本检查API
│   ├── download/[id].ts   # 下载统计和重定向
│   ├── feedback.ts        # 更新反馈收集
│   └── releases/
│       ├── latest.yml.ts      # Windows版本信息API
│       ├── latest-mac.yml.ts  # macOS版本信息API
│       └── [platform]/[file].ts  # 文件下载API
├── pages/updates/
│   ├── changelog.tsx      # 版本更新日志页面
│   └── download.tsx       # 手动下载页面
├── pages/admin/
│   ├── releases.tsx       # 版本管理界面
│   └── analytics.tsx      # 下载统计面板
└── lib/
    ├── supabase.ts        # Supabase客户端配置
    ├── storage.ts         # 文件存储服务
    └── analytics.ts       # 统计分析服务
```

### 🔄 URL 重写代理方案

#### 核心问题解决

**问题描述**：UploadThing CDN生成的文件URL包含冒号字符（`https://utfs.io/f/xxx`），导致electron-updater下载时创建包含冒号的临时文件路径，在Windows和macOS系统中被禁止。

**解决策略**：通过服务端URL重写代理，让客户端看到安全的文件路径，服务端负责重定向到实际的UploadThing URL。

#### 📦 自动更新文件格式说明

**重要：自动更新使用ZIP格式，不是EXE/DMG**

- **所有平台**: 统一使用 ZIP 格式进行自动更新
  - **Windows**: `Photasa-1.6.0-win.zip`
  - **macOS**: `Photasa-1.6.0-mac.zip`
  - **Linux**: `Photasa-1.6.0-linux.zip`
- **原因**: ZIP格式是electron-updater的标准自动更新格式
  - 跨平台一致性
  - 更好的压缩率和下载速度
  - electron-updater原生支持

#### ⚠️ 客户端配置要求

**关键：必须移除 setFeedURL 调用**

```typescript
// ❌ 错误：不要在代码中调用 setFeedURL
autoUpdater.setFeedURL({
    provider: "generic",
    url: "https://photasa.me/api/updates/releases",
});

// ✅ 正确：使用配置文件驱动
// electron-updater 会自动从以下文件读取配置：
// 开发环境：dev-app-update.yml
// 生产环境：app-update.yml (由 electron-builder.yml 生成)
```

**必需的配置文件**：

```yaml
# dev-app-update.yml (项目根目录)
provider: generic
url: https://photasa.me/api/updates/releases
updaterCacheDirName: photasa-updater
```

```yaml
# electron-builder.yml (publish 配置)
publish:
    provider: generic
    url: https://photasa.me/api/updates/releases
```

#### 代理架构设计

```
Client (electron-updater)
    ↓ GET /api/updates/releases/latest.yml
Server Response: { "files": [{ "url": "Photasa-1.6.0-win.zip" }] }
    ↓ GET /api/updates/releases/Photasa-1.6.0-win.zip
Server Proxy: 302 Redirect → https://utfs.io/f/4CQT2JNmMDi7rIPL
    ↓
UploadThing CDN
```

#### 文件映射数据库设计

```sql
-- 文件下载映射表
CREATE TABLE download_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'win', 'mac', 'linux'
    safe_filename VARCHAR(255) NOT NULL, -- 'Photasa-1.6.0-win.zip'
    actual_url TEXT NOT NULL, -- 'https://utfs.io/f/xxx'
    file_size BIGINT NOT NULL,
    sha512_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 约束和索引
    UNIQUE(version, platform),
    UNIQUE(safe_filename), -- 确保安全文件名唯一性
    INDEX idx_version_platform (version, platform),
    INDEX idx_safe_filename (safe_filename), -- 支持通过文件名快速查找
    INDEX idx_created_at (created_at DESC) -- 支持按时间排序查询最新版本
);

-- 下载统计表
CREATE TABLE download_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id UUID REFERENCES download_mappings(id),
    user_agent TEXT,
    ip_address INET,
    country_code CHAR(2),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_mapping_downloaded (mapping_id, downloaded_at),
    INDEX idx_downloaded_at (downloaded_at)
);
```

#### 安全文件名生成规则

```typescript
interface SafeFilenameConfig {
    appName: string;      // "Photasa"
    version: string;      // "1.6.0"
    platform: string;    // "win" | "mac" | "linux"
    extension: string;    // "exe" | "zip" | "dmg"
}

function generateSafeFilename(config: SafeFilenameConfig): string {
    const { appName, version, platform, extension } = config;
    
    // 基于实际的 electron-builder.yml 配置
    // 注意：自动更新使用 ZIP 格式，不是 EXE/DMG
    switch (platform) {
        case 'win':
            // 自动更新使用 zip 格式，不是 nsis setup.exe
            // zip 目标使用默认格式（无自定义 artifactName）
            return `${appName}-${version}-win.${extension}`;
        
        case 'mac':
            // 自动更新使用 zip 格式，不是 dmg
            // zip 目标使用默认格式（无自定义 artifactName）
            return `${appName}-${version}-mac.${extension}`;
        
        case 'linux':
            // 自动更新使用 zip 格式，统一跨平台
            return `${appName}-${version}-linux.${extension}`;
        
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // 示例（自动更新文件，统一使用 ZIP）：
    // Windows: "Photasa-1.6.0-win.zip"
    // macOS:   "Photasa-1.6.0-mac.zip"
    // Linux:   "Photasa-1.6.0-linux.zip"
}
```

#### 数据库操作函数

```typescript
// lib/download-mappings.ts
import { supabase } from './supabase';

interface DownloadMapping {
    id: string;
    version: string;
    platform: string;
    safe_filename: string;  // 关键：安全文件名用于URL路由
    actual_url: string;
    file_size: number;
    sha512_hash: string;
    created_at: string;
}

/**
 * 通过安全文件名获取映射（核心函数）
 * 用于 /api/updates/releases/[filename] 路由
 */
export async function getMappingByFilename(filename: string): Promise<DownloadMapping | null> {
    const { data, error } = await supabase
        .from('download_mappings')
        .select('*')
        .eq('safe_filename', filename)
        .single();
    
    if (error) {
        console.error('Error fetching mapping by filename:', error);
        return null;
    }
    
    return data;
}

/**
 * 获取特定平台的最新版本映射
 * 用于生成 latest.yml
 */
export async function getLatestMapping(platform: string): Promise<DownloadMapping | null> {
    const { data, error } = await supabase
        .from('download_mappings')
        .select('*')
        .eq('platform', platform)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error) {
        console.error('Error fetching latest mapping:', error);
        return null;
    }
    
    return data;
}

/**
 * 创建新的文件映射
 * 用于发布新版本时
 */
export async function createMapping(mapping: Omit<DownloadMapping, 'id' | 'created_at'>): Promise<string | null> {
    const { data, error } = await supabase
        .from('download_mappings')
        .insert([mapping])
        .select('id')
        .single();
    
    if (error) {
        console.error('Error creating mapping:', error);
        return null;
    }
    
    return data.id;
}

/**
 * 记录下载统计
 */
export async function recordDownload(stats: {
    mappingId: string;
    userAgent: string;
    ipAddress: string;
    filename: string;
}): Promise<void> {
    const { error } = await supabase
        .from('download_stats')
        .insert([{
            mapping_id: stats.mappingId,
            user_agent: stats.userAgent,
            ip_address: stats.ipAddress,
            filename: stats.filename
        }]);
    
    if (error) {
        console.error('Error recording download:', error);
    }
}
```

### API Implementation

#### 1. Latest.yml 生成 API（使用安全文件名）

```typescript
// pages/api/updates/releases/latest.yml.ts (Windows)
import { NextApiRequest, NextApiResponse } from "next";
import { getLatestMapping } from "@/lib/download-mappings";
import { generateSafeFilename } from "@/lib/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const platform = 'win';
        const mapping = await getLatestMapping(platform);

        if (!mapping) {
            return res.status(404).json({ error: "No version found" });
        }

        // 使用安全的文件名（不包含冒号）
        const safeFilename = generateSafeFilename({
            appName: "Photasa",
            version: mapping.version,
            platform: platform,
            extension: "zip"
        });

        const yamlContent = `version: ${mapping.version}
files:
  - url: ${safeFilename}
    sha512: ${mapping.sha512_hash}
    size: ${mapping.file_size}
path: ${safeFilename}
sha512: ${mapping.sha512_hash}
releaseDate: '${mapping.created_at}'`;

        res.setHeader("Content-Type", "text/yaml");
        res.setHeader("Cache-Control", "public, max-age=300"); // 5分钟缓存
        res.status(200).send(yamlContent);
    } catch (error) {
        console.error("Error generating latest.yml:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
```

#### 2. 文件下载代理 API（URL重写核心）

```typescript
// pages/api/updates/releases/[filename]/route.ts (App Router格式)
import { NextRequest, NextResponse } from "next/server";
import { getMappingByFilename, recordDownload } from "@/lib/download-mappings";
import { getClientIP, getUserAgent } from "@/lib/request-utils";

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    const { filename } = params;
    
    try {
        // 1. 解析文件名获取版本和平台信息
        const fileInfo = parseFilename(filename);
        if (!fileInfo) {
            return NextResponse.json(
                { error: "Invalid filename format" },
                { status: 400 }
            );
        }

        // 2. 从数据库获取文件映射（通过安全文件名直接查找）
        const mapping = await getMappingByFilename(filename);
        if (!mapping) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        // 3. 记录下载统计（异步，不阻塞重定向）
        recordDownload({
            mappingId: mapping.id,
            userAgent: getUserAgent(request),
            ipAddress: getClientIP(request),
            filename: filename
        }).catch(err => console.error("Failed to record download:", err));

        // 4. 重定向到实际的 UploadThing URL
        return NextResponse.redirect(mapping.actual_url, 302);

    } catch (error) {
        console.error("Download proxy error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// 解析安全文件名，提取版本和平台信息
function parseFilename(filename: string): { version: string; platform: string } | null {
    // 支持自动更新文件格式（统一使用 ZIP）：
    // Photasa-1.6.0-win.zip → { version: "1.6.0", platform: "win" }
    // Photasa-1.6.0-mac.zip → { version: "1.6.0", platform: "mac" }
    // Photasa-1.6.0-linux.zip → { version: "1.6.0", platform: "linux" }
    
    const patterns = [
        /^Photasa-(.+)-win\.zip$/,       // Windows ZIP
        /^Photasa-(.+)-mac\.zip$/,       // macOS ZIP
        /^Photasa-(.+)-linux\.zip$/,     // Linux ZIP
    ];
    
    for (const [index, pattern] of patterns.entries()) {
        const match = filename.match(pattern);
        if (match) {
            const platforms = ['win', 'mac', 'linux'];
            return {
                version: match[1],
                platform: platforms[index]
            };
        }
    }
    
    return null;
}
```

#### 2. Download Tracking API

```typescript
// pages/api/updates/download/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import { logDownload, getDownloadUrl } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query as { id: string };
    const userAgent = req.headers["user-agent"] || "Unknown";
    const platform = userAgent.includes("Windows") ? "win" : "mac";
    const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown";

    try {
        // 记录下载统计
        await logDownload({
            fileId: id,
            platform,
            userAgent,
            ipAddress,
            timestamp: new Date(),
        });

        // 获取实际下载URL
        const downloadUrl = await getDownloadUrl(id);

        if (!downloadUrl) {
            return res.status(404).json({ error: "File not found" });
        }

        // 重定向到实际下载链接
        res.redirect(302, downloadUrl);
    } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ error: "Download failed" });
    }
}
```

#### 3. Statistics API

```typescript
// pages/api/updates/stats.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getDownloadStats } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const stats = await getDownloadStats();

        res.json({
            totalDownloads: stats.totalDownloads,
            todayDownloads: stats.todayDownloads,
            platformStats: {
                windows: stats.winDownloads,
                mac: stats.macDownloads,
            },
            uniqueUsersToday: stats.uniqueUsersToday,
            recentDownloads: stats.recentDownloads,
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
}
```

### Database Design (Supabase)

#### Tables Schema

```sql
-- 版本信息表
CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL UNIQUE,
  platform VARCHAR(10) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  sha512 TEXT NOT NULL,
  release_notes TEXT,
  is_prerelease BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 下载统计详情表
CREATE TABLE download_stats (
  id SERIAL PRIMARY KEY,
  file_id VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  platform VARCHAR(10) NOT NULL,
  user_agent TEXT,
  ip_address INET,
  country VARCHAR(2),
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 下载计数器表 (优化查询性能)
CREATE TABLE download_counters (
  file_id VARCHAR(50) PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  total_downloads INTEGER DEFAULT 0,
  win_downloads INTEGER DEFAULT 0,
  mac_downloads INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_download_stats_file_platform ON download_stats(file_id, platform);
CREATE INDEX idx_download_stats_downloaded_at ON download_stats(downloaded_at);
CREATE INDEX idx_versions_platform_active ON versions(platform, is_active);
```

#### Stored Functions

```sql
-- 原子性更新下载计数器
CREATE OR REPLACE FUNCTION increment_download_counter(
  file_id_param VARCHAR(50),
  platform_param VARCHAR(10)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO download_counters (file_id, version, total_downloads, win_downloads, mac_downloads)
  VALUES (
    file_id_param,
    (SELECT version FROM versions WHERE id = file_id_param::INTEGER),
    CASE WHEN platform_param = 'win' THEN 1 ELSE 0 END,
    CASE WHEN platform_param = 'win' THEN 1 ELSE 0 END,
    CASE WHEN platform_param = 'mac' THEN 1 ELSE 0 END
  )
  ON CONFLICT (file_id) DO UPDATE SET
    total_downloads = download_counters.total_downloads + 1,
    win_downloads = download_counters.win_downloads +
                   CASE WHEN platform_param = 'win' THEN 1 ELSE 0 END,
    mac_downloads = download_counters.mac_downloads +
                   CASE WHEN platform_param = 'mac' THEN 1 ELSE 0 END,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;  -- PostgreSQL procedural language (PL/pgSQL)

-- 触发器：自动更新计数器
CREATE OR REPLACE FUNCTION update_download_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新对应的计数器
  UPDATE download_counters SET
    total_downloads = download_counters.total_downloads + 1,
    win_downloads = download_counters.win_downloads + CASE WHEN NEW.platform = 'win' THEN 1 ELSE 0 END,
    mac_downloads = download_counters.mac_downloads + CASE WHEN NEW.platform = 'mac' THEN 1 ELSE 0 END,
    last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;  -- PostgreSQL procedural language (PL/pgSQL)

CREATE TRIGGER trigger_update_download_counters
  AFTER INSERT ON download_stats
  FOR EACH ROW EXECUTE FUNCTION update_download_counters();
```

### Supabase Integration

#### Client Setup

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface Version {
    id: number;
    version: string;
    platform: "win" | "mac";
    file_url: string;
    file_size: number;
    sha512: string;
    release_notes?: string;
    is_prerelease: boolean;
    is_active: boolean;
    created_at: string;
    released_at: string;
}

export interface DownloadStat {
    id: number;
    file_id: string;
    version: string;
    platform: "win" | "mac";
    user_agent: string;
    ip_address: string;
    country?: string;
    downloaded_at: string;
}

// 获取最新版本
export async function getLatestVersion(platform: "win" | "mac"): Promise<Version | null> {
    const { data, error } = await supabase
        .from("versions")
        .select("*")
        .eq("platform", platform)
        .eq("is_active", true)
        .eq("is_prerelease", false)
        .order("released_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching latest version:", error);
        return null;
    }

    return data;
}

// 记录下载统计
export async function logDownload(params: {
    fileId: string;
    platform: "win" | "mac";
    userAgent: string;
    ipAddress: string;
    timestamp: Date;
}) {
    const { fileId, platform, userAgent, ipAddress, timestamp } = params;

    // 插入详细下载记录
    const { error: statsError } = await supabase.from("download_stats").insert({
        file_id: fileId,
        version: "", // 将通过触发器或函数自动填充
        platform,
        user_agent: userAgent,
        ip_address: ipAddress,
        downloaded_at: timestamp.toISOString(),
    });

    if (statsError) {
        console.error("Error logging download:", statsError);
        throw statsError;
    }

    // 原子性更新计数器
    const { error: counterError } = await supabase.rpc("increment_download_counter", {
        file_id_param: fileId,
        platform_param: platform,
    });

    if (counterError) {
        console.error("Error updating counter:", counterError);
        throw counterError;
    }
}

// 获取下载统计
export async function getDownloadStats() {
    const today = new Date().toISOString().split("T")[0];

    // 获取总体统计
    const { data: counters } = await supabase
        .from("download_counters")
        .select("total_downloads, win_downloads, mac_downloads");

    // 获取今日下载数
    const { data: todayStats, count: todayCount } = await supabase
        .from("download_stats")
        .select("*", { count: "exact" })
        .gte("downloaded_at", today);

    // 获取今日独立用户数
    const { data: uniqueUsers } = await supabase
        .from("download_stats")
        .select("ip_address")
        .gte("downloaded_at", today);

    const uniqueUsersCount = new Set(uniqueUsers?.map((u) => u.ip_address)).size;

    // 计算总计
    const totals = counters?.reduce(
        (acc, row) => ({
            total: acc.total + row.total_downloads,
            windows: acc.windows + row.win_downloads,
            mac: acc.mac + row.mac_downloads,
        }),
        { total: 0, windows: 0, mac: 0 },
    );

    return {
        totalDownloads: totals?.total || 0,
        winDownloads: totals?.windows || 0,
        macDownloads: totals?.mac || 0,
        todayDownloads: todayCount || 0,
        uniqueUsersToday: uniqueUsersCount,
        recentDownloads: todayStats?.slice(0, 10) || [],
    };
}

// 实时统计订阅
export function subscribeToDownloadStats(callback: (stats: any) => void) {
    return supabase
        .channel("download_stats")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "download_counters" },
            callback,
        )
        .subscribe();
}
```

### File Storage Options

#### Option 1: Vercel Blob Storage

```typescript
// lib/storage.ts
import { put, del, list } from "@vercel/blob";

export async function uploadReleaseFile(
    file: File,
    version: string,
    platform: "win" | "mac" | "linux",
): Promise<string> {
    const fileName = `Photasa-${version}-${platform}.zip`;  // 统一ZIP格式
    const filePath = `releases/${platform}/${fileName}`;

    const blob = await put(filePath, file, {
        access: "public",
    });

    return blob.url;
}

export async function deleteReleaseFile(url: string): Promise<void> {
    await del(url);
}

export async function listReleaseFiles() {
    const { blobs } = await list({
        prefix: "releases/",
    });

    return blobs;
}
```

#### Option 2: AWS S3 Integration

```typescript
// lib/s3-storage.ts
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

export async function uploadToS3(file: Buffer, key: string, contentType: string): Promise<string> {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: file,
        ContentType: contentType,
        ACL: "public-read",
    };

    const result = await s3.upload(params).promise();
    return result.Location;
}
```

### Frontend Pages

#### 1. Download Page

```tsx
// pages/updates/download.tsx
import { GetStaticProps } from "next";
import { getLatestVersion } from "@/lib/supabase";

interface DownloadPageProps {
    windowsVersion: Version | null;
    macVersion: Version | null;
}

export default function DownloadPage({ windowsVersion, macVersion }: DownloadPageProps) {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold text-center mb-8">下载 Photasa</h1>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Windows Download */}
                {windowsVersion && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center mb-4">
                            <WindowsIcon className="w-8 h-8 mr-3" />
                            <h2 className="text-2xl font-semibold">Windows</h2>
                        </div>

                        <div className="mb-4">
                            <p className="text-gray-600">版本 {windowsVersion.version}</p>
                            <p className="text-sm text-gray-500">
                                文件大小: {Math.round(windowsVersion.file_size / 1024 / 1024)} MB
                            </p>
                        </div>

                        <a
                            href={`/api/updates/download/${windowsVersion.id}`}
                            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
                        >
                            下载 Windows 版本
                        </a>
                    </div>
                )}

                {/* macOS Download */}
                {macVersion && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center mb-4">
                            <AppleIcon className="w-8 h-8 mr-3" />
                            <h2 className="text-2xl font-semibold">macOS</h2>
                        </div>

                        <div className="mb-4">
                            <p className="text-gray-600">版本 {macVersion.version}</p>
                            <p className="text-sm text-gray-500">
                                文件大小: {Math.round(macVersion.file_size / 1024 / 1024)} MB
                            </p>
                        </div>

                        <a
                            href={`/api/updates/download/${macVersion.id}`}
                            className="w-full bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors inline-block text-center"
                        >
                            下载 macOS 版本
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export const getStaticProps: GetStaticProps = async () => {
    const [windowsVersion, macVersion] = await Promise.all([
        getLatestVersion("win"),
        getLatestVersion("mac"),
    ]);

    return {
        props: {
            windowsVersion,
            macVersion,
        },
        revalidate: 3600, // 1 hour
    };
};
```

#### 2. Analytics Dashboard

```tsx
// pages/admin/analytics.tsx
import { useState, useEffect } from "react";
import { subscribeToDownloadStats } from "@/lib/supabase";

interface DownloadStats {
    totalDownloads: number;
    todayDownloads: number;
    platformStats: {
        windows: number;
        mac: number;
    };
    uniqueUsersToday: number;
}

export default function AnalyticsDashboard() {
    const [stats, setStats] = useState<DownloadStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 初始加载统计数据
        fetch("/api/updates/stats")
            .then((res) => res.json())
            .then((data) => {
                setStats(data);
                setIsLoading(false);
            });

        // 订阅实时更新
        const subscription = subscribeToDownloadStats((payload) => {
            // 重新获取最新统计
            fetch("/api/updates/stats")
                .then((res) => res.json())
                .then((data) => setStats(data));
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (isLoading) {
        return <div>加载中...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">下载统计</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="总下载量" value={stats?.totalDownloads || 0} />
                <StatCard title="今日下载" value={stats?.todayDownloads || 0} />
                <StatCard title="Windows" value={stats?.platformStats.windows || 0} />
                <StatCard title="macOS" value={stats?.platformStats.mac || 0} />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">实时数据</h2>
                <p>今日独立用户: {stats?.uniqueUsersToday || 0}</p>
            </div>
        </div>
    );
}

function StatCard({ title, value }: { title: string; value: number }) {
    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
    );
}
```

### Deployment Configuration

#### Environment Variables

```bash
# .env.local
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 文件存储配置 (选择其一)
# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_token

# AWS S3 (可选)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=photasa-releases

# 安全配置
ADMIN_API_KEY=your-admin-api-key
WEBHOOK_SECRET=your-webhook-secret
```

#### Vercel Deployment

```json
// vercel.json
{
    "functions": {
        "pages/api/**/*.ts": {
            "maxDuration": 30
        }
    },
    "redirects": [
        {
            "source": "/download",
            "destination": "/updates/download",
            "permanent": true
        }
    ]
}
```

### Security Considerations

1. **API访问控制**：
    - 管理API需要认证
    - 使用Supabase RLS (Row Level Security)
    - API速率限制

2. **文件安全**：
    - 文件完整性校验 (SHA512)
    - 签名验证 (可选)
    - 恶意软件扫描

3. **数据隐私**：
    - IP地址匿名化选项
    - GDPR合规性考虑
    - 用户数据保护

### Performance Optimization

1. **CDN配置**：
    - Vercel Edge Network
    - 文件缓存策略
    - 地理分布优化

2. **数据库优化**：
    - 适当的索引设计
    - 查询优化
    - 连接池管理

3. **缓存策略**：
    - API响应缓存
    - 静态文件缓存
    - 实时数据缓存

## Implementation Timeline

### Phase 1: 基础架构 (Week 1)

- [ ] Supabase项目创建和配置
- [ ] 数据库表结构设计和创建
- [ ] 基础API路由实现
- [ ] 文件存储服务集成

### Phase 2: 核心功能 (Week 2)

- [ ] 版本检查API完整实现
- [ ] 下载跟踪和统计功能
- [ ] 管理界面开发
- [ ] 文件上传和管理功能

### Phase 3: 高级功能 (Week 3)

- [ ] 实时统计面板
- [ ] 版本管理界面
- [ ] 下载页面优化
- [ ] 安全性增强

### Phase 4: 测试和优化 (Week 4)

- [ ] 性能测试和优化
- [ ] 安全审计
- [ ] 文档完善
- [ ] 生产环境部署

## Drawbacks

1. **维护复杂度**：需要维护自己的更新服务器基础设施
2. **初始开发成本**：相比直接使用GitHub Releases需要更多开发工作
3. **可用性责任**：需要确保服务器的高可用性和稳定性
4. **存储成本**：文件存储和CDN可能产生额外费用

## Alternatives

1. **GitHub Releases**: 零维护，但功能有限
2. **第三方更新服务**: 如AppCenter，但成本较高
3. **混合方案**: 主要使用自托管，GitHub Releases作为备用

## Unresolved Questions

1. 是否需要支持增量更新以减少下载大小？
2. 如何处理不同地区的CDN分发策略？
3. 是否需要A/B测试功能来逐步推送更新？
4. 如何实现自动化的版本发布流程？

## Success Metrics

- 更新服务器可用性 > 99.9%
- 平均下载速度提升 > 50%（相比GitHub Releases）
- 详细统计数据收集覆盖率 > 95%
- 用户更新成功率 > 98%
