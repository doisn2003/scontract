/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength (min 6 characters)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Validate Ethereum address format (0x + 40 hex chars)
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Solidity source code has a pragma statement
 */
export function isValidSoliditySource(source: string): boolean {
  return /pragma\s+solidity\s+/.test(source);
}

/**
 * Sanitize a string: trim whitespace
 */
export function sanitize(input: string): string {
  return input.trim();
}
