#!/bin/bash
# MongoDB Restore Script
# Usage: ./restore-mongo.sh <backup_file.tar.gz>

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore-mongo.sh <backup_file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./data/backups/backup_*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep MONGO_URL | xargs)
fi

# Check if MONGO_URL is set
if [ -z "$MONGO_URL" ]; then
    echo "❌ Error: MONGO_URL not set in .env"
    exit 1
fi

# Ask for confirmation
echo "⚠️  WARNING: This will OVERWRITE all data in MongoDB!"
echo "📁 Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Extract backup
TEMP_DIR="./data/temp_restore_$$"
mkdir -p "$TEMP_DIR"

echo "📦 Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore to MongoDB
echo "🔄 Restoring to MongoDB..."
mongorestore --uri="$MONGO_URL" --drop "$TEMP_DIR"

# Cleanup
rm -rf "$TEMP_DIR"

echo "✅ Restore completed successfully!"
