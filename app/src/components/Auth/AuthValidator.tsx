export const AuthValidator = {
    /**
     * Validates an email address.
     * @returns An error string if invalid, or null if valid.
     */
    validateEmail: (email: string): string | null => {
        if (!email) return "Email is required.";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return "Please enter a valid email address.";
        }
        return null;
    },

    /**
     * Validates a password against strong criteria.
     * @returns An error string if invalid, or null if valid.
     */
    validatePassword: (password: string): string | null => {
        if (!password) return "Password is required.";
        if (password.length < 8) return "Password must be at least 8 characters long.";
        return null;
    },

    /**
     * Validates a password against strong criteria (for registration/reset).
     * @returns An error string if invalid, or null if valid.
     */
    validateStrongPassword: (password: string): string | null => {
        if (!password) return "Password is required.";
        if (password.length < 8) return "Password must be at least 8 characters long.";
        if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
        if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
        if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
        return null;
    },

    /**
     * Validates that a confirm password matches the primary password.
     * @returns An error string if they don't match, or null if valid.
     */
    validateConfirmPassword: (password: string, confirmPassword: string): string | null => {
        if (password !== confirmPassword) {
            return "Passwords do not match.";
        }
        return null;
    },

    /**
     * Complete validation for Registration
     */
    validateRegistration: (email: string, pass: string, confirmPass: string, name: string): string | null => {
        if (!name.trim()) return "Full name is required.";
        const emailError = AuthValidator.validateEmail(email);
        if (emailError) return emailError;
        
        const passError = AuthValidator.validateStrongPassword(pass);
        if (passError) return passError;
        
        const confirmError = AuthValidator.validateConfirmPassword(pass, confirmPass);
        if (confirmError) return confirmError;
        
        return null; // All valid
    }
};
