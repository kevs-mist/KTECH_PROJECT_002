-- Migration: Create Supabase Storage Bucket
-- Description: Sets up the 'tickets' bucket for proof-of-work media.

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies
-- Allow authenticated users (Employees/Admins) to upload to the tickets bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT 
    TO authenticated
    WITH CHECK (bucket_id = 'tickets');

-- Allow everyone to view (public bucket)
CREATE POLICY "Allow public view" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'tickets');

-- Allow owners to delete their own files
CREATE POLICY "Allow individual delete" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'tickets' AND auth.uid()::text = (storage.foldername(name))[1]);
