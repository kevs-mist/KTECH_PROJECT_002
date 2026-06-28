/**
 * Centralized Error Handler Utility for Prime Services CRM
 * Translates technical error codes (Firebase & PostgreSQL) into friendly, action-oriented notifications.
 */

interface ErrorWithCode {
    code?: string;
    message?: string;
}

export class ErrorHandler {
    /**
     * Map Firebase Auth codes to friendly messages
     */
    private static firebaseAuthMap: Record<string, string> = {
        "auth/invalid-credential": "The email or password you entered is incorrect. Please verify your details.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/user-not-found": "No account was found with this email address.",
        "auth/too-many-requests": "Too many failed attempts. This account has been temporarily locked for security. Please try again shortly.",
        "auth/email-already-in-use": "This email address is already registered. If it's yours, try resetting your password.",
        "auth/weak-password": "The password is too weak. Please use at least 6 characters, including letters and numbers.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/user-disabled": "This account has been disabled. Please contact your system administrator.",
        "auth/operation-not-allowed": "This sign-in method is currently disabled.",
        "auth/network-request-failed": "Network error. Please check your internet connection and try again.",
        "auth/popup-closed-by-user": "The sign-in popup was closed before completing. Please try again.",
        "auth/requires-recent-login": "Please log out and log back in to perform this critical security action."
    };

    /**
     * Parse and format any error into a friendly string
     */
    public static format(err: ErrorWithCode | string | Error | unknown | null | undefined, fallbackMessage: string = "An unexpected error occurred. Please try again."): string {
        if (!err) return fallbackMessage;

        // 1. Handle string errors
        if (typeof err === "string") {
            return this.cleanMessage(err);
        }

        // 2. Handle Error objects
        if (err instanceof Error) {
            return this.cleanMessage(err.message);
        }

        // 3. Handle unknown types - try to extract message
        if (typeof err === "object" && err !== null) {
            const objErr = err as Record<string, unknown>;
            const code = objErr.code;
            const message = objErr.message;
            
            if (code && typeof code === "string") {
                // Check exact key match in our firebase mapping
                const cleanCode = code.replace("auth/", "");
                const mapped = this.firebaseAuthMap[code] || this.firebaseAuthMap[`auth/${cleanCode}`];
                if (mapped) return mapped;

                // Check if string contains Firebase codes inside it
                for (const [key, msg] of Object.entries(this.firebaseAuthMap)) {
                    if (code.toLowerCase().includes(key.toLowerCase()) || code.toLowerCase().includes(key.replace("auth/", "").toLowerCase())) {
                        return msg;
                    }
                }
            }

            if (message && typeof message === "string") {
                // Connection errors
                if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
                    return "Network error: Unable to connect to our servers. Please check your connection.";
                }

                // Database constraint errors
                if (message.includes("violates unique constraint") || message.includes("duplicate key")) {
                    return "This record already exists in our system. Please use a unique identifier.";
                }
                if (message.includes("violates foreign key constraint")) {
                    return "The referenced related record was not found.";
                }
                if (message.includes("violates check constraint")) {
                    return "The values provided do not meet the system requirements.";
                }
                if (message.includes("violates not-null constraint") || message.includes("null value in column")) {
                    return "Please complete all required fields.";
                }

                // Optimistic lock errors
                if (message.includes("updated elsewhere") || message.includes("version check failed")) {
                    return "This ticket was modified by another engineer or administrator. Refreshing page to get latest updates...";
                }

                return this.cleanMessage(message);
            }
        }

        return fallbackMessage;
    }

    /**
     * Strip technical prefixes from raw messages
     */
    private static cleanMessage(msg: string): string {
        let clean = msg;
        // Strip Firebase prefix "Firebase: Error (auth/...)."
        clean = clean.replace(/^Firebase:\s*Error\s*\(([^)]+)\)\.?/i, "$1");
        // Strip raw "auth/" prefixes
        clean = clean.replace(/^auth\//i, "");
        // Capitalize first letter
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        return clean;
    }
}
