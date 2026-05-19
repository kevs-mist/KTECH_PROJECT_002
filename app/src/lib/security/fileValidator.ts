/**
 * File Validation Utility
 * Checks the "magic bytes" (file signatures) of an uploaded file buffer
 * to ensure it actually matches its reported MIME type, preventing 
 * malicious files disguised with fake extensions.
 */

// Magic numbers for common image and video formats
const MAGIC_BYTES = {
    JPEG: [0xFF, 0xD8, 0xFF],
    PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    WEBP: [0x52, 0x49, 0x46, 0x46], // RIFF (followed by WEBP later, but RIFF is enough for first 4)
    MP4: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
    MOV: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftypqt
};

/**
 * Validates a buffer against expected magic bytes for allowed types.
 */
export function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
    const bytes = Array.from(buffer.subarray(0, 8));

    const checkMatch = (magic: number[]) => {
        return magic.every((byte, index) => bytes[index] === byte);
    };

    switch (declaredType) {
        case "image/jpeg":
            return checkMatch(MAGIC_BYTES.JPEG);
        case "image/png":
            return checkMatch(MAGIC_BYTES.PNG);
        case "image/webp":
            return checkMatch(MAGIC_BYTES.WEBP);
        case "video/mp4":
            // MP4 and MOV have variations, just checking 'ftyp' broadly at offset 4 is safer
            // The 4th byte is 0x66 'f', 5th 0x74 't', 6th 0x79 'y', 7th 0x70 'p'
            if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
                return true;
            }
            return false;
        case "video/quicktime":
            if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
                return true;
            }
            return false;
        default:
            return false;
    }
}
