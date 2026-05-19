import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeService, EmployeeProfile } from '../../app/src/lib/services/employeeService';
import { auth } from '../../app/src/lib/firebase';
import { getEmployeesAction, setEmployeeOnlineStatusAction } from '../../app/src/lib/actions/employeeActions';

// Mock dependencies
vi.mock('../../app/src/lib/firebase', () => ({
    auth: {
        currentUser: null
    }
}));

vi.mock('../../app/src/lib/actions/employeeActions', () => ({
    getEmployeesAction: vi.fn(),
    setEmployeeOnlineStatusAction: vi.fn()
}));

describe('employeeService integration tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset auth.currentUser to null before each test
        (auth as any).currentUser = null;
    });

    describe('getIdToken', () => {
        it('should throw an error if no user is signed in', async () => {
            await expect(employeeService.getIdToken()).rejects.toThrow("Unauthorized: Please log in again.");
        });

        it('should return a token if user is signed in', async () => {
            const mockGetIdToken = vi.fn().mockResolvedValue('mock-firebase-token');
            (auth as any).currentUser = {
                getIdToken: mockGetIdToken
            };

            const token = await employeeService.getIdToken();
            expect(mockGetIdToken).toHaveBeenCalledWith(true);
            expect(token).toBe('mock-firebase-token');
        });
    });

    describe('getEmployees', () => {
        it('should throw error if unauthorized', async () => {
            await expect(employeeService.getEmployees()).rejects.toThrow("Unauthorized");
        });

        it('should fetch employees successfully when authorized', async () => {
            const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
            (auth as any).currentUser = {
                getIdToken: mockGetIdToken
            };

            const mockEmployees: EmployeeProfile[] = [
                {
                    firebase_uid: 'emp1',
                    employee_id: 'EMP-001',
                    full_name: 'John Doe',
                    email: 'john@ktech.com',
                    department: 'Field Ops',
                    status: 'active',
                    joined_at: '2026-01-01T00:00:00Z',
                    is_online: true,
                    last_seen: '2026-05-19T00:00:00Z',
                    active_tickets: 1,
                    closed_tickets: 10
                },
                {
                    firebase_uid: 'emp2',
                    employee_id: 'EMP-002',
                    full_name: 'Jane Smith',
                    email: 'jane@ktech.com',
                    department: 'Operations',
                    status: 'active',
                    joined_at: '2026-02-01T00:00:00Z',
                    is_online: false,
                    last_seen: '2026-05-18T00:00:00Z',
                    active_tickets: 0,
                    closed_tickets: 5
                }
            ];
            vi.mocked(getEmployeesAction).mockResolvedValue(mockEmployees);

            const result = await employeeService.getEmployees();
            expect(getEmployeesAction).toHaveBeenCalledWith('mock-token');
            expect(result).toEqual(mockEmployees);
        });
    });

    describe('setOnlineStatus', () => {
        it('should throw error if unauthorized', async () => {
            await expect(employeeService.setOnlineStatus(true)).rejects.toThrow("Unauthorized");
        });

        it('should call setEmployeeOnlineStatusAction with parameters successfully', async () => {
            const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
            (auth as any).currentUser = {
                getIdToken: mockGetIdToken
            };

            vi.mocked(setEmployeeOnlineStatusAction).mockResolvedValue(undefined);

            const result = await employeeService.setOnlineStatus(true);
            expect(setEmployeeOnlineStatusAction).toHaveBeenCalledWith('mock-token', true);
            expect(result).toBeUndefined();
        });
    });
});
