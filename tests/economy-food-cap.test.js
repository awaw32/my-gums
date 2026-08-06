import { describe, it, expect } from 'vitest';
import { GameEconomy, MAX_FOOD } from '../js/economy.js';

// 🛡️ قبل هذا الإصلاح: لا حد أقصى لمورد "الطعام" — لاعب غير متصل لفترات طويلة
// متكررة يمكن أن يتراكم طعامه لأرقام هائلة (آلية الفساد تُطبَّق 5% مرة واحدة
// كل 24 ساعة فقط، وليست تراكمية)، ما يُبطل الغرض من آلية الفساد (تشجيع الإنفاق).

describe('🌾 حد أقصى لمورد الطعام (js/economy.js)', () => {
  it('المُعيِّن (setter) المباشر economy.food = يُقيَّد بالحد الأقصى', () => {
    const eco = new GameEconomy();
    eco.food = MAX_FOOD + 100000;
    expect(eco.food).toBe(MAX_FOOD);
  });

  it('add("food", ...) لا يتجاوز الحد الأقصى', () => {
    const eco = new GameEconomy();
    eco.food = MAX_FOOD - 10;
    eco.add('food', 1000);
    expect(eco.food).toBe(MAX_FOOD);
  });

  it('addRaw("food", ...) لا يتجاوز الحد الأقصى', () => {
    const eco = new GameEconomy();
    eco.food = MAX_FOOD - 10;
    eco.addRaw('food', 1000);
    expect(eco.food).toBe(MAX_FOOD);
  });

  it('لا يؤثر على موارد أخرى (cash/gold) — الحد خاص بالطعام فقط', () => {
    const eco = new GameEconomy();
    eco.addRaw('gold', MAX_FOOD + 100000);
    expect(eco.gold).toBeGreaterThan(MAX_FOOD);
  });

  it('القيم دون الحد الأقصى تبقى تعمل بشكل طبيعي', () => {
    const eco = new GameEconomy();
    eco.addRaw('food', 200);
    expect(eco.food).toBe(250); // 50 ابتدائي + 200
  });
});
