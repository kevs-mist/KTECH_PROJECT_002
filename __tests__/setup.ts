import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';

// Mock Supabase client
vi.mock('../../utils/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          single: () => Promise.resolve({ data: null, error: null })
        })
      })
    })
  })
}));

// Mock Supabase admin client
vi.mock('../../utils/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          single: () => Promise.resolve({ data: null, error: null })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null })
        })
      }),
      delete: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        })
      })
    })
  })
}));

// Mock Firebase admin
vi.mock('../utils/firebase/admin', () => ({
  adminAuth: {
    verifyIdToken: () => Promise.resolve({ uid: 'test-uid', email: 'test@test.com' }),
    generatePasswordResetLink: () => Promise.resolve('https://test.link'),
  },
}));
