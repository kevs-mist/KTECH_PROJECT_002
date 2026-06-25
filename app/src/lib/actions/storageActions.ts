import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";

import { validateMagicBytes } from "../security/fileValidator";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_PATH_PATTERN = /^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/;
const ALLOWED_EXTENSIONS_BY_TYPE: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "video/mp4": ["mp4"],
    "video/quicktime": ["mov", "qt"],
};

function normalizeStoragePath(path: string, file: File) {
    const normalizedPath = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (
        !normalizedPath ||
        normalizedPath.includes("..") ||
        normalizedPath.includes("//") ||
        normalizedPath.length > 180 ||
        !STORAGE_PATH_PATTERN.test(normalizedPath)
    ) {
        throw new Error("Invalid upload path.");
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const pathExtension = normalizedPath.split(".").pop()?.toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS_BY_TYPE[file.type] ?? [];

    if (!fileExtension || !pathExtension || !allowedExtensions.includes(fileExtension) || !allowedExtensions.includes(pathExtension)) {
        throw new Error("Invalid file extension for uploaded media type.");
    }

    return normalizedPath;
}

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

    // 2. Validate Size, Type, and Storage Path
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 50MB.");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only images (JPG, PNG, WebP) and videos (MP4, MOV) are allowed.");
    }

    const safePath = normalizeStoragePath(path, file);

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
        .upload(safePath, buffer, {
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
        .getPublicUrl(safePath);

    return publicUrl;
}