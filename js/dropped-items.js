"use strict";

/**
 * نظام إسقاط/التقاط الأدوات على الخريطة
 */

export class DroppedItemsManager {
  constructor() {
    this.droppedItems = new Map(); // id -> droppedItem
    this.ITEM_LIFETIME = 300000; // 5 دقائق ثم يختفي
  }

  add(droppedItem) {
    this.droppedItems.set(droppedItem.id, droppedItem);
    return droppedItem;
  }

  remove(id) {
    this.droppedItems.delete(id);
  }

  getById(id) {
    return this.droppedItems.get(id) || null;
  }

  // البحث عن أقرب عنصر قريب من لاعب
  findNearby(x, y, radius = 40) {
    const found = [];
    for (const [id, item] of this.droppedItems) {
      const dist = Math.hypot(item.x - x, item.y - y);
      if (dist <= radius) {
        found.push({ ...item, dist });
      }
    }
    return found.sort((a, b) => a.dist - b.dist);
  }

  // تنظيف الأدوات القديمة
  cleanup() {
    const now = Date.now();
    for (const [id, item] of this.droppedItems) {
      if (now - item.spawnTime > this.ITEM_LIFETIME) {
        this.droppedItems.delete(id);
      }
    }
  }

  // رسم الأدوات على الخريطة
  draw(ctx, camera) {
    for (const [, item] of this.droppedItems) {
      const screenX = item.x - (camera?.x || 0);
      const screenY = item.y - (camera?.y || 0);

      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + item.size / 2, item.size * 0.8, item.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // الأداة — أيقونة متحركة
      const bobY = Math.sin(Date.now() / 400 + item.x) * 3;
      ctx.font = `${item.size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.icon, screenX, screenY + bobY);

      // اسم الأداة فوقها
      ctx.font = "10px Cairo, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeText(item.name, screenX, screenY - item.size / 2 - 8);
      ctx.fillText(item.name, screenX, screenY - item.size / 2 - 8);

      // مستوى الأداة
      if (item.level > 1) {
        const stars = "⭐".repeat(item.level - 1);
        ctx.font = "8px sans-serif";
        ctx.fillText(stars, screenX, screenY + item.size / 2 + 10);
      }
    }
  }

  // تحويل لـ JSON للإرسال عبر الشبكة
  toJSON() {
    return Array.from(this.droppedItems.values());
  }

  // تحميل من JSON
  fromJSON(list) {
    this.droppedItems.clear();
    if (!Array.isArray(list)) return;
    for (const item of list) {
      this.droppedItems.set(item.id, item);
    }
  }
}
