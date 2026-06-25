'use client';

import type { ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider } from './src/lib/AuthContext';
import { ToastProvider } from './src/components/common/Toast';

type ProvidersProps = {
  children: ReactNode;
};

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
