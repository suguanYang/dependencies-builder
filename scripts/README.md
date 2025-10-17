# Batch Actions Script

This script automates the creation of actions for multiple projects via the DMS API.

## Files

- `batch-actions.js` - Main script that sends requests to the DMS API
- `projects.json` - List of all projects to process (95 projects)
- `package.json` - Package configuration for ES module support
- `README.md` - This documentation file

## Features

- Creates actions for all listed projects in `projects.json`
- Processes projects in batches to avoid overwhelming the server (respects the 10 concurrent actions limit)
- Configurable via environment variables
- Detailed progress logging and error reporting
- Uses the native `fetch` API (Node.js 18+)

## Prerequisites

- Node.js 18 or higher (for native `fetch` support)
- DMS server running and accessible

## Usage

### Basic Usage

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

This will use the default configuration:
- API Base URL: `http://localhost:3001`
- Action Type: `static_analysis`
- Branch: `master`
- Batch Size: 5 concurrent requests
- Delay: 2000ms between batches

### Custom Configuration

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

Or from the scripts directory:
```bash
cd scripts

# Use environment variables with npm
API_BASE_URL=http://172.20.169.243:3001 npm start

# Or with node
API_BASE_URL=http://172.20.169.243:3001 \
ACTION_TYPE=report \
BRANCH=develop \
node batch-actions.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3001` | Base URL of the DMS API server |
| `ACTION_TYPE` | `static_analysis` | Type of action to create (`static_analysis`, `report`, or `connection_auto_create`) |
| `BRANCH` | `master` | Git branch to analyze |

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

