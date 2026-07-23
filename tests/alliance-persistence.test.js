import { describe, it, expect } from 'vitest';
import {
  createAllianceRecord, saveAlliance, getAlliance, getAllianceIdByName,
  nameTaken, searchAlliancesByName, deleteAlliance, allianceMemStore, TRIBAL_RANKS, getRank,
} from '../server/db/allianceHelper.js';

// 🛡️ يستورد allianceHelper.js الحقيقي (طبقة الحفظ: memStore + SQLite، بدون
// MongoDB في بيئة الاختبار — نفس نمط databaseHelper.js الأصلي). كل اسم
// قبيلة هنا يُعطى بادئة عشوائية لتفادي تصادم مع بيانات مُحمَّلة من ملف
// SQLite الحقيقي (data/desert-kingdom.db) عبر تشغيلات متكررة.

const rand = () => Math.random().toString(36).slice(2, 8);

describe('🏜️ طبقة حفظ التحالفات (server/db/allianceHelper.js)', () => {
  it('ينشئ سجل تحالف جديد بالشيخ المؤسس كعضو وحيد', () => {
    const record = createAllianceRecord(`قبيلة_${rand()}`, "🏕️", "founder1");
    expect(record.id).toMatch(/^alliance_/);
    expect(record.members).toHaveLength(1);
    expect(record.members[0].username).toBe("founder1");
    expect(record.members[0].rank).toBe("shaykh");
    expect(record.treasury).toBe(0);
    expect(record.level).toBe(0);
  });

  it('يحفظ السجل ويمكن استرجاعه عبر getAlliance', async () => {
    const record = createAllianceRecord(`قبيلة_${rand()}`, "⚔️", "founder2");
    await saveAlliance(record);
    const fetched = getAlliance(record.id);
    expect(fetched).toBeTruthy();
    expect(fetched.name).toBe(record.name);
    expect(fetched.banner).toBe("⚔️");
  });

  it('getAlliance يعيد null لمعرّف غير موجود', () => {
    expect(getAlliance("alliance_nonexistent_xyz")).toBeNull();
  });

  it('nameTaken/getAllianceIdByName يعملان بعد الحفظ', async () => {
    const name = `قبيلة_فريدة_${rand()}`;
    expect(nameTaken(name)).toBe(false);
    const record = createAllianceRecord(name, "🏜️", "founder3");
    await saveAlliance(record);
    expect(nameTaken(name)).toBe(true);
    expect(getAllianceIdByName(name)).toBe(record.id);
  });

  it('البحث بالاسم غير حساس لحالة الأحرف ويطابق جزئياً', async () => {
    const uniquePart = rand();
    const record = createAllianceRecord(`Golden_Tribe_${uniquePart}`, "🌟", "founder4");
    await saveAlliance(record);
    const results = searchAlliancesByName(`golden_tribe_${uniquePart}`);
    expect(results.some(r => r.id === record.id)).toBe(true);
  });

  it('البحث بسلسلة فارغة يعيد قائمة فارغة (لا يفرغ كل التحالفات)', () => {
    expect(searchAlliancesByName("")).toEqual([]);
  });

  it('حذف التحالف يزيله من memStore وفهرس الأسماء', async () => {
    const name = `قبيلة_للحذف_${rand()}`;
    const record = createAllianceRecord(name, "🏕️", "founder5");
    await saveAlliance(record);
    expect(getAlliance(record.id)).toBeTruthy();
    await deleteAlliance(record.id);
    expect(getAlliance(record.id)).toBeNull();
    expect(nameTaken(name)).toBe(false);
  });

  it('allianceMemStore يعكس فعلياً كل السجلات المحفوظة', async () => {
    const before = allianceMemStore.size;
    const record = createAllianceRecord(`قبيلة_${rand()}`, "🏕️", "founder6");
    await saveAlliance(record);
    expect(allianceMemStore.size).toBe(before + 1);
    expect(allianceMemStore.get(record.id)).toBeTruthy();
  });

  it('TRIBAL_RANKS/getRank يوفران ترتيب الصلاحيات الصحيح (شيخ الأعلى)', () => {
    expect(TRIBAL_RANKS).toHaveLength(4);
    const shaykh = getRank("shaykh");
    const novice = getRank("novice");
    expect(shaykh.authority).toBeGreaterThan(novice.authority);
    expect(getRank("unknown_rank_id")).toEqual(getRank("novice")); // fallback آمن
  });
});
