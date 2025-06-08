# Photasa Photo Import System Design

## Overview
The photo import system in Photasa is designed to efficiently scan, organize, and import photos and videos from source directories into a structured target directory. The system uses a date-based organization pattern and maintains metadata in `.photasa.json` configuration files.

## System Architecture

```mermaid
graph TB
    subgraph UI Layer
        A[Import Dialog] --> B[Import Handler]
        B --> C[Progress Modal]
    end

    subgraph Preload Layer
        D[Photo Import Service] --> E[Path Helper]
        E --> F[EXIF Helper]
        D --> G[File Helper]
    end

    subgraph Main Process
        H[Scan Service] --> I[Config Storage]
        H --> J[Thumbnail Handler]
    end

    B --> D
    D --> H
    I --> K[(.photasa.json)]
    J --> L[(Thumbnails)]
```

## Directory Structure
```
TargetDirectory/
├── .photasa.json           # Configuration file
├── 2024/
│   ├── 20240315/          # YYYY/YYYYMMDD format
│   │   ├── photo1.jpg
│   │   └── photo2.jpg
│   └── 20240316/
│       └── photo3.jpg
└── 2023/
    └── 20231225/
        └── photo4.jpg
```

## Import Process Sequence

```mermaid
sequenceDiagram
    participant UI as Import Dialog
    participant Import as Photo Import Service
    participant Scanner as Folder Scanner
    participant EXIF as EXIF Helper
    participant Config as Config Storage
    participant Thumb as Thumbnail Handler

    UI->>Import: Start Import(source, target)
    Import->>Scanner: scanFolder(source)
    Scanner-->>Import: File Actions

    loop For each file
        Import->>EXIF: resolveExifDate(file)
        EXIF-->>Import: Date info
        Import->>Config: ensureDir(target/date)
        Import->>Import: copyFile(source, target)
        Import->>Thumb: createThumbnail(file)
        Import->>Config: updatePhotasaConfig
    end

    Import-->>UI: Complete
```

## Data Flow

```mermaid
flowchart LR
    A[Source Files] --> B{File Type?}
    B -->|Image| C[EXIF Date]
    B -->|Video| D[File Date]
    B -->|Other| E[Skip]

    C --> F[Date Structure]
    D --> F

    F --> G[Target Path]
    G --> H[Copy File]
    H --> I[Create Thumbnail]
    I --> J[Update Config]
```

## Component Details

### 1. Import Dialog (UI)
- Source directory selection
- Target directory selection
- Duplicate handling options
- Progress monitoring

### 2. Photo Import Service
```typescript
interface ImportCallback {
    type: 'next' | 'error' | 'complete';
    action?: {
        targetFileName: string;
    };
    error?: {
        message: string;
    };
}

function importPhotos(
    folders: string[],
    target: string,
    callback: ImportCallback
): void
```

### 3. File Organization
- Date-based structure: YYYY/YYYYMMDD
- EXIF date extraction for images
- File creation date fallback
- Duplicate handling with renaming

### 4. Configuration Storage
```json
{
    "version": "1.0",
    "photoList": [
        {
            "path": "2024/20240315/photo1.jpg",
            "thumbnail": "thumbnails/photo1.jpg",
            "isVideo": false,
            "history": []
        }
    ]
}
```

## Error Handling

```mermaid
graph TD
    A[Import Error] --> B{Error Type}
    B -->|File Access| C[Skip File]
    B -->|EXIF Error| D[Use File Date]
    B -->|Duplicate| E[Rename File]
    B -->|Config Error| F[Retry Config]
    C --> G[Continue Import]
    D --> G
    E --> G
    F --> G
```

## Performance Considerations

1. **Batch Processing**
   - Files are processed in batches
   - Thumbnail generation is queued
   - Config updates are batched

2. **Memory Management**
   - Stream-based file reading
   - EXIF data cleanup
   - Temporary file cleanup

3. **Concurrency**
   - Parallel file processing
   - Thumbnail generation queue
   - Config update queue

## Security Considerations

1. **File Access**
   - Permission checks
   - Path validation
   - Safe file operations

2. **Data Integrity**
   - Config file validation
   - Backup before updates
   - Atomic operations

## Future Enhancements

1. **Planned Features**
   - Custom organization patterns
   - Advanced duplicate detection
   - Batch metadata editing

2. **Potential Improvements**
   - Distributed processing
   - Cloud storage integration
   - AI-based organization

## Monitoring and Logging

```mermaid
graph LR
    A[Import Process] --> B[Logger]
    B --> C[File Operations]
    B --> D[Config Updates]
    B --> E[Error Tracking]
    C --> F[Log File]
    D --> F
    E --> F
```

## Testing Strategy

1. **Unit Tests**
   - File operations
   - Date extraction
   - Config management

2. **Integration Tests**
   - Full import process
   - Error handling
   - Performance metrics

3. **End-to-End Tests**
   - UI workflows
   - System integration
   - User scenarios
