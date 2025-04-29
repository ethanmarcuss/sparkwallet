import * as bip39 from "bip39";

export function generateMnemonic() {
  return bip39.generateMnemonic();
}

export function validateMnemonic(mnemonic: string) {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Encrypts a mnemonic phrase with a password
 */
export async function encryptMnemonic(
  mnemonic: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(mnemonic);

  // Convert password to key
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Generate salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  // Derive key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Generate IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    data
  );

  // Combine salt, iv, and ciphertext
  const result = new Uint8Array(
    salt.length + iv.length + new Uint8Array(ciphertext).length
  );
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts an encrypted mnemonic with a password
 */
export async function decryptMnemonic(
  encryptedMnemonic: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Convert from base64
  const encryptedData = Uint8Array.from(atob(encryptedMnemonic), (c) =>
    c.charCodeAt(0)
  );

  // Extract salt, iv, and ciphertext
  const salt = encryptedData.slice(0, 16);
  const iv = encryptedData.slice(16, 28);
  const ciphertext = encryptedData.slice(28);

  // Convert password to key
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertext
    );

    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Invalid password");
  }
}
