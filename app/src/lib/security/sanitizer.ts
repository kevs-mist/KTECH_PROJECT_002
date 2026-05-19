import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user input to prevent Cross-Site Scripting (XSS) attacks.
 * Strips all HTML tags and attributes by default to ensure only plain text is stored.
 * 
 * @param input The raw string input from the user.
 * @returns The sanitized, safe string.
 */
export function sanitizeText(input: string | undefined | null): string {
    if (!input) return "";

    // For absolute security in a CRM, we strip ALL HTML tags by default.
    // If rich text is needed later, we can allow specific tags (e.g., <b>, <i>).
    const clean = DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // No HTML allowed
        ALLOWED_ATTR: [], // No attributes allowed
        KEEP_CONTENT: true, // Keep the text inside stripped tags
    });

    return clean.trim();
}
