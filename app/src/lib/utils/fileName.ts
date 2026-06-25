export function sanitizeFileName(fileName: string) {
    const normalized = fileName.trim().replace(/\\/g, "/");
    const parts = normalized.split("/");
    const rawName = parts[parts.length - 1] || "file";
    const lastDot = rawName.lastIndexOf(".");
    const base = lastDot > 0 ? rawName.slice(0, lastDot) : rawName;
    const ext = lastDot > 0 ? rawName.slice(lastDot + 1) : "";

    const safeBase = base
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "file";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";

    return `${safeBase}.${safeExt}`;
}
