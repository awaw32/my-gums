import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { pruneOldBackups, backupDatabase, BACKUP_RETENTION_MS } from '../server/db/databaseHelper.js';

// 💾 قبل هذا الإصلاح: desert-kingdom.db هي المصدر الوحيد للبيانات الدائمة
// (عند عدم توفر MongoDB — الحالة الافتراضية فعلياً)، بلا أي نسخ احتياطي.
// أي تلف بالقرص يعني فقدان نهائي لكل بيانات كل اللاعبين. backupDatabase
// تنشئ نسخة يومية متسقة عبر واجهة better-sqlite3 الرسمية، وpruneOldBackups
// تحذف النسخ الأقدم من أسبوع لتفادي امتلاء القرص.

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('💾 النسخ الاحتياطي لقاعدة SQLite (server/db/databaseHelper.js)', () => {
  it('backupDatabase ينشئ ملف نسخة احتياطية صالحاً وقابلاً للقراءة', async () => {
    const dbPath = path.join(tmpDir, 'desert-kingdom.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE players (username TEXT PRIMARY KEY, data TEXT)');
    db.prepare('INSERT INTO players (username, data) VALUES (?, ?)').run('p1', '{"cash":100}');

    const { backupPath } = await backupDatabase(db, fs, path, tmpDir);
    expect(fs.existsSync(backupPath)).toBe(true);

    const restored = new Database(backupPath, { readonly: true });
    const row = restored.prepare('SELECT data FROM players WHERE username = ?').get('p1');
    expect(row.data).toBe('{"cash":100}');
    restored.close();
    db.close();
  });

  it('backupDatabase ينشئ مجلد backups تلقائياً إن لم يكن موجوداً', async () => {
    const dbPath = path.join(tmpDir, 'desert-kingdom.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE players (username TEXT PRIMARY KEY)');
    const backupDir = path.join(tmpDir, 'backups');
    expect(fs.existsSync(backupDir)).toBe(false);
    await backupDatabase(db, fs, path, tmpDir);
    expect(fs.existsSync(backupDir)).toBe(true);
    db.close();
  });

  it('pruneOldBackups يحذف نسخة أقدم من الاحتفاظ (أسبوع) ويُبقي الحديثة', () => {
    const backupDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const oldFile = path.join(backupDir, 'desert-kingdom-old.db');
    const newFile = path.join(backupDir, 'desert-kingdom-new.db');
    fs.writeFileSync(oldFile, 'x');
    fs.writeFileSync(newFile, 'x');
    const oldTime = (Date.now() - BACKUP_RETENTION_MS - 60000) / 1000;
    fs.utimesSync(oldFile, oldTime, oldTime);

    const removed = pruneOldBackups(fs, path, backupDir);
    expect(removed).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });

  it('pruneOldBackups لا يحذف ملفات لا تطابق اسم النسخ الاحتياطية', () => {
    const backupDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const unrelated = path.join(backupDir, 'notes.txt');
    fs.writeFileSync(unrelated, 'keep me');
    const oldTime = (Date.now() - BACKUP_RETENTION_MS - 60000) / 1000;
    fs.utimesSync(unrelated, oldTime, oldTime);

    const removed = pruneOldBackups(fs, path, backupDir);
    expect(removed).toBe(0);
    expect(fs.existsSync(unrelated)).toBe(true);
  });

  it('pruneOldBackups لا يفشل إن كان مجلد backups غير موجود إطلاقاً', () => {
    const missingDir = path.join(tmpDir, 'does-not-exist');
    expect(() => pruneOldBackups(fs, path, missingDir)).not.toThrow();
    expect(pruneOldBackups(fs, path, missingDir)).toBe(0);
  });

  it('backupDatabase يستدعي pruneOldBackups تلقائياً بعد كل نسخة جديدة', async () => {
    const dbPath = path.join(tmpDir, 'desert-kingdom.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE players (username TEXT PRIMARY KEY)');
    const backupDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const staleFile = path.join(backupDir, 'desert-kingdom-stale.db');
    fs.writeFileSync(staleFile, 'x');
    const oldTime = (Date.now() - BACKUP_RETENTION_MS - 60000) / 1000;
    fs.utimesSync(staleFile, oldTime, oldTime);

    const { removed } = await backupDatabase(db, fs, path, tmpDir);
    expect(removed).toBe(1);
    expect(fs.existsSync(staleFile)).toBe(false);
    db.close();
  });
});
