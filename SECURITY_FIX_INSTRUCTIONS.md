# Security Fix Instructions - Remove Sensitive Files from Git

GitHub blocked your push because Firebase service account credentials were detected. Follow these steps to fix it:

## Step 1: Remove Sensitive Files from Git History

Run these commands in your terminal:

```bash
# Remove the Firebase credentials from git tracking
git rm --cached Earn9ja/earn9ja-21ae7-firebase-adminsdk-fbsvc-2e0945804a.json
git rm --cached backend/earn9ja-21ae7-firebase-adminsdk-fbsvc-2e0945804a.json
git rm --cached Earn9ja/google-services.json
git rm --cached Earn9ja/GoogleService-Info.plist

# Commit the removal
git commit -m "Remove sensitive Firebase credentials from repository"
```

## Step 2: Verify Files Are Ignored

The `.gitignore` files have been updated to prevent these files from being committed again. Verify with:

```bash
git status
```

You should NOT see the Firebase credential files listed.

## Step 3: Create Example Files (Optional)

Create placeholder files to help other developers know what's needed:

```bash
# In Earn9ja folder
echo '{"note": "Replace this with your actual google-services.json from Firebase Console"}' > Earn9ja/google-services.json.example

# In backend folder
echo '{"note": "Replace this with your actual Firebase Admin SDK JSON from Firebase Console"}' > backend/firebase-adminsdk.json.example
```

## Step 4: Push to GitHub

```bash
git push -u origin main
```

## Step 5: Rotate Your Firebase Credentials (IMPORTANT!)

Since these credentials were exposed (even briefly), you should rotate them:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project "earn9ja-21ae7"
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download the new JSON file
6. Replace the old files locally (they're now gitignored)
7. Update your production/deployment environment with new credentials

## Step 6: Update Environment Variables

Make sure your `.env` files contain references to these credential files but are also gitignored:

**Earn9ja/.env:**

```
GOOGLE_SERVICES_JSON_PATH=./google-services.json
```

**backend/.env:**

```
FIREBASE_ADMIN_SDK_PATH=./earn9ja-21ae7-firebase-adminsdk-fbsvc-2e0945804a.json
```

## What Was Fixed

✅ Updated `.gitignore` files to exclude:

- All Firebase credential files (`*firebase-adminsdk*.json`)
- `google-services.json`
- `GoogleService-Info.plist`
- `.env` files

✅ Files are now properly ignored and won't be committed again

## Important Notes

- **NEVER** commit credential files to git
- **ALWAYS** use `.gitignore` for sensitive files
- **ROTATE** credentials if they were exposed
- Use environment variables for configuration
- Keep example files (`.example` suffix) in the repo to guide setup

## If You Need Help

If you encounter issues, you can also use GitHub's secret scanning resolution:
https://github.com/Kenikool/Earn9ja/security/secret-scanning/unblock-secret/36BPgiuFZzIA55OiQBsA8oSsM55
