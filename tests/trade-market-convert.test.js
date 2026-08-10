import { describe, it, expect, beforeEach } from 'vitest';
import { TradeMarket } from '../js/trade-market.js';
import { GameEconomy } from '../js/economy.js';

// 🛡️ قبل هذا الإصلاح: convertResource كان يُنفَّذ بالكامل على العميل
// (economy.spend + economy.addRaw مباشرة) بلا أي رسالة WS — أي لاعب يستدعي
// tradeMarket.convertResource() من console المتصفح مباشرة يستطيع صرف مبلغ
// مصطنع بلا رصيد حقيقي (تحويل فوري لعملة مميزة كالجواهر من عدم). الآن يرسل
// طلباً للخادم وينتظر تأكيده (market_convert/market_convert_response) قبل
// تطبيق أي تغيير محلي على الموارد — نفس نمط listItem/buyListing/removeListing.

function makeFakeNetSync() {
  return { sent: [], send(msg) { this.sent.push(msg); } };
}

describe('🏪 TradeMarket.convertResource (js/trade-market.js)', () => {
  let economy, netSync, market;

  beforeEach(() => {
    economy = new GameEconomy();
    netSync = makeFakeNetSync();
    market = new TradeMarket(economy, { items: {} }, netSync, 'player1');
  });

  it('يرسل رسالة market_convert للخادم بدل تطبيق التغيير محلياً فوراً', () => {
    economy.cash = 1000;
    const before = economy.gems;
    market.convertResource('cash', 'gems', 500);
    expect(netSync.sent).toHaveLength(1);
    expect(netSync.sent[0]).toEqual({ type: 'market_convert', from: 'cash', to: 'gems', amount: 500 });
    // 🛡️ لا يجب أن يتغيّر أي رصيد قبل تأكيد الخادم
    expect(economy.gems).toBe(before);
    expect(economy.cash).toBe(1000);
  });

  it('يرفض الإرسال إن لم يملك اللاعب الرصيد المحلي المعروض أصلاً (فحص واجهة فقط، ليس الحماية الحقيقية)', () => {
    economy.cash = 10;
    const result = market.convertResource('cash', 'gems', 500);
    expect(result).toBe(false);
    expect(netSync.sent).toHaveLength(0);
  });

  it('يرفض زوج موارد غير معروف قبل الإرسال', () => {
    economy.food = 1000;
    const result = market.convertResource('food', 'gems', 100);
    expect(result).toBe(false);
    expect(netSync.sent).toHaveLength(0);
  });

  it('يمنع إرسال طلب صرف ثانٍ أثناء انتظار رد سابق', () => {
    economy.cash = 10000;
    market.convertResource('cash', 'gems', 500);
    const secondAttempt = market.convertResource('cash', 'gems', 500);
    expect(secondAttempt).toBe(false);
    expect(netSync.sent).toHaveLength(1);
  });

  it('_handleConvertResponse يطبّق التغيير محلياً فقط بعد تأكيد الخادم (ok:true)', () => {
    economy.cash = 1000;
    const gemsBefore = economy.gems;
    market.convertResource('cash', 'gems', 500);
    market._handleConvertResponse({ ok: true, from: 'cash', to: 'gems', spent: 500, received: 5 });
    expect(economy.cash).toBe(500);
    expect(economy.gems).toBe(gemsBefore + 5);
  });

  it('_handleConvertResponse لا يطبّق أي تغيير عند رفض الخادم (ok:false)', () => {
    economy.cash = 1000;
    const gemsBefore = economy.gems;
    market.convertResource('cash', 'gems', 500);
    market._handleConvertResponse({ ok: false, reason: 'insufficient_resource' });
    expect(economy.cash).toBe(1000);
    expect(economy.gems).toBe(gemsBefore);
  });

  it('_handleConvertResponse يمسح _pendingConvert بعد الرد — يسمح بطلب جديد', () => {
    economy.cash = 10000;
    market.convertResource('cash', 'gems', 500);
    market._handleConvertResponse({ ok: true, from: 'cash', to: 'gems', spent: 500, received: 5 });
    const secondAttempt = market.convertResource('cash', 'gold', 100);
    expect(secondAttempt).toBe(true);
    expect(netSync.sent).toHaveLength(2);
  });

  it('handleNetMessage يوجّه market_convert_response إلى _handleConvertResponse بشكل صحيح', () => {
    economy.cash = 1000;
    const gemsBefore = economy.gems;
    market.convertResource('cash', 'gems', 500);
    market.handleNetMessage({ type: 'market_convert_response', ok: true, from: 'cash', to: 'gems', spent: 500, received: 5 });
    expect(economy.cash).toBe(500);
    expect(economy.gems).toBe(gemsBefore + 5);
  });

  it('يستدعي _onConvertDone بعد نجاح الصرف', () => {
    economy.cash = 1000;
    let doneCalled = null;
    market._onConvertDone = (conversion) => { doneCalled = conversion; };
    market.convertResource('cash', 'gems', 500);
    market._handleConvertResponse({ ok: true, from: 'cash', to: 'gems', spent: 500, received: 5 });
    expect(doneCalled).toEqual({ from: 'cash', fromAmount: 500, to: 'gems', toAmount: 5, timestamp: expect.any(Number) });
  });

  it('يستدعي _onError برسالة واضحة عند رفض الخادم', () => {
    economy.cash = 1000;
    let errorMsg = null;
    market._onError = (msg) => { errorMsg = msg; };
    market.convertResource('cash', 'gems', 500);
    market._handleConvertResponse({ ok: false, reason: 'insufficient_resource' });
    expect(errorMsg).toBeTruthy();
  });
});
