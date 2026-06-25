import { describe, it, expect } from 'vitest';
import { normalizeHeaderKey, isAtmIdHeader, hasValidAtmIdHeader } from '../../app/src/components/Admin/DataImportModal';

describe('DataImportModal helper functions', () => {
  it('normalizes Excel header values consistently', () => {
    expect(normalizeHeaderKey(' ATM ID/SR NO ')).toBe('atm id sr no');
    expect(normalizeHeaderKey('SR_NO')).toBe('sr no');
    expect(normalizeHeaderKey('Engineer Email')).toBe('engineer email');
  });

  it('detects ATM ID headers for supported aliases', () => {
    expect(isAtmIdHeader('atm_id')).toBe(true);
    expect(isAtmIdHeader('atm id')).toBe(true);
    expect(isAtmIdHeader('SR NO')).toBe(true);
    expect(isAtmIdHeader('sr_number')).toBe(true);
    expect(isAtmIdHeader('atm location')).toBe(false);
  });

  it('finds a valid ATM ID header in a header list', () => {
    expect(hasValidAtmIdHeader(['bank_name', 'SR NO', 'location'])).toBe(true);
    expect(hasValidAtmIdHeader(['bank_name', 'address', 'location'])).toBe(false);
  });
});
