# Docker Setup Guide for Pacific Support System

## Prerequisites
1. **Install Docker Desktop** - Download from [docker.com](https://www.docker.com/products/docker-desktop)
2. **Verify Installation** - Open terminal and run:
   ```bash
   docker --version
   docker-compose --version
   ```

---

## Step 1: Configure Environment Variables

1. Copy the environment file:
   ```bash
   copy .env.docker .env
   ```

2. Edit `.env` file with your actual values:
   - `EMAIL_USER` - Your Gmail address
   - `EMAIL_PASSWORD` - Your Gmail app password (not regular password)
   - Adjust `MONGO_PASSWORD` if desired

---

## Step 2: Start Docker Services

1. Open terminal/PowerShell in your project root directory

2. Start all services:
   ```bash
   docker-compose up -d
   ```
   The `-d` flag runs in background (remove it to see logs)

3. Check status:
   ```bash
   docker-compose ps
   ```
   You should see 5 running containers:
   - pacific-backend
   - pacific-frontend
   - pacific-admin
   - pacific-mongo
   - pacific-redis

---

## Step 3: Access Your Application

- **Frontend**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3001
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Common Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services
```bash
docker-compose down
```

### Rebuild Services (after code changes)
```bash
docker-compose up -d --build
```

### Remove Everything (including data)
```bash
docker-compose down -v
```

### Access Container Terminal
```bash
docker exec -it pacific-backend bash
docker exec -it pacific-mongo mongosh
```

---

## Troubleshooting

### Port Already in Use
If ports 8000, 3000, 3001, 27017, or 6379 are in use:
```bash
# Edit docker-compose.yml and change ports like:
# "8001:8000" instead of "8000:8000"
```

### MongoDB Connection Error
```bash
# Check if mongo is running
docker-compose logs mongo

# Rebuild mongo
docker-compose up -d --build mongo
```

### Container Won't Start
```bash
# Check detailed logs
docker-compose logs backend

# Rebuild all services
docker-compose down -v
docker-compose up --build
```

---

## For Team Members

After downloading Docker Desktop, they only need to:

1. Clone your repository
2. Copy `.env.docker` to `.env` and configure
3. Run: `docker-compose up -d`
4. Done! Everything works.

No need to install Python, Node.js, or databases separately!
