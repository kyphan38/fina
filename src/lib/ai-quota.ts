// Gemini out of credit (402) or rate limited (429): say so instead of a generic error.
// The routes throw Error(String(res.status)) on a bad response.

export const QUOTA_MESSAGE = 'AI credit is used up. Top it up in AI Studio, then try again.';

export function isQuotaStatus(message: string): boolean {
  return message === '402' || message === '429';
}
