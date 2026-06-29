# 🏜️ Desert Kingdom - Full Updated Version

## ✅ What was improved:

- **Complete MongoDB integration** (All player data: resources, village, army, weapons, buildings, progress)
- **In-Memory Cache** for ultra-fast performance
- **Async/Await** everywhere (no more file system for player data)
- **Automatic saving** every 15 seconds + on page close
- **Smart loading**: Tries MongoDB first, falls back to localStorage
- **Performance indexes** on MongoDB
- **Better Dockerfile** with healthcheck
- **Rate limiting** kept (30 messages/second per player)
- **Clean separation** between real-time (WebSocket) and progress (HTTP API)

## 🚀 How to Deploy

1. Upload this folder to GitHub
2. In Coolify:
   - Connect your GitHub repo
   - Add Environment Variable:
     ```
     MONGO_URI=mongodb://root:YOUR_PASSWORD@72.62.59.227:27017/default?directConnection=true
     ```
   - Deploy

## 📌 Player ID System

- You can pass `?playerId=your_unique_id` in the URL
- The game will automatically save/load from MongoDB using this ID
- Example: `https://yourdomain.com/?playerId=player123`

## 🛡️ Data Safety

Every important action (level up, building upgrade, resource change) is saved to MongoDB.

---

**Version**: Full Professional Release - June 2026
