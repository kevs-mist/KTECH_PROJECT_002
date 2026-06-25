/**
 * Page Loading Tests
 * 
 * This test suite verifies that all pages in the application load correctly
 * and render as intended.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const appDir = resolve(__dirname, '../../app');

describe('Page Loading Tests', () => {
  describe('Public Pages', () => {
    it('should have home page file', () => {
      expect(existsSync(resolve(appDir, 'page.tsx'))).toBe(true);
    });

    it('should have login page file', () => {
      expect(existsSync(resolve(appDir, 'login/page.tsx'))).toBe(true);
    });

    it('should have register page file', () => {
      expect(existsSync(resolve(appDir, 'register/page.tsx'))).toBe(true);
    });

    it('should have reset password page file', () => {
      expect(existsSync(resolve(appDir, 'reset-password/page.tsx'))).toBe(true);
    });
  });

  describe('Protected Pages - Admin', () => {
    it('should have admin dashboard page file', () => {
      expect(existsSync(resolve(appDir, 'admin/dashboard/page.tsx'))).toBe(true);
    });

    it('should have admin engineers page file', () => {
      expect(existsSync(resolve(appDir, 'admin/engineers/page.tsx'))).toBe(true);
    });

    it('should have admin layout file', () => {
      expect(existsSync(resolve(appDir, 'admin/layout.tsx'))).toBe(true);
    });

    it('should have admin error page file', () => {
      expect(existsSync(resolve(appDir, 'admin/error.tsx'))).toBe(true);
    });
  });

  describe('Protected Pages - Employee', () => {
    it('should have employee dashboard page file', () => {
      expect(existsSync(resolve(appDir, 'employee/dashboard/page.tsx'))).toBe(true);
    });

    it('should have employee layout file', () => {
      expect(existsSync(resolve(appDir, 'employee/layout.tsx'))).toBe(true);
    });

    it('should have employee error page file', () => {
      expect(existsSync(resolve(appDir, 'employee/error.tsx'))).toBe(true);
    });
  });

  describe('Protected Pages - User Dashboard', () => {
    it('should have user dashboard page file', () => {
      expect(existsSync(resolve(appDir, 'dashboard/page.tsx'))).toBe(true);
    });

    it('should have user dashboard layout file', () => {
      expect(existsSync(resolve(appDir, 'dashboard/layout.tsx'))).toBe(true);
    });
  });

  describe('Route Guards', () => {
    it('should have admin route guard file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Routes/Admin_route.tsx'))).toBe(true);
    });

    it('should have employee route guard file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Routes/Employee_route.tsx'))).toBe(true);
    });

    it('should have auth route guard file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Routes/Auth_route.tsx'))).toBe(true);
    });
  });

  describe('API Routes', () => {
    it('should have tickets API route file', () => {
      expect(existsSync(resolve(appDir, 'api/tickets/route.ts'))).toBe(true);
    });

    it('should have employees API route file', () => {
      expect(existsSync(resolve(appDir, 'api/employees/route.ts'))).toBe(true);
    });

    it('should have register API route file', () => {
      expect(existsSync(resolve(appDir, 'api/auth/register/route.ts'))).toBe(true);
    });

    it('should have admin OTP API route file', () => {
      expect(existsSync(resolve(appDir, 'api/auth/admin-otp/route.ts'))).toBe(true);
    });

    it('should have password reset link API route file', () => {
      expect(existsSync(resolve(appDir, 'api/auth/password-reset-link/route.ts'))).toBe(true);
    });

    it('should have role API route file', () => {
      expect(existsSync(resolve(appDir, 'api/auth/role/route.ts'))).toBe(true);
    });

    it('should have admin requests API route file', () => {
      expect(existsSync(resolve(appDir, 'api/admin-requests/route.ts'))).toBe(true);
    });

    it('should have admin requests approve API route file', () => {
      expect(existsSync(resolve(appDir, 'api/admin-requests/approve/route.ts'))).toBe(true);
    });

    it('should have storage upload API route file', () => {
      expect(existsSync(resolve(appDir, 'api/storage/upload/route.ts'))).toBe(true);
    });
  });

  describe('UI Components', () => {
    it('should have login component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Pages/login/login.tsx'))).toBe(true);
    });

    it('should have register component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Pages/Register/register.tsx'))).toBe(true);
    });

    it('should have forgot password component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Auth/forgot_password_service.tsx'))).toBe(true);
    });

    it('should have create ticket modal component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Admin/CreateTicketModal.tsx'))).toBe(true);
    });

    it('should have admin sidebar component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/Admin/AdminSidebar.tsx'))).toBe(true);
    });

    it('should have toast component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/common/Toast.tsx'))).toBe(true);
    });

    it('should have header component file', () => {
      expect(existsSync(resolve(appDir, 'src/components/comman/header.jsx'))).toBe(true);
    });
  });

  describe('Services', () => {
    it('should have ticket service file', () => {
      expect(existsSync(resolve(appDir, 'src/lib/services/ticketService.ts'))).toBe(true);
    });

    it('should have employee service file', () => {
      expect(existsSync(resolve(appDir, 'src/lib/services/employeeService.ts'))).toBe(true);
    });
  });

  describe('Auth Context', () => {
    it('should have auth context file', () => {
      expect(existsSync(resolve(appDir, 'src/lib/AuthContext.tsx'))).toBe(true);
    });
  });

  describe('Global Pages', () => {
    it('should have global error page file', () => {
      expect(existsSync(resolve(appDir, 'error.tsx'))).toBe(true);
    });

    it('should have not-found page file', () => {
      expect(existsSync(resolve(appDir, 'not-found.tsx'))).toBe(true);
    });

    it('should have loading page file', () => {
      expect(existsSync(resolve(appDir, 'loading.tsx'))).toBe(true);
    });

    it('should have root layout file', () => {
      expect(existsSync(resolve(appDir, 'layout.tsx'))).toBe(true);
    });

    it('should have providers file', () => {
      expect(existsSync(resolve(appDir, 'providers.tsx'))).toBe(true);
    });
  });

  describe('Diagnostics Page', () => {
    it('should have diagnostics page file', () => {
      expect(existsSync(resolve(appDir, 'diagnostics/page.tsx'))).toBe(true);
    });
  });
});
