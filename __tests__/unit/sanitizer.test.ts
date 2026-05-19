import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../app/src/lib/security/sanitizer';

describe('sanitizeText', () => {
    it('should return empty string for null, undefined, or empty inputs', () => {
        expect(sanitizeText(null)).toBe('');
        expect(sanitizeText(undefined)).toBe('');
        expect(sanitizeText('')).toBe('');
    });

    it('should preserve plain text', () => {
        expect(sanitizeText('Hello World')).toBe('Hello World');
        expect(sanitizeText('ATM screen is broken')).toBe('ATM screen is broken');
    });

    it('should strip script tags entirely including contents', () => {
        expect(sanitizeText('<script>alert("XSS")</script>')).toBe('');
        expect(sanitizeText('Text <script>someCode()</script> more text')).toBe('Text  more text');
    });

    it('should strip HTML tags but keep content', () => {
        expect(sanitizeText('<b>Bold Text</b>')).toBe('Bold Text');
        expect(sanitizeText('<div>Some <span>nested</span> html</div>')).toBe('Some nested html');
    });

    it('should strip HTML attributes', () => {
        expect(sanitizeText('<img src="x" onerror="alert(1)" />')).toBe('');
        expect(sanitizeText('<a href="javascript:alert(1)">Click me</a>')).toBe('Click me');
    });
});
