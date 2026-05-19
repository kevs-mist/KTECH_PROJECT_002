import { describe, it, expect } from 'vitest';
import { validateMagicBytes } from '../../app/src/lib/security/fileValidator';

describe('validateMagicBytes', () => {
    it('should validate valid JPEG magic bytes', () => {
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
        expect(validateMagicBytes(jpegBuffer, 'image/jpeg')).toBe(true);
        expect(validateMagicBytes(jpegBuffer, 'image/png')).toBe(false);
    });

    it('should validate valid PNG magic bytes', () => {
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        expect(validateMagicBytes(pngBuffer, 'image/png')).toBe(true);
        expect(validateMagicBytes(pngBuffer, 'image/jpeg')).toBe(false);
    });

    it('should validate valid WEBP magic bytes', () => {
        const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
        expect(validateMagicBytes(webpBuffer, 'image/webp')).toBe(true);
        expect(validateMagicBytes(webpBuffer, 'image/png')).toBe(false);
    });

    it('should validate valid MP4/MOV container magic bytes (ftyp)', () => {
        const mp4Buffer = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
        expect(validateMagicBytes(mp4Buffer, 'video/mp4')).toBe(true);
        expect(validateMagicBytes(mp4Buffer, 'video/quicktime')).toBe(true);
        expect(validateMagicBytes(mp4Buffer, 'image/jpeg')).toBe(false);
    });

    it('should reject fake files or invalid bytes', () => {
        const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        expect(validateMagicBytes(invalidBuffer, 'image/jpeg')).toBe(false);
        expect(validateMagicBytes(invalidBuffer, 'image/png')).toBe(false);
        expect(validateMagicBytes(invalidBuffer, 'video/mp4')).toBe(false);
    });

    it('should reject unsupported declared types', () => {
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
        expect(validateMagicBytes(jpegBuffer, 'application/pdf')).toBe(false);
    });
});
