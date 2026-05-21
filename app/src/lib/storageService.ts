import { auth } from "./firebase";

/**
 * Uploads a file to Supabase Storage securely via an API route.
 * 
 * @param file The File object from an <input type="file">
 * @param path The path in Supabase Storage (e.g., "tickets/123/proof.jpg")
 * @param onProgress Optional callback for upload progress (0-100)
 */
export async function uploadMediaToStorage(
    file: File, 
    path: string, 
    onProgress?: (progress: number) => void
): Promise<string> {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("Unauthorized to upload media.");

    if (onProgress) onProgress(20);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    if (onProgress) onProgress(60);

    const response = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to upload media.");
    }

    if (onProgress) onProgress(100);

    return data.publicUrl;
}
