# Security Key Rotation Guide

## Critical Action Required: Rotate Firebase and Supabase Keys

Your `.env.local` file contains sensitive credentials that should be rotated immediately:

### Firebase Private Key Rotation

**Current Issue:** The Firebase private key is stored in plaintext in `.env.local`

**Steps to Rotate:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. This will download a new JSON file
6. Open the JSON file and copy the `private_key` value
7. Update `FIREBASE_PRIVATE_KEY` in your `.env.local` with the new key
8. **Important:** Delete the old private key from your system
9. Update `FIREBASE_CLIENT_EMAIL` if it changed

**Verification:**
- Test authentication flow after rotation
- Ensure Firebase Admin SDK initializes correctly

### Supabase Service Role Key Rotation

**Current Issue:** The Supabase service role key is stored in plaintext in `.env.local`

**Steps to Rotate:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to Settings → API
4. Under "Project API Keys", find "service_role (secret)"
5. Click "Regenerate" or "Generate New Key"
6. Copy the new service role key
7. Update `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` with the new key
8. **Important:** The old key will be invalidated immediately
9. Do NOT share or commit this key to version control

**Verification:**
- Test database operations that use the admin client
- Ensure RLS policies still work correctly
- Verify registration and admin operations

## Best Practices

1. **Never commit `.env.local` to git** - It should be in `.gitignore`
2. **Use environment-specific configs** - Use different keys for dev/staging/production
3. **Rotate keys regularly** - Every 90 days for production environments
4. **Monitor key usage** - Check Firebase/Supabase dashboards for unusual activity
5. **Use secret management** - For production, use services like:
   - AWS Secrets Manager
   - Google Secret Manager
   - Azure Key Vault
   - Vercel Environment Variables

## After Rotation Checklist

- [ ] Restart your development server
- [ ] Test user registration
- [ ] Test admin login
- [ ] Test employee login
- [ ] Verify database operations
- [ ] Check application logs for authentication errors
- [ ] Remove old keys from any backup locations
