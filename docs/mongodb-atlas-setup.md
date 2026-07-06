# إعداد MongoDB Atlas (10 دقائق)

## ليه نحتاجه؟

الوضع الحالي:
```
MongoDB على Hostinger VPS ← لو انقطع الاشتراك، تضيع البيانات
SQLite محلي ← نفس المشكلة
```

بعد Atlas:
```
MongoDB Atlas (سحابة مجانية) ← البيانات آمنة حتى لو انقطع Hostinger
SQLite محلي ← backup تلقائي
```

---

## الخطوات

### 1. سجل في MongoDB Atlas (مجاني)

1. روح على: https://cloud.mongodb.com/
2. اضغط **"Build a Database"**
3. اختر **M0 Free** (512MB مجاني للأبد)
4. اختر **AWS** كـ cloud provider
5. اختر **Frankfurt, Germany** (أقرب للرياض: ~60ms)
6. اضغط **"Create Cluster"**

### 2. أنشئ Database User

1. بعد ما ينشأ الـ cluster (يأخذ 3 دقائق)
2. روح على **"Database Access"** (القائمة اليسار)
3. اضغط **"Add New Database User"**
4. املأ:
   - **Username**: `game_admin`
   - **Password**: (احفظه في مكان آمن!)
   - **Role**: **Read and write to any database**
5. اضغط **"Add User"**

### 3. اسمح بالاتصال من Hostinger

1. روح على **"Network Access"** (القائمة اليسار)
2. اضغط **"Add IP Address"**
3. اختر **"Allow Access from Anywhere"** (0.0.0.0/0)
   - أو أضف IP السيرفر فقط (أكثر أماناً)
4. اضغط **"Confirm"**

### 4. احصل على Connection String

1. روح على **"Database"** (القائمة اليسار)
2. اضغط **"Connect"** على الـ cluster
3. اختر **"Connect your application"**
4. انسخ الـ connection string (يشبه):
   ```
   mongodb+srv://game_admin:<password>@cluster0.xxxxx.mongodb.net/game?retryWrites=true&w=majority
   ```
5. استبدل `<password>` بالباسورد اللي حفظته
6. غيّر `game` إلى اسم قاعدة البيانات (مثلاً: `desert_kingdom`)

### 5. حدّث ملف `.env` على Hostinger

```bash
# SSH على Hostinger
ssh user@your-server

# افتح .env
nano /path/to/project/.env

# غيّر MONGO_URL:
MONGO_URL=mongodb+srv://game_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/desert_kingdom?retryWrites=true&w=majority

# احفظ (Ctrl+X, Y, Enter)
```

### 6. اختبر الاتصال

```bash
# شغّل السيرفر
npm start

# افتح في المتصفح
http://your-server:3000/health

# يجب أن ترى:
{
  "status": "ok",
  "mongo": "connected",  ← هذا يعني Atlas شغال
  ...
}
```

### 7. انقل البيانات الحالية إلى Atlas

```bash
# على Hostinger، صدّر البيانات من MongoDB المحلي:
mongodump --uri="mongodb://localhost:27017/my-gums" --out=./migration_dump

# استوردها في Atlas:
mongorestore --uri="mongodb+srv://game_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/desert_kingdom" --drop ./migration_dump

# احذف الملفات المؤقتة
rm -rf ./migration_dump
```

### 8. فعّل النسخ الاحتياطي التلقائي

```bash
# على Hostinger
cd /path/to/project

# شغّل script الإعداد
chmod +x scripts/setup-auto-backup.sh
./scripts/setup-auto-backup.sh

# هذا يضيف cron job يحفظ backup كل يوم الساعة 3 صباحاً
```

---

## التحقق من النسخ الاحتياطي

```bash
# شوف الـ backups
ls -lh data/backups/

# يدوي (اختبار)
./scripts/backup-mongo.sh

# شوف الـ log
tail -f logs/backup.log
```

---

## لو احتجت تستعيد البيانات

```bash
# شوف الـ backups المتاحة
./scripts/restore-mongo.sh

# استعيد backup معين
./scripts/restore-mongo.sh data/backups/backup_20260706_030000.tar.gz
```

---

## التكلفة

- **MongoDB Atlas M0**: مجاني للأبد (512MB)
- **لو كبرت**: M10 بـ $9/شهر (2GB)
- **Bandwidth**: مجاني (لأن السيرفر على Hostinger)

---

## الأمان

- ✅ Atlas يعزل البيانات عن Hostinger
- ✅ لو انقطع الاشتراك، البيانات في السحابة
- ✅ Backup تلقائي كل يوم
- ✅ تقدر ترجع لأي backup آخر 7 أيام

---

## الأسئلة الشائعة

### هل البيانات تنتقل بين Hostinger و Atlas كل مرة؟
نعم، لكن MongoDB Atlas سريع (~60ms من Hostinger لندن).

### هل أحتاج أغير الكود؟
لا، فقط غيّر `MONGO_URL` في `.env`.

### لو حبيت أرجع لـ MongoDB المحلي؟
غيّر `MONGO_URL` في `.env` إلى:
```
MONGO_URL=mongodb://localhost:27017/my-gums
```

### كيف أشوف حجم البيانات؟
في Atlas → Database → Collections → شوف الحجم.
