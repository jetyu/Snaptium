import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '@renderer/shared/utils/error.util';

describe('toErrorMessage', () => {
  it('returns error.message for Error instance', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies unknown values', () => {
    expect(toErrorMessage({ code: 500 })).toContain('[object Object]');
  });
});
