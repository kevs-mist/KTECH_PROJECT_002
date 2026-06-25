import { describe, it, expect } from 'vitest';
import { sanitizeFileName } from '../../app/src/lib/utils/fileName';

describe('sanitizeFileName', () => {
  it('replaces invalid characters with underscores', () => {
    expect(sanitizeFileName('my bad file!.jpg')).toBe('my_bad_file.jpg');
    expect(sanitizeFileName('a/b\\c\td*.PNG')).toBe('c_d.png');
  });

  it('normalizes uppercase extensions and preserves valid characters', () => {
    expect(sanitizeFileName('Test File.MOV')).toBe('Test_File.mov');
  });

  it('uses a safe default when the file has no extension', () => {
    expect(sanitizeFileName('filename')).toBe('filename.bin');
  });

  it('uses file as the base name for empty input', () => {
    expect(sanitizeFileName('')).toBe('file.bin');
  });
});
