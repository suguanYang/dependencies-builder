# Batch Actions Script

This script automates the creation of actions for multiple projects via the DMS API.

## Files

- `batch-actions.js` - Main script that sends requests to the DMS API for simple projects
- `batch-actions-monorepo.js` - Monorepo script that processes project-package combinations
- `projects.json` - List of all projects to process (95 projects)
- `projects-name-mapping.json` - Monorepo project-package mapping configuration
- `package.json` - Package configuration for ES module support
- `README.md` - This documentation file

## Features

### Simple Projects Script (`batch-actions.js`)
- Creates actions for all listed projects in `projects.json`
- Processes projects in batches to avoid overwhelming the server (respects the 10 concurrent actions limit)
- Configurable via environment variables
- Detailed progress logging and error reporting
- Uses the native `fetch` API (Node.js 18+)

### Monorepo Script (`batch-actions-monorepo.js`)
- Processes project-package combinations from `projects-name-mapping.json`
- Creates actions for each package within each project
- Supports filtering by project name, package name, upload status, and app names
- Includes packageName parameter in API requests
- Handles complex monorepo structures with multiple packages per project

## Prerequisites

- Node.js 18 or higher (for native `fetch` support)
- DMS server running and accessible

## Usage

### Basic Usage

#### Simple Projects Script

From the repository root:
```bash
node scripts/batch-actions.js
```

Or from the scripts directory:
```bash
cd scripts
node batch-actions.js
# or
npm start
```

#### Monorepo Script

From the repository root:
```bash
node scripts/batch-actions-monorepo.js
```

Or from the scripts directory:
```bash
cd scripts
node batch-actions-monorepo.js
# or
npm run monorepo
```

This will use the default configuration:
- API Base URL: `http://localhost:3001`
- Action Type: `static_analysis`
- Branch: `master`
- Batch Size: 5 concurrent requests
- Delay: 2000ms between batches

### Custom Configuration

#### Simple Projects Script

You can customize the behavior using environment variables:

```bash
# From repository root
# Change the API endpoint
API_BASE_URL=http://172.20.169.243:3001 node scripts/batch-actions.js

# Change the action type
ACTION_TYPE=report node scripts/batch-actions.js

# Change the branch
BRANCH=develop node scripts/batch-actions.js

# Combine multiple options
API_BASE_URL=http://172.20.169.243:3001 \
ACTION_TYPE=static_analysis \
BRANCH=master \
node scripts/batch-actions.js
```

#### Monorepo Script

The monorepo script supports additional filtering options:

```bash
# Basic configuration
API_BASE_URL=http://172.20.169.243:3001 \
ACTION_TYPE=static_analysis \
BRANCH=master \
node scripts/batch-actions-monorepo.js

# Filter by project name pattern
PROJECT_PATTERN="biz-" node scripts/batch-actions-monorepo.js

# Filter by package name pattern
PACKAGE_PATTERN="@seeyon/biz-" node scripts/batch-actions-monorepo.js

# Only process packages with uploadOss=true
UPLOAD_OSS=true node scripts/batch-actions-monorepo.js

# Only process packages that have specific app names
HAS_APP_NAMES=true node scripts/batch-actions-monorepo.js

# Combine multiple filters
PROJECT_PATTERN="biz-" \
PACKAGE_PATTERN="@seeyon/biz-" \
UPLOAD_OSS=true \
node scripts/batch-actions-monorepo.js
```

Or from the scripts directory:
```bash
cd scripts

# Simple projects
API_BASE_URL=http://172.20.169.243:3001 npm start

# Monorepo with filters
PROJECT_PATTERN="biz-" npm run monorepo
```

### Environment Variables

#### Common Variables (Both Scripts)

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3001` | Base URL of the DMS API server |
| `ACTION_TYPE` | `static_analysis` | Type of action to create (`static_analysis`, `report`, or `connection_auto_create`) |
| `BRANCH` | `master` | Git branch to analyze |

#### Monorepo Script Only

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_PATTERN` | - | Regex pattern to filter projects by name |
| `PACKAGE_PATTERN` | - | Regex pattern to filter packages by name |
| `UPLOAD_OSS` | - | Filter by uploadOss status (`true` or `false`) |
| `HAS_APP_NAMES` | - | Only include packages with specific app names (`true` or `false`) |

### Script Configuration

You can modify these constants in the script itself:

- `BATCH_SIZE`: Number of concurrent requests per batch (default: 5)
- `DELAY_MS`: Delay between batches in milliseconds (default: 2000)

## Output

The script provides detailed output including:

1. **Configuration Summary**: Shows all settings before execution
2. **Batch Progress**: Shows which batch is being processed
3. **Individual Results**: Shows success/failure for each project
4. **Final Summary**: Total statistics and list of failed projects (if any)

### Example Output

