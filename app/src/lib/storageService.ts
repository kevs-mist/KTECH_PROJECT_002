import { auth } from "./firebase";
import { uploadMediaAction } from "./actions/storageActions";

/**
 * Uploads a file to Supabase Storage securely via Server Action.
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

    const publicUrl = await uploadMediaAction(token, formData);

    if (onProgress) onProgress(100);

    return publicUrl;
}

