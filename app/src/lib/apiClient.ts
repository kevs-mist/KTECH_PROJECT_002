export async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    // Read the body as text in a single pass so we can guard against empty
    // payloads and non-JSON responses without ever invoking the native
    // `Response.json()` (which throws "Unexpected end of JSON input" on an
    // empty body and leaks an unhelpful browser-only message to the UI).
    const body = await response.text();
    const contentType = response.headers?.get("content-type") || "";

    if (!body) {
        // Empty body — surface a clear, actionable error instead of silently
        // returning `null` (callers treat the result as a typed payload).
        if (!response.ok) {
            throw new Error(`${label} failed with ${response.status} ${response.statusText || "empty response"}`);
        }
        throw new Error(`${label} returned an empty response. Please try again.`);
    }

    const trimmedBody = body.trim();
    const looksJson = trimmedBody.startsWith("{") || trimmedBody.startsWith("[");

    if (!contentType.includes("application/json") && !looksJson) {
        const preview = body.replace(/\s+/g, " ").slice(0, 120);
        throw new Error(`${label} returned ${response.status} ${response.statusText || "non-JSON response"}: ${preview}`);
    }

    let data: T;
    try {
        data = JSON.parse(body) as T;
    } catch {
        throw new Error(`${label} returned invalid JSON.`);
    }

    if (!response.ok) {
        const errorMessage =
            typeof data === "object" && data !== null && "error" in data
                ? String((data as { error?: unknown }).error)
                : `${label} failed with ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
    }

    if (typeof data === "object" && data !== null && "error" in data && (data as { error?: unknown }).error) {
        throw new Error(String((data as { error?: unknown }).error));
    }

    return data;
}
