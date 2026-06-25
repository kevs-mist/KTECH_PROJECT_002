import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataImportModal from '../../app/src/components/Admin/DataImportModal';

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

vi.mock('../../app/src/lib/services/ticketService', () => ({
  ticketService: {
    getIdToken: vi.fn().mockResolvedValue('test-token'),
  },
}));

describe('DataImportModal component', () => {
  it('shows a preview when the file contains a valid ATM ID header alias', async () => {
    const xlsx = await import('xlsx');
    const utils = (xlsx as any).utils;
    utils.sheet_to_json.mockReturnValue([
      { 'SR NO': 'ATM-001', bank_name: 'Test Bank', location: 'Test Location' },
    ]);

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { container } = render(<DataImportModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    const file = {
      name: 'sample.xlsx',
      size: 5,
      type: 'application/vnd.openxmlformats-officedocument-spreadsheetml.sheet',
      arrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
      slice: vi.fn(() => new Blob()),
    } as unknown as File;

    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('SR NO')).toBeInTheDocument();
      expect(screen.getByText('Test Bank')).toBeInTheDocument();
      expect(screen.getByText('Test Location')).toBeInTheDocument();
    });
  });

  it('shows an error when the uploaded file lacks a valid ATM ID header', async () => {
    const xlsx = await import('xlsx');
    const utils = (xlsx as any).utils;
    utils.sheet_to_json.mockReturnValue([
      { bank_name: 'Test Bank', location: 'Test Location' },
    ]);

    const { container } = render(<DataImportModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    const file = {
      name: 'sample.xlsx',
      size: 5,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      arrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
      slice: vi.fn(() => new Blob()),
    } as unknown as File;

    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Missing ATM ID column/i)).toBeInTheDocument();
    });
  });
});
