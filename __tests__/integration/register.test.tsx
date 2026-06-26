import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const mockRegister = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('../../app/src/components/Pages/Register/Register_sevice_provider', () => ({
  useRegisterServiceProvider: () => ({
    register: mockRegister,
    isLoading: false,
    error: null,
  }),
}));

import Register from '../../app/src/components/Pages/Register/register';

describe('Register component', () => {
  beforeEach(() => {
    push.mockClear();
    mockRegister.mockReset();
  });

  it('shows validation errors when passwords do not match', async () => {
    render(<Register />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'Abcdefg1!' } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: 'Different1!' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match\./i)).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('calls register and navigates to employee dashboard on successful sign up', async () => {
    mockRegister.mockResolvedValueOnce({ success: true, user: { role: 'employee' } });

    render(<Register />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'Abcdefg1!' } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: 'Abcdefg1!' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('john@example.com', 'Abcdefg1!', 'John Doe', false);
      expect(push).toHaveBeenCalledWith('/employee/dashboard');
    });
  });
});
