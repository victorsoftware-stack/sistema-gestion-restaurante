/**
 * Valida que un valor corresponda a un entero positivo (> 0).
 */
export function parsePositiveId(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}
