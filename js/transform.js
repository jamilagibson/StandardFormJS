/**
 * Transforms an educational standard code into normalized format.
 * Pure logic — no DOM dependencies.
 */

/**
 * @param {*} input
 * @returns {{ result: string|null, error: string|null }}
 */
export function transformStandard(input) {
  if (input === null || input === undefined) {
    return { result: null, error: 'Input is required.' };
  }

  const trimmed = String(input).trim();

  if (trimmed === '') {
    return { result: null, error: null };
  }

  const segments = trimmed.split('.');

  if (segments.length < 4) {
    return {
      result: null,
      error: `Standard code must have at least 4 dot-separated segments. Got: "${trimmed}"`,
    };
  }

  const letter = segments[segments.length - 1];
  const standardNum = segments[segments.length - 2];
  const domain = segments[segments.length - 3];
  const grade = segments[segments.length - 4];

  if (!/^[a-zA-Z]$/.test(letter)) {
    return {
      result: null,
      error: `The final segment must be a single letter. Got: "${letter}"`,
    };
  }

  if (!/^\d+$/.test(standardNum)) {
    return {
      result: null,
      error: `The standard number (second-to-last segment) must contain only digits. Got: "${standardNum}"`,
    };
  }

  if (!/^[a-zA-Z]+$/.test(domain)) {
    return {
      result: null,
      error: `The domain code (third-to-last segment) must contain only letters. Got: "${domain}"`,
    };
  }

  if (!/^\d+$/.test(grade)) {
    return {
      result: null,
      error: `The grade number (fourth-to-last segment) must contain only digits. Got: "${grade}"`,
    };
  }

  const result = `${domain.toUpperCase()}.${grade}.${standardNum}.${letter.toLowerCase()}`;
  return { result, error: null };
}
