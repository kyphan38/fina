// ============================================================
// fina - Drop every sentence the model is not allowed to say
//
// The model may only reword what the code computed. Anything beyond that is
// made up, and a made-up number in a money app is much worse than no
// sentence at all.
//
// Dropping everything is a valid result, not an error.
// ============================================================

import { allowedNumbers, type Digest } from '@/lib/digest';

/** Causal claims: the model has no data to know what caused what. */
const CAUSAL = /\b(because|since|due to|led to|caused|resulted in|thanks to)\b/i;

/** Judgment: not the app's job. */
const JUDGEMENT =
  /\b(should|shouldn't|ought|too much|too little|excessive|wasteful|unreasonable|unnecessary|bad habit|overspending problem|careless)\b/i;

/** Investment advice: this app never gives it, anywhere. */
const INVESTMENT =
  /\b(invest more|invest less|portfolio|diversif|returns?|yield|stock|market|ETF allocation|financial advice)\b/i;

/** Medical words: the model must not diagnose anything. */
const MEDICAL = /\b(burnout|unhealthy|depress|anxiet|insomnia|disorder|addiction)\b/i;

export interface SanitizeResult {
  kept: string[];
  dropped: { line: string; reason: string }[];
}

/**
 * Filters each sentence the model returns.
 *
 * Numbers are compared as digits only, so `1.890`, `1890` and `1,890` all
 * match the same value - any format is fine as long as the value is real.
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
