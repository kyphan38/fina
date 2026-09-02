// ============================================================
// fina - Vứt câu nào model không được phép nói
//
// Model chỉ được diễn đạt lại những gì code đã tính. Câu nào vượt ra ngoài
// là câu nó tự nghĩ, và một con số tự nghĩ trong app tiền bạc thì tệ hơn
// hẳn việc không có câu nào.
//
// Vứt hết cũng là kết quả hợp lệ, không phải lỗi.
// ============================================================

import { allowedNumbers, type Digest } from '@/lib/digest';

/** Suy luận nhân quả: model không có dữ liệu để biết cái gì gây ra cái gì. */
const CAUSAL = /\b(because|since|due to|led to|caused|resulted in|thanks to)\b/i;

/** Phán xét: không phải việc của app. */
const JUDGEMENT =
  /\b(should|shouldn't|ought|too much|too little|excessive|wasteful|unreasonable|unnecessary|bad habit|overspending problem|careless)\b/i;

/** Lời khuyên đầu tư: app này không đưa ra, ở bất kỳ đâu. */
const INVESTMENT =
  /\b(invest more|invest less|portfolio|diversif|returns?|yield|stock|market|ETF allocation|financial advice)\b/i;

/** Từ y khoa: model không được chẩn đoán gì cả. */
const MEDICAL = /\b(burnout|unhealthy|depress|anxiet|insomnia|disorder|addiction)\b/i;

export interface SanitizeResult {
  kept: string[];
  dropped: { line: string; reason: string }[];
}

/**
 * Lọc từng câu model trả về.
 *
 * Số được so ở dạng chỉ-chữ-số, nên `1.890`, `1890` và `1,890` đều khớp cùng
 * một giá trị - model viết kiểu nào cũng được, miễn giá trị có thật.
 */
export function sanitizeInsight(lines: string[], digest: Digest): SanitizeResult {
  const allowed = allowedNumbers(digest);
  const kept: string[] = [];
  const dropped: { line: string; reason: string }[] = [];

  for (const raw of lines) {
    const line = raw.trim().replace(/^[-*•]\s*/, '');
    if (line.length === 0) continue;

    if (CAUSAL.test(line)) { dropped.push({ line, reason: 'causal claim' }); continue; }
    if (JUDGEMENT.test(line)) { dropped.push({ line, reason: 'judgement' }); continue; }
    if (INVESTMENT.test(line)) { dropped.push({ line, reason: 'investment advice' }); continue; }
    if (MEDICAL.test(line)) { dropped.push({ line, reason: 'medical language' }); continue; }

    const numbers = line.match(/\d[\d.,]*/g) ?? [];
    const invented = numbers.find((n) => {
      const digits = n.replace(/[^\d]/g, '');
      return digits.length > 0 && !allowed.has(digits) && !allowed.has(n);
    });
    if (invented) { dropped.push({ line, reason: `number not in digest: ${invented}` }); continue; }

    kept.push(line);
  }

  return { kept, dropped };
}
