import { describe, it, expect } from 'vitest';
import { normalizeColumnKey, isAtmIdColumn, normalizeRow } from '../../app/api/atm/import/route';

describe('ATM import route helpers', () => {
  it('normalizes column keys consistently', () => {
    expect(normalizeColumnKey('ATM ID/SR NO')).toBe('atm id sr no');
    expect(normalizeColumnKey('  sr_no  ')).toBe('sr no');
    expect(normalizeColumnKey('Bank Name')).toBe('bank name');
  });

  it('detects valid ATM ID column aliases', () => {
    expect(isAtmIdColumn('atm id')).toBe(true);
    expect(isAtmIdColumn('sr no')).toBe(true);
    expect(isAtmIdColumn('sr number')).toBe(true);
    expect(isAtmIdColumn('atm_id')).toBe(true);
    expect(isAtmIdColumn('location')).toBe(false);
  });

  it('normalizes an import row and maps supported columns', () => {
    const normalized = normalizeRow({
      'SR NO': 'ATM-123',
      'Bank Name': 'Acme Bank',
      'Location': 'Main Branch',
      'Engineer Email': 'engineer@test.com',
      'Latitude': 12.34,
      'Longitude': 56.78,
    });

    expect(normalized).toEqual({
      atm_id: 'ATM-123',
      bank_name: 'Acme Bank',
      location: 'Main Branch',
      engineer_email: 'engineer@test.com',
      latitude: '12.34',
      longitude: '56.78',
    });
  });

  it('returns null for invalid ATM ID values', () => {
    expect(normalizeRow({ 'ATM ID': 'ab' })).toBeNull();
    expect(normalizeRow({ 'ATM ID': 'atm$12' })).toBeNull();
  });

  it('skips empty cell values while preserving a valid ATM ID', () => {
    const normalized = normalizeRow({
      'atm_id': 'ATM-789',
      bank_name: '',
      address: null,
      'engineer contact': '123-456',
    });

    expect(normalized).toEqual({
      atm_id: 'ATM-789',
      engineer_contact: '123-456',
    });
  });
});
