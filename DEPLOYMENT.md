# DMS Server Deployment Guide

This guide explains how to deploy the Dependency Management System server using Docker.

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd dms
   ```

2. **Build and start the server**:
   ```bash
   docker-compose up -d
   ```

3. **Check the server status**:
   ```bash
   docker-compose logs -f dms-server
   ```

4. **Access the API**:
   The server will be available at `http://localhost:3001`

## Configuration

### Environment Variables

You can customize the deployment by setting environment variables:

- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: 0.0.0.0)
- `CORS_ORIGIN`: CORS allowed origin (default: http://localhost:3000)
- `DATABASE_URL`: SQLite database path (default: file:/data/dms.db)

### Example with custom configuration:

```bash
docker-compose run -d \
  -p 8080:3001 \
  -e CORS_ORIGIN=https://your-frontend.com \
  dms-server
```

## Data Persistence

The server uses Docker volumes for data persistence:

- `dms_data`: Contains the SQLite database file
- `dms_logs`: Contains application logs

### Backup Database

To backup the database:
```bash
docker cp dms-server:/data/dms.db ./backup/dms_backup_$(date +%Y%m%d).db
```

### Restore Database

To restore from backup:
```bash
docker cp ./backup/dms_backup.db dms-server:/data/dms.db
```

## Management Commands

### Stop the server:
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes all data):
```bash
docker-compose down -v
```

### View logs:
```bash
docker-compose logs dms-server
```

### Restart the server:
```bash
docker-compose restart dms-server
```

### Update to latest version:
```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

## Health Checks

The container includes a health check that verifies the server is responding. You can check the health status:

```bash
docker inspect --format='{{.State.Health.Status}}' dms-server
```

## Troubleshooting

### Server not starting

1. Check logs: `docker-compose logs dms-server`
2. Verify port 3001 is available
3. Check if database file permissions are correct

### Database migration issues

1. Check if the database file exists in the volume
2. Verify the migration files are present
3. Run migrations manually:
   ```bash
   docker exec dms-server npx prisma migrate deploy
   ```

### CORS issues

Make sure the `CORS_ORIGIN` environment variable matches your frontend URL.

## Production Deployment

For production deployment, consider:

1. Using a reverse proxy (nginx, traefik)
2. Setting up SSL/TLS certificates
3. Configuring proper logging and monitoring
4. Setting up regular backups
5. Using a more robust database (PostgreSQL) for production workloads