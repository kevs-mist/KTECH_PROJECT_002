export async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    if (typeof response.text !== "function" && typeof response.json === "function") {
        const data = await response.json() as T;
        if (!response.ok) {
            const errorMessage =
                typeof data === "object" && data !== null && "error" in data
                    ? String((data as { error?: unknown }).error)
                    : `${label} failed with ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        return data;
    }

    const body = await response.text();
    const contentType = response.headers?.get("content-type") || "";

    if (!body) {
        if (!response.ok) {
            throw new Error(`${label} failed with ${response.status} ${response.statusText}`);
        }
        return null as T;
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
