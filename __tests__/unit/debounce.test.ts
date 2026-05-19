import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../../app/src/lib/utils/debounce';

describe('debounce utility', () => {
    it('should delay function invocation until specified quiet time', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('should only execute once even when called multiple times inside the window', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced();
        debounced();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('should pass parameters correctly to the debounced function', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('hello', 42);

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('hello', 42);

        vi.useRealTimers();
    });
});
