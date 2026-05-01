export const E2EE_ALGORITHM = 'aes-256-gcm' as const;

export const E2EE_KEY_LENGTH = 32 as const;

export const E2EE_IV_LENGTH = 12 as const;

export const E2EE_AUTH_TAG_LENGTH = 16 as const;

export const E2EE_SALT_LENGTH = 32 as const;

export const E2EE_RECOVERY_KEY_BYTES = 16 as const;

export const E2EE_RECOVERY_KEY_GROUP_SIZE = 4 as const;

export const E2EE_RECOVERY_KEY_SEPARATOR = '-' as const;

export const E2EE_KEY_SLOTS_FILE = 'key-slots.json' as const;

export const E2EE_KEY_SLOTS_VERSION = 1 as const;

export const E2EE_ARGON2_CONFIG = {
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 1,
  hashLength: 32,
} as const satisfies {
  timeCost: number;
  memoryCost: number;
  parallelism: number;
  hashLength: number;
};

export const E2EE_CIPHERTEXT_PREFIX = 'snaptium-e2ee:' as const;

export const E2EE_ERROR_CODES = {
  MASTER_PASSWORD_REQUIRED: 'MASTER_PASSWORD_REQUIRED',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  DEK_NOT_UNLOCKED: 'DEK_NOT_UNLOCKED',
  KEY_SLOTS_CORRUPTED: 'KEY_SLOTS_CORRUPTED',
  KEY_SLOTS_NOT_FOUND: 'KEY_SLOTS_NOT_FOUND',
  RECOVERY_KEY_INVALID: 'RECOVERY_KEY_INVALID',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  SETUP_FAILED: 'SETUP_FAILED',
  PASSWORD_CHANGE_FAILED: 'PASSWORD_CHANGE_FAILED',
  ALREADY_SETUP: 'ALREADY_SETUP',
} as const satisfies Record<string, string>;

export type E2eeErrorCode = (typeof E2EE_ERROR_CODES)[keyof typeof E2EE_ERROR_CODES];

export const ACCESS_CONTROL_TIMEOUT_OPTIONS = {
  DISABLED: 0,
  ONE_MINUTE: 1,
  FIVE_MINUTES: 5,
  FIFTEEN_MINUTES: 15,
  THIRTY_MINUTES: 30,
  ONE_HOUR: 60,
} as const satisfies Record<string, number>;

export type AccessControlTimeout = (typeof ACCESS_CONTROL_TIMEOUT_OPTIONS)[keyof typeof ACCESS_CONTROL_TIMEOUT_OPTIONS];

