/**
 * Validates a Bitcoin address
 */
export function isBitcoinAddress(address: string): boolean {
  // Simple regex for Bitcoin addresses
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
}

/**
 * Validates a Spark address
 */
export function isSparkAddress(address: string): boolean {
  // Simple regex for Spark addresses
  return /^sp1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
}

/**
 * Validates a Lightning invoice
 */
export function isLightningInvoice(invoice: string): boolean {
  // Simple regex for Lightning invoices
  return /^lnbc[a-zA-Z0-9]{1,}$/.test(invoice);
}

/**
 * Determines the type of address or invoice
 */
export function getAddressType(
  input: string
): "bitcoin" | "spark" | "lightning" | "unknown" {
  if (isBitcoinAddress(input)) return "bitcoin";
  if (isSparkAddress(input)) return "spark";
  if (isLightningInvoice(input)) return "lightning";
  return "unknown";
}
