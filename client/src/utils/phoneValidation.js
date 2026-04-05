/** Match server: 7–12 digits, ignoring formatting. */

export const PHONE_DIGIT_MIN = 7;
export const PHONE_DIGIT_MAX = 12;

export function isValidPhone(value) {
  if (value == null || typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= PHONE_DIGIT_MIN && digits.length <= PHONE_DIGIT_MAX;
}

/** Empty or whitespace-only is valid (optional phone). */
export function isOptionalPhoneValid(value) {
  if (value == null || typeof value !== 'string') return true;
  if (value.trim() === '') return true;
  return isValidPhone(value);
}
