import { sanitizeRichText } from './rich-text';

export function cleanQuestion(raw: unknown) {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

export function cleanAnswer(raw: unknown) {
  return typeof raw === 'string' ? sanitizeRichText(raw.slice(0, 10000)).slice(0, 5000) : '';
}
