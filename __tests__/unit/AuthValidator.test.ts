import { describe, it, expect } from 'vitest';
import { AuthValidator } from '../../app/src/components/Auth/AuthValidator';

describe('AuthValidator - validateEmail', () => {
    it('should return error if email is empty', () => {
        expect(AuthValidator.validateEmail('')).toBe('Email is required.');
    });

    it('should return error if email is malformed', () => {
        expect(AuthValidator.validateEmail('invalid-email')).toBe('Please enter a valid email address.');
        expect(AuthValidator.validateEmail('invalid@')).toBe('Please enter a valid email address.');
        expect(AuthValidator.validateEmail('invalid@domain')).toBe('Please enter a valid email address.');
    });

    it('should return null for valid email address', () => {
        expect(AuthValidator.validateEmail('test@ktech.com')).toBeNull();
        expect(AuthValidator.validateEmail('engineer.john@ktech.com')).toBeNull();
    });
});

describe('AuthValidator - validatePassword (loose)', () => {
    it('should return error if password is empty', () => {
        expect(AuthValidator.validatePassword('')).toBe('Password is required.');
    });

    it('should return error if password is less than 8 chars', () => {
        expect(AuthValidator.validatePassword('1234567')).toBe('Password must be at least 8 characters long.');
    });

    it('should accept passwords without uppercase or numbers', () => {
        expect(AuthValidator.validatePassword('abcdefgh')).toBeNull();
        expect(AuthValidator.validatePassword('12345678')).toBeNull();
    });
});

describe('AuthValidator - validateStrongPassword (strict)', () => {
    it('should return error if password is empty', () => {
        expect(AuthValidator.validateStrongPassword('')).toBe('Password is required.');
    });

    it('should return error if password is less than 8 chars', () => {
        expect(AuthValidator.validateStrongPassword('Ab12345')).toBe('Password must be at least 8 characters long.');
    });

    it('should return error if password has no uppercase letter', () => {
        expect(AuthValidator.validateStrongPassword('abcdefg1!')).toBe('Password must contain at least one uppercase letter.');
    });

    it('should return error if password has no number', () => {
        expect(AuthValidator.validateStrongPassword('Abcdefg!')).toBe('Password must contain at least one number.');
    });

    it('should return error if password has no special character', () => {
        expect(AuthValidator.validateStrongPassword('Abcdefg1')).toBe('Password must contain at least one special character.');
    });

    it('should accept password meeting all criteria', () => {
        expect(AuthValidator.validateStrongPassword('Abcdefg1!')).toBeNull();
    });
});

describe('AuthValidator - validateConfirmPassword', () => {
    it('should return error if passwords do not match', () => {
        expect(AuthValidator.validateConfirmPassword('Password123', 'Password124')).toBe('Passwords do not match.');
    });

    it('should return null if passwords match', () => {
        expect(AuthValidator.validateConfirmPassword('Password123', 'Password123')).toBeNull();
    });
});

describe('AuthValidator - validateRegistration', () => {
    it('should validate complete registration inputs', () => {
        expect(AuthValidator.validateRegistration('', 'Abcdefg1!', 'Abcdefg1!', 'John Doe')).toBe('Email is required.');
        expect(AuthValidator.validateRegistration('john@ktech.com', 'abc', 'abc', 'John Doe')).toBe('Password must be at least 8 characters long.');
        expect(AuthValidator.validateRegistration('john@ktech.com', 'Abcdefg1!', 'Abcdefg1@', 'John Doe')).toBe('Passwords do not match.');
        expect(AuthValidator.validateRegistration('john@ktech.com', 'Abcdefg1!', 'Abcdefg1!', '  ')).toBe('Full name is required.');
        expect(AuthValidator.validateRegistration('john@ktech.com', 'Abcdefg1!', 'Abcdefg1!', 'John Doe')).toBeNull();
    });
});
