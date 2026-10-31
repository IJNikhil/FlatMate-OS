/**
 * ==============================================================================
 * FlatMate OS - UPI Deep-Link Protocol Generator
 * File: src/features/settlements/utils/upiDeepLink.ts
 * ==============================================================================
 * Conforms to NPCI Unified Payments Interface (UPI) Deep Linking Specification.
 * Ensures all parameters are properly escaped and validated.
 */

export interface UpiParams {
  /** Payee Virtual Payment Address / UPI ID (e.g. name@okhdfcbank, user@ybl) */
  payeeAddress: string;
  /** Payee Display Name (e.g. Siddharth) */
  payeeName: string;
  /** Amount to transfer in INR (positive number) */
  amount: number;
  /** Transaction memo note (e.g. FlatMate OS Settlement) */
  transactionNote?: string;
}

const UPI_SCHEME = 'upi://pay';
const DEFAULT_CURRENCY = 'INR';
const DEFAULT_NOTE = 'FlatMate OS Settlement';

/**
 * Validates basic VPA format (user@handle).
 */
export function isValidUpiAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Standard VPA check: alphanumeric/dots/dashes followed by @ followed by bank/psp handle
  const vpaRegex = /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return vpaRegex.test(trimmed);
}

/**
 * Constructs an RFC-compliant `upi://pay` deep link URL for native OS payment apps
 * (Google Pay, PhonePe, Paytm, BHIM, etc.).
 *
 * @throws Error if payeeAddress is invalid or amount is not positive.
 */
export function generateUpiUrl({
  payeeAddress,
  payeeName,
  amount,
  transactionNote = DEFAULT_NOTE
}: UpiParams): string {
  const cleanAddress = payeeAddress ? payeeAddress.trim() : '';
  const cleanName = payeeName ? payeeName.trim() : '';

  if (!cleanAddress || cleanAddress.toLowerCase() === 'pending') {
    throw new Error('A valid payee UPI VPA address is required to generate a payment link.');
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid settlement payment amount: ${amount}. Amount must be greater than zero.`);
  }

  const queryParams = new URLSearchParams();
  queryParams.set('pa', cleanAddress);
  queryParams.set('pn', cleanName || 'FlatMate');
  queryParams.set('am', amount.toFixed(2));
  queryParams.set('cu', DEFAULT_CURRENCY);
  queryParams.set('tn', transactionNote);

  return `${UPI_SCHEME}?${queryParams.toString()}`;
}
