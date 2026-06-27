/**
 * Email Service Tests
 * 
 * Tests for email functionality including sending, templates, and validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock nodemailer before importing email module
const mockSendMail = vi.fn(() => Promise.resolve({ messageId: 'test-message-id' }));
const mockTransporter = { sendMail: mockSendMail };

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockTransporter),
  },
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables for tests
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'test-pass';
    process.env.SMTP_FROM = 'Test <test@test.com>';
  });

  afterEach(() => {
    mockSendMail.mockClear();
  });

  describe('Environment Configuration', () => {
    it('should have all required SMTP environment variables', () => {
      expect(process.env.SMTP_HOST).toBeDefined();
      expect(process.env.SMTP_PORT).toBeDefined();
      expect(process.env.SMTP_USER).toBeDefined();
      expect(process.env.SMTP_PASS).toBeDefined();
    });

    it('should validate SMTP port is numeric', () => {
      const port = Number(process.env.SMTP_PORT);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });
  });

  describe('Transporter Creation', () => {
    it('should create nodemailer transporter with correct config', async () => {
      const { default: nodemailerMock } = await import('nodemailer');
      
      // Import the email module to trigger transporter creation
      await import('../../utils/email');
      
      expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    });
  });

  describe('Email Functions Exist', () => {
    it('should export sendEmail function', async () => {
      const emailModule = await import('../../utils/email');
      expect(emailModule.sendEmail).toBeDefined();
      expect(typeof emailModule.sendEmail).toBe('function');
    });

    it('should export sendTicketVerification function', async () => {
      const emailModule = await import('../../utils/email');
      expect(emailModule.sendTicketVerification).toBeDefined();
      expect(typeof emailModule.sendTicketVerification).toBe('function');
    });

    it('should export sendEmployeeVerification function', async () => {
      const emailModule = await import('../../utils/email');
      expect(emailModule.sendEmployeeVerification).toBeDefined();
      expect(typeof emailModule.sendEmployeeVerification).toBe('function');
    });

    it('should export sendRouteVerification function', async () => {
      const emailModule = await import('../../utils/email');
      expect(emailModule.sendRouteVerification).toBeDefined();
      expect(typeof emailModule.sendRouteVerification).toBe('function');
    });
  });

  describe('Email Sending', () => {
    it('should call sendMail with correct parameters', async () => {
      const { sendEmail } = await import('../../utils/email');
      
      await sendEmail('test@example.com', 'Test Subject', '<p>Test Body</p>');
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });
    });
  });

  describe('HTML Templates', () => {
    it('should generate valid HTML for ticket verification', async () => {
      const { sendTicketVerification } = await import('../../utils/email');
      
      const mockTicket = {
        id: '123',
        ticket_no: 'TICK-001',
        title: 'Test Ticket',
        description: 'Test Description',
        issue_type: 'Hardware',
        priority: 'High',
        status: 'open',
        atm_id: 'ATM-001',
        atm_location: 'Test Location',
        bank_location: 'Test Bank',
        bank_id: 'BANK-001',
        created_by: 'user-123',
        created_at: new Date().toISOString(),
      };

      await sendTicketVerification(mockTicket, 'test@example.com', 'Test User');
      
      const callArgs = mockSendMail.mock.calls[0][0];
      
      expect(callArgs.html).toContain('Test Ticket');
      expect(callArgs.html).toContain('TICK-001');
      expect(callArgs.html).toContain('Test Description');
      expect(callArgs.html).toContain('<!DOCTYPE html>');
    });

    it('should generate valid HTML for employee verification', async () => {
      const { sendEmployeeVerification } = await import('../../utils/email');
      
      const mockEmployee = {
        employee_id: 'EMP-001',
        firebase_uid: 'firebase-123',
        full_name: 'John Doe',
        email: 'john@example.com',
        department: 'Engineering',
        status: 'active' as const,
        joined_at: new Date().toISOString(),
        is_online: true,
        last_seen: new Date().toISOString(),
        active_tickets: 0,
        closed_tickets: 0,
      };

      await sendEmployeeVerification(mockEmployee, 'https://example.com/verify');
      
      const callArgs = mockSendMail.mock.calls[0][0];
      
      expect(callArgs.html).toContain('John Doe');
      expect(callArgs.html).toContain('EMP-001');
      expect(callArgs.html).toContain('john@example.com');
      expect(callArgs.html).toContain('https://example.com/verify');
    });
  });
});
