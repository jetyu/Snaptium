import crypto from 'node:crypto';
import argon2 from 'argon2';
import {
  E2EE_ALGORITHM,
  E2EE_ARGON2_CONFIG,
  E2EE_AUTH_TAG_LENGTH,
  E2EE_CIPHERTEXT_PREFIX,
  E2EE_ERROR_CODES,
  E2EE_IV_LENGTH,
  E2EE_KEY_LENGTH,
  E2EE_RECOVERY_KEY_BYTES,
  E2EE_RECOVERY_KEY_GROUP_SIZE,
  E2EE_RECOVERY_KEY_SEPARATOR,
  E2EE_SALT_LENGTH,
} from '../../shared/e2ee.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Crypto Service');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WrappedKey {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface KeySlots {
  version: number;
  passwordSlot: {
    salt: string;
    wrappedDEK: WrappedKey;
  };
  recoverySlot: {
    wrappedDEK: WrappedKey;
  };
  createdAt: number;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function createE2eeError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

/**
 * Base32 encoding alphabet (RFC 4648, uppercase, no padding).
 * Chosen for Recovery Key display because it avoids ambiguous characters
 * (0/O, 1/I/L) and is easy to read aloud.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

function decodeBase32(encoded: string): Buffer {
  const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const charIndex = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (charIndex === -1) {
      throw createE2eeError(
        E2EE_ERROR_CODES.RECOVERY_KEY_INVALID,
        'Invalid character in Recovery Key',
      );
    }
    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

function formatRecoveryKeyDisplay(base32: string): string {
  const groups: string[] = [];
  for (let i = 0; i < base32.length; i += E2EE_RECOVERY_KEY_GROUP_SIZE) {
    groups.push(base32.slice(i, i + E2EE_RECOVERY_KEY_GROUP_SIZE));
  }
  return groups.join(E2EE_RECOVERY_KEY_SEPARATOR);
}

// ─── Exported Service ───────────────────────────────────────────────────────

export const cryptoService = {
  // ── Salt ────────────────────────────────────────────────────────────────

  generateSalt(): Buffer {
    return crypto.randomBytes(E2EE_SALT_LENGTH);
  },

  // ── KEK Derivation (Argon2id) ───────────────────────────────────────────

  async deriveKEK(password: string, salt: Buffer): Promise<Buffer> {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      salt,
      timeCost: E2EE_ARGON2_CONFIG.timeCost,
      memoryCost: E2EE_ARGON2_CONFIG.memoryCost,
      parallelism: E2EE_ARGON2_CONFIG.parallelism,
      hashLength: E2EE_ARGON2_CONFIG.hashLength,
      raw: true,
    });
    return Buffer.from(hash);
  },

  // ── DEK Generation ─────────────────────────────────────────────────────

  generateDEK(): Buffer {
    return crypto.randomBytes(E2EE_KEY_LENGTH);
  },

  // ── DEK Wrap / Unwrap ──────────────────────────────────────────────────

  wrapDEK(dek: Buffer, kek: Buffer): WrappedKey {
    const iv = crypto.randomBytes(E2EE_IV_LENGTH);
    const cipher = crypto.createCipheriv(E2EE_ALGORITHM, kek, iv, {
      authTagLength: E2EE_AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  },

  unwrapDEK(wrapped: WrappedKey, kek: Buffer): Buffer {
    try {
      const iv = Buffer.from(wrapped.iv, 'base64');
      const authTag = Buffer.from(wrapped.authTag, 'base64');
      const ciphertext = Buffer.from(wrapped.ciphertext, 'base64');

      const decipher = crypto.createDecipheriv(E2EE_ALGORITHM, kek, iv, {
        authTagLength: E2EE_AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (error: unknown) {
      logger.debug('DEK unwrap failed — likely wrong password or corrupted key slot', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw createE2eeError(E2EE_ERROR_CODES.WRONG_PASSWORD, 'Failed to unwrap DEK');
    }
  },

  // ── Recovery Key ───────────────────────────────────────────────────────

  generateRecoveryKey(): { displayKey: string; rawKey: Buffer } {
    const rawKey = crypto.randomBytes(E2EE_RECOVERY_KEY_BYTES);
    const base32 = encodeBase32(rawKey);
    const displayKey = formatRecoveryKeyDisplay(base32);

    return { displayKey, rawKey };
  },

  deriveRecoveryKEK(rawKey: Buffer): Buffer {
    return crypto.createHash('sha256').update(rawKey).digest();
  },

  parseRecoveryKeyInput(input: string): Buffer {
    const cleanInput = input
      .toUpperCase()
      .replace(new RegExp(E2EE_RECOVERY_KEY_SEPARATOR, 'g'), '')
      .replace(/\s+/g, '');

    const rawKey = decodeBase32(cleanInput);

    if (rawKey.length !== E2EE_RECOVERY_KEY_BYTES) {
      throw createE2eeError(
        E2EE_ERROR_CODES.RECOVERY_KEY_INVALID,
        `Invalid Recovery Key length: expected ${E2EE_RECOVERY_KEY_BYTES} bytes, got ${rawKey.length}`,
      );
    }

    return rawKey;
  },

  // ── Content Encryption / Decryption ────────────────────────────────────

  encryptContent(plaintext: string, dek: Buffer): string {
    try {
      const iv = crypto.randomBytes(E2EE_IV_LENGTH);
      const cipher = crypto.createCipheriv(E2EE_ALGORITHM, dek, iv, {
        authTagLength: E2EE_AUTH_TAG_LENGTH,
      });

      const plaintextBuffer = Buffer.from(plaintext, 'utf8');
      const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Format: prefix + base64(iv + authTag + ciphertext)
      const combined = Buffer.concat([iv, authTag, encrypted]);
      return E2EE_CIPHERTEXT_PREFIX + combined.toString('base64');
    } catch (error: unknown) {
      logger.error('Content encryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw createE2eeError(E2EE_ERROR_CODES.ENCRYPTION_FAILED, 'Failed to encrypt content');
    }
  },

  decryptContent(ciphertext: string, dek: Buffer): string {
    try {
      if (!ciphertext.startsWith(E2EE_CIPHERTEXT_PREFIX)) {
        // Not encrypted — return as-is for backward compatibility
        return ciphertext;
      }

      const base64Payload = ciphertext.slice(E2EE_CIPHERTEXT_PREFIX.length);
      const combined = Buffer.from(base64Payload, 'base64');

      const iv = combined.subarray(0, E2EE_IV_LENGTH);
      const authTag = combined.subarray(E2EE_IV_LENGTH, E2EE_IV_LENGTH + E2EE_AUTH_TAG_LENGTH);
      const encryptedData = combined.subarray(E2EE_IV_LENGTH + E2EE_AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(E2EE_ALGORITHM, dek, iv, {
        authTagLength: E2EE_AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === E2EE_ERROR_CODES.DECRYPTION_FAILED) {
        throw error;
      }
      logger.error('Content decryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw createE2eeError(E2EE_ERROR_CODES.DECRYPTION_FAILED, 'Failed to decrypt content');
    }
  },

  /**
   * Checks whether a string is E2EE-encrypted content.
   */
  isEncryptedContent(content: string): boolean {
    return content.startsWith(E2EE_CIPHERTEXT_PREFIX);
  },
};
