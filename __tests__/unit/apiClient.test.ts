import { describe, it, expect } from 'vitest';
import { parseJsonResponse } from '../../app/src/lib/apiClient';

/**
 * Helper: build a Response with a given body and status.
 * The global Response class is available in the vitest Node 18+ env.
 */
function makeResponse(body: string | null, init: { status?: number; contentType?: string } = {}): Response {
    const status = init.status ?? 200;
    const headers = init.contentType ? { 'content-type': init.contentType } : undefined;
    return new Response(body, { status, headers });
}

describe('parseJsonResponse', () => {
    it('parses a valid JSON object body', async () => {
        const res = makeResponse(JSON.stringify({ id: 'abc', title: 'foo' }), { contentType: 'application/json' });
        const data = await parseJsonResponse<{ id: string; title: string }>(res, '/api/test');
        expect(data).toEqual({ id: 'abc', title: 'foo' });
    });

    it('parses a valid JSON array body', async () => {
        const res = makeResponse(JSON.stringify([1, 2, 3]), { contentType: 'application/json' });
        const data = await parseJsonResponse<number[]>(res, '/api/test');
        expect(data).toEqual([1, 2, 3]);
    });

    /**
     * Regression: empty 200 OK body must NOT silently return null.
     * Old code returned `null as T` which caused the browser to later throw
     * "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
     * when callers tried to use the typed result.
     */
    it('throws a clear error when the body is empty and status is OK', async () => {
        const res = makeResponse('', { status: 200, contentType: 'application/json' });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
            '/api/tickets returned an empty response. Please try again.'
        );
    });

    it('throws a labelled error when the body is empty and status is not OK', async () => {
        const res = makeResponse('', { status: 502, contentType: 'text/html' });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
            '/api/tickets failed with 502'
        );
    });

    it('throws when the body is non-JSON without an application/json content type', async () => {
        const res = makeResponse('<html>oops</html>', { status: 200, contentType: 'text/html' });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
            '/api/tickets returned 200'
        );
    });

    it('throws when the body looks like JSON but is malformed', async () => {
        const res = makeResponse('{not-json}', { status: 200, contentType: 'application/json' });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
            '/api/tickets returned invalid JSON.'
        );
    });

    it('extracts server-provided error message when status is not OK', async () => {
        const res = makeResponse(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
            status: 403,
            contentType: 'application/json',
        });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
            'Forbidden: Admin access required'
        );
    });

    it('extracts server-provided error message even when status is OK', async () => {
        const res = makeResponse(JSON.stringify({ error: 'Something went wrong' }), {
            status: 200,
            contentType: 'application/json',
        });
        await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow('Something went wrong');
    });

    /**
     * Key regression: the previous code had an inverted condition that
     * prevented the .json() fast-path from running. More importantly, the
     * old code could call .json() on an empty body and leak the native
     * browser error. The new code NEVER calls the native .json() and
     * always handles empty/malformed bodies with a friendly message.
     */
    it('never invokes native Response.json() and never throws the cryptic browser error', async () => {
        const res = makeResponse('', { status: 200, contentType: 'application/json' });
        const spy = vi.spyOn(res, 'json');
        try {
            await expect(parseJsonResponse(res, '/api/tickets')).rejects.toThrow(
                '/api/tickets returned an empty response. Please try again.'
            );
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});