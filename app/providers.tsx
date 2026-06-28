'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './src/lib/AuthContext';
import { ToastProvider } from './src/components/common/Toast';

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
