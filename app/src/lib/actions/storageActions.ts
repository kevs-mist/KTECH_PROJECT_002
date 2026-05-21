import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";

import { validateMagicBytes } from "../security/fileValidator";

export async function uploadMediaAction(idToken: string, formData: FormData) {
    // 1. Verify user is employee or admin
    const { role } = await verifyUserRoleAction(idToken);
    if (role !== "employee" && role !== "admin") {
        throw new Error("Unauthorized: Cannot upload media.");
    }

    const file = formData.get("file") as File | null;
    const path = formData.get("path") as string | null;

    if (!file || !path) {
        throw new Error("Missing file or path parameters.");
    }

    // 2. Validate Size and Type (MIME declaration)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 50MB.");
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only images (JPG, PNG, WebP) and videos (MP4, MOV) are allowed.");
    }

    // 3. Convert File to Buffer and Validate Magic Bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, file.type)) {
        throw new Error("Security Alert: File signature does not match declared file type. Upload rejected.");
    }

    // 4. Upload using Admin Client (Bypasses RLS issues)
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
        .from("tickets")
        .upload(path, buffer, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: true
        });

    if (uploadError) {
        console.error("Storage Upload Error:", uploadError);
        throw new Error("Failed to upload to storage: " + uploadError.message);
    }

    // 5. Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from("tickets")
        .getPublicUrl(path);

    return publicUrl;
}
