# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` - Runs Next.js development server at http://localhost:3000
- **Build for production**: `npm run build` - Creates optimized production build
- **Start production server**: `npm run start` - Starts Next.js production server
- **Lint code**: `npm run lint` - Runs ESLint on all files
- **Run tests**: `npm run test` - Starts Vitest in watch mode
- **Run tests once**: `npm run test:run` - Runs Vitest once and exits
- **Type checking**: `npx tsc --noEmit` - TypeScript type checking without emitting files

## Code Architecture & Structure

### Project Organization
- **App Router**: Uses Next.js 16+ App Router (`app/` directory) for routing and layouts
- **Role-based Layouts**: Separate layouts for different user roles:
  - `app/admin/layout.tsx` - Admin dashboard layout
  - `app/employee/layout.tsx` - Employee field operations layout  
  - `app/dashboard/layout.tsx` - General dashboard layout
- **Shared Components**: Located in `app/src/components/` with subdirectories for:
  - `Auth/` - Authentication-related components
  - `Admin/` - Admin-specific components
  - `Pages/` - Page-level components
  - `Routes/` - Route protection components
- **Libraries & Services**:
  - `app/src/lib/` - Shared utilities, API clients, services
  - `app/src/lib/actions/` - Server actions for data mutations
  - `app/src/lib/services/` - Service classes for business logic
  - `app/src/lib/apiClient.ts` - Centralized API client with error handling
  - `app/src/lib/env.ts` - Environment variable validation
- **Authentication System**:
  - Firebase Auth for user authentication
  - Custom role verification via `/api/auth/role` endpoint
  - Role-based access: admin, employee, user
  - `app/src/lib/AuthContext.tsx` - Centralized auth state management
  - Protected routes using `Auth_route.tsx`, `Admin_route.tsx`, `Employee_route.tsx`
- **Data Layer**:
  - Supabase for relational database (admins, employees, tickets tables)
  - Firebase Storage for file uploads
  - Utilities in `app/utils/supabase/` for client/server/admin clients
  - Realtime subscriptions for online status tracking
- **API Routes**: Located in `app/api/` using Next.js Route Handlers:
  - Auth endpoints (`/api/auth/*`)
  - Resource endpoints (`/api/tickets`, `/api/employees`, etc.)
  - Admin approval workflows (`/api/admin-requests/*`)
  - Storage upload handlers (`/api/storage/upload`)

### Key Conventions
- **Server Actions**: Used for form submissions and data mutations (`app/src/lib/actions/`)
- **Error Handling**: Centralized error handling in `app/src/lib/utils/errorHandler.ts`
- **Security**: Input sanitization via `app/src/lib/security/sanitizer.ts`, file validation via `fileValidator.ts`
- **Environment Validation**: Required env vars validated at startup in `app/src/lib/env.ts`
- **Type Safety**: Extensive use of TypeScript with strict mode enabled
- **Testing**: Unit tests in `__tests__/unit/`, integration tests in `__tests__/integration/` using Vitest and React Testing Library
- **Styling**: MUI v5 with custom theme, Tailwind CSS for utility classes, CSS modules for component-scoped styles
- **Security Headers**: Configured in `next.config.ts` with strict CSP-like headers

### Common Development Patterns
1. **Adding a new page**: Create route folder under `app/` (e.g., `app/new-feature/page.tsx`)
2. **Adding API endpoint**: Create route folder under `app/api/` with `route.ts` file
3. **Adding shared component**: Place in `app/src/components/` with appropriate subfolder
4. **Adding service logic**: Create service class in `app/src/lib/services/` or action in `app/src/lib/actions/`
5. **Database operations**: Use Supabase client from `app/src/lib/supabase.ts` (browser) or `utils/supabase/server.ts` (server)
6. **Authentication checks**: Use `useAuth()` hook from `app/src/lib/AuthContext.tsx`
7. **Form validation**: Reuse validators from `app/src/components/Auth/AuthValidator.tsx`
8. **Error boundaries**: Use Next.js built-in error handling (`error.tsx`, `global-error.tsx`)

### Environment Variables
Required variables (see `.env.local` example):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, etc.
- `NEXT_PUBLIC_APP_URL`

### File References
- Entry point: `app/layout.tsx` (root layout with providers)
- Global styles: `app/globals.css`
- Firebase config: `app/src/lib/firebase.ts`
- Supabase client: `app/src/lib/supabase.ts` (browser), `utils/supabase/server.ts` (server)
- Auth context: `app/src/lib/AuthContext.tsx`
- API client: `app/src/lib/apiClient.ts`