"use strict";

// 🛡️ تعقيم نصوص قادمة من لاعبين آخرين (أسماء تحالفات، أسماء سلع في السوق..)
// قبل إدراجها في innerHTML — الخادم يُعقّم/يشتق هذه القيم من كتالوجه الخاص،
// لكن هذا خط دفاع ثانٍ على العميل لأي مصدر بيانات مستقبلي غير مُتحقَّق منه.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
