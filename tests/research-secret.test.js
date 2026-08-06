import { describe, it, expect } from 'vitest';
import { RESEARCH_DEFS, canUpgradeResearch, applyResearchUpgrade, getResearchEffects } from '../server/db/research.js';

// 🛡️ قبل هذا الإصلاح كانت فئة "secret" معرَّفة على العميل (js/research-tree.js)
// فقط، تُفتح عند برستيج 3، لكن غير موجودة إطلاقاً في server/db/research.js —
// فيرى اللاعب البحوث السرية مفتوحة، يحاول ترقيتها، ويُرفض دائماً من الخادم
// بـ"مهارة بحث غير معروفة" رغم امتلاك الموارد ورغم بلوغه البرستيج المطلوب.
function basePlayer(overrides = {}) {
  return {
    cash: 100000, gold: 10000, gems: 1000, desertGem: 100,
    buildings: { researchAcademy: 10 },
    landsState: { b1: { level: 10 } },
    research: {},
    prestigeLevel: 0,
    ...overrides,
  };
}

describe('🏜️ البحوث السرية (server/db/research.js)', () => {
  it('يعرّف فئة secret بنفس المهارات الثلاث الموجودة على العميل', () => {
    expect(RESEARCH_DEFS.secret).toBeTruthy();
    expect(RESEARCH_DEFS.secret.prestigeRequired).toBe(3);
    expect(Object.keys(RESEARCH_DEFS.secret.skills).sort()).toEqual(
      ['ancientWisdom', 'forbiddenAlchemy', 'mirage'].sort()
    );
  });

  it('يرفض ترقية بحث سري للاعب لم يبلغ برستيج المستوى المطلوب', () => {
    const player = basePlayer({ prestigeLevel: 2 });
    const result = canUpgradeResearch(player, 'secret', 'mirage');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/برستيج/);
  });

  it('يسمح بترقية بحث سري للاعب بلغ برستيج المستوى المطلوب فعلياً ودفع الثمن', () => {
    const player = basePlayer({ prestigeLevel: 3 });
    const before = { ...player };
    const result = applyResearchUpgrade(player, 'secret', 'mirage');
    expect(result.ok).toBe(true);
    expect(result.newLevel).toBe(1);
    const expectedCost = RESEARCH_DEFS.secret.skills.mirage.baseCost;
    expect(player.cash).toBe(before.cash - expectedCost.cash);
    expect(player.gold).toBe(before.gold - expectedCost.gold);
    expect(player.desertGem).toBe(before.desertGem - expectedCost.desertGem);
  });

  it('لا يقبل ترقية بحث سري بمجرد إرسال العميل categoryId=secret دون برستيج فعلي', () => {
    // حتى لو "ادّعى" العميل أنه بلغ البرستيج عبر أي حقل آخر، القيمة الوحيدة
    // الموثوقة هي playerData.prestigeLevel المخزّنة فعلياً على الخادم
    const player = basePlayer({ prestigeLevel: 0 });
    const result = applyResearchUpgrade(player, 'secret', 'ancientWisdom');
    expect(result.ok).toBe(false);
    expect(player.research['secret.ancientWisdom']).toBeUndefined();
  });

  it('البحوث العسكرية/الاقتصادية العادية تبقى تعمل بلا شرط برستيج (لا رجعية كسرت)', () => {
    const player = basePlayer({ prestigeLevel: 0 });
    const result = applyResearchUpgrade(player, 'military', 'desertShield');
    expect(result.ok).toBe(true);
  });

  it('getResearchEffects يحسب تأثيرات البحوث السرية بشكل صحيح', () => {
    const player = basePlayer({ prestigeLevel: 3, research: { 'secret.mirage': 2, 'secret.forbiddenAlchemy': 1 } });
    const effects = getResearchEffects(player);
    expect(effects.dodgePercent).toBe(4); // 2% * 2 مستوى
    expect(effects.gemProduction).toBe(3); // 3% * 1 مستوى
    expect(effects.xpBonusPercent).toBe(0);
  });
});
