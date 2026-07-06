#!/bin/bash
# Setup automatic MongoDB backup (daily at 3 AM)
# Run this once on your VPS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup-mongo.sh"
LOG_FILE="$PROJECT_DIR/logs/backup.log"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Add cron job (remove existing one first)
CRON_JOB="0 3 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-mongo.sh"; then
    echo "⚠️  Backup cron job already exists"
    read -p "Replace it? (yes/no): " replace
    if [ "$replace" = "yes" ]; then
        crontab -l 2>/dev/null | grep -v "backup-mongo.sh" | crontab -
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        echo "✅ Cron job updated"
    else
        echo "❌ Setup cancelled"
        exit 0
    fi
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added"
fi

echo ""
echo "📋 Current cron jobs:"
crontab -l
echo ""
echo "✅ Automatic backup setup complete!"
echo "🕐 Backup will run daily at 3:00 AM"
echo "📁 Backups saved to: $PROJECT_DIR/data/backups/"
echo "📜 Logs saved to: $LOG_FILE"