#### Simple Projects Script
```
============================================================
Batch Actions Script
============================================================
API Base URL: http://localhost:3001
Action Type: static_analysis
Branch: master
Total Projects: 95
Batch Size: 5
============================================================

[Batch 1/19] Processing 5 projects...
✓ Created action for bi-mobile (ID: clxy1z2b3000008...)
✓ Created action for bi (ID: clxy1z2b3000108...)
✓ Created action for ai (ID: clxy1z2b3000208...)
✓ Created action for ai-mobile (ID: clxy1z2b3000308...)
✓ Created action for delivery-service (ID: clxy1z2b3000408...)
Waiting 2000ms before next batch...

...

============================================================
Summary
============================================================
Total Projects: 95
Successful: 93
Failed: 2
Duration: 45.23s

Failed Projects:
  - demo-blank: HTTP 429: Too many running actions
  - ui-test: HTTP 500: Internal server error
============================================================
```

#### Monorepo Script
```
================================================================================
Monorepo Batch Actions Script
================================================================================
API Base URL: http://localhost:3001
Action Type: static_analysis
Branch: master
Batch Size: 5
Total Project-Package Combinations: 1247
Filtered Combinations: 156

Applied Filters:
  - projectPattern: biz-
  - uploadOss: true
================================================================================

[Batch 1/32] Processing 5 project-package combinations...
✓ Created action for biz-common/@seeyon/biz-lock-sign (ID: clxy1z2b3000008...)
✓ Created action for biz-common/@seeyon/biz-associate-document (ID: clxy1z2b3000108...)
✓ Created action for biz-custom/@seeyon/biz-udc-comment (ID: clxy1z2b3000208...)
✓ Created action for biz-custom/@seeyon/biz-udc-rich-text (ID: clxy1z2b3000308...)
✓ Created action for biz-whs/@seeyon/biz-edoc-cancellation (ID: clxy1z2b3000408...)
Waiting 2000ms before next batch...

...

================================================================================
Summary
================================================================================
Total Combinations: 156
Successful: 154
Failed: 2
Duration: 67.45s

Failed Combinations:
  - biz-common/@seeyon/biz-watermark: HTTP 429: Too many running actions
  - biz-custom/@seeyon/biz-online-compiler: HTTP 500: Internal server error

Sample Successful Combinations:
  - biz-common/@seeyon/biz-lock-sign (ID: clxy1z2b3000008...)
  - biz-common/@seeyon/biz-associate-document (ID: clxy1z2b3000108...)
  - biz-custom/@seeyon/biz-udc-comment (ID: clxy1z2b3000208...)
  - biz-custom/@seeyon/biz-udc-rich-text (ID: clxy1z2b3000308...)
  - biz-whs/@seeyon/biz-edoc-cancellation (ID: clxy1z2b3000408...)
  ... and 149 more
================================================================================
```

## Exit Codes

- `0`: All actions created successfully
- `1`: One or more actions failed to create

## Notes

1. The script respects the API's limit of 10 concurrent running actions by:
   - Processing projects in batches (default: 5 at a time)
   - Adding delays between batches
   
2. If the server is already processing 10 actions, you may need to:
   - Wait for some actions to complete
   - Reduce the `BATCH_SIZE`
   - Increase the `DELAY_MS`

3. All 95 projects are included in `projects.json`

## Managing Projects

### Simple Projects (`projects.json`)

To add, remove, or modify projects, edit the `projects.json` file. Each project should have:
- `name`: The project identifier
- `url`: The Git repository URL

Example project entry:
```json
{
  "name": "my-project",
  "url": "http://gitlab.seeyon.com/path/to/my-project.git"
}
```

### Monorepo Projects (`projects-name-mapping.json`)

The monorepo configuration has two main sections:

#### Projects Section
Maps project names to their repository URLs:
```json
{
  "projects": {
    "biz-common": {
      "url": "https://gitlab.seeyon.com/a9/code/frontend/libs/biz-common.git"
    }
  }
}
```

#### Package Names Section
Maps each project to its packages with metadata:
```json
{
  "packageNames": {
    "biz-common": {
      "@seeyon/biz-lock-sign": {
        "uploadOss": true,
        "appNames": []
      },
      "@seeyon/biz-watermark": {
        "uploadOss": false
      }
    }
  }
}
```

Each package entry can have:
- `uploadOss`: Whether the package should be uploaded to OSS
- `appNames`: Array of specific app names that use this package

## Troubleshooting

### "Too many running actions" Error

If you see HTTP 429 errors, the server has reached its limit of 10 concurrent actions. Wait a few minutes and try again, or adjust the batch settings.

### Connection Refused

If you see connection errors, make sure:
- The DMS server is running
- The `API_BASE_URL` is correct
- You can access the server from your current location

### Action Type Not Supported

Make sure `ACTION_TYPE` is one of:
- `static_analysis`
- `report`
- `connection_auto_create`

