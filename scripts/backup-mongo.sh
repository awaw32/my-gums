#!/bin/bash
# MongoDB Atlas Backup Script
# Usage: ./backup-mongo.sh

set -e

# Configuration
BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep MONGO_URL | xargs)
fi

# Check if MONGO_URL is set
if [ -z "$MONGO_URL" ]; then
    echo "❌ Error: MONGO_URL not set in .env"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting MongoDB backup..."
echo "📁 Backup location: $BACKUP_FILE"

# Run mongodump
mongodump --uri="$MONGO_URL" --out="$BACKUP_FILE"

# Compress backup
echo "📦 Compressing backup..."
tar -czf "$BACKUP_FILE.tar.gz" -C "$BACKUP_FILE" .
rm -rf "$BACKUP_FILE"

# Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7)..."
cd "$BACKUP_DIR"
ls -t backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "✅ Backup completed: $BACKUP_FILE.tar.gz"
echo "📊 Size: $(du -h "$BACKUP_FILE.tar.gz" | cut -f1)"
