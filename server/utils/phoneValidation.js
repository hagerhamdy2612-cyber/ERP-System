/**
 * 7–12 digits, ignoring formatting characters.
 * Allows leading +, spaces, dashes, dots, parentheses.
 */

const PHONE_DIGIT_MIN = 7;
const PHONE_DIGIT_MAX = 12;

function phoneDigitCount(value) {
  if (value == null || typeof value !== 'string') return 0;
  return value.replace(/\D/g, '').length;
}

function isValidPhone(value) {
  const n = phoneDigitCount(value);
  return n >= PHONE_DIGIT_MIN && n <= PHONE_DIGIT_MAX;
}

/** For optional fields: empty / whitespace-only is allowed. */
function isOptionalPhoneValid(value) {
  if (value == null) return true;
  if (typeof value !== 'string') return false;
  if (value.trim() === '') return true;
  return isValidPhone(value);
}

const PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number (7–12 digits). You may use spaces, dashes, parentheses, or a leading +.';

module.exports = {
  PHONE_DIGIT_MIN,
  PHONE_DIGIT_MAX,
  phoneDigitCount,
  isValidPhone,
  isOptionalPhoneValid,
  PHONE_VALIDATION_MESSAGE
};
