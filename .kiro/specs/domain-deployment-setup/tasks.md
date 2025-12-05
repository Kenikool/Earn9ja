# Implementation Plan

## Overview

This implementation plan provides step-by-step tasks for deploying the Earn9ja platform to production using your Hostinger domain (earn9ja.site) and Render as the hosting platform. Tasks are organized in a logical sequence that builds upon previous steps.

## Tasks

- [ ] 1. Set up Render account and deploy backend API

  - [ ] 1.1 Create Render account and connect GitHub

    - Sign up at https://render.com
    - Connect GitHub account to Render
    - Authorize Render to access your repository
    - _Requirements: 2.1, 2.7_

  - [ ] 1.2 Create new Web Service on Render

    - Click "New +" → "Web Service"
    - Select your Earn9ja repository
    - Configure service name as "earn9ja-backend"
    - Select region (Oregon or Frankfurt)
    - Set root directory to "backend"
    - Set build command: npm install && npm run build
    - Set start command: npm start
    - Select plan (Starter free or Standard $7/month)
    - _Requirements: 2.1, 2.7_

  - [ ] 1.3 Configure production environment variables in Render

    - Navigate to Environment tab in Render dashboard
    - Add NODE_ENV=production
    - Add PORT=5000
    - Add API_VERSION=v1
    - Add MongoDB Atlas connection string (MONGODB_URI)
    - Add Redis Cloud connection string (REDIS_URL)
    - Generate and add JWT secrets using: openssl rand -base64 32
    - Add production email SMTP credentials
    - Add production Twilio SMS credentials
    - Add production Paystack API keys
    - Add production Flutterwave API keys
    - Add Firebase Admin SDK credentials
    - Add Cloudinary credentials
    - Add Sentry DSN for error monitoring
    - Add AdMob app IDs and configuration
    - Add CORS_ORIGIN with production domains
    - _Requirements: 2.1, 6.1, 6.2, 8.1, 8.2_

  - [ ] 1.4 Deploy backend and verify deployment
    - Click "Create Web Service" to trigger first deployment
    - Monitor build logs in Render dashboard
    - Wait for deployment to complete (5-10 minutes)
    - Verify service status shows "Live"
    - Test health endpoint: curl https://earn9ja-backend.onrender.com/health
    - Test API status: curl https://earn9ja-backend.onrender.com/api/v1/status
    - _Requirements: 2.2, 2.3, 2.4, 2.7_

- [ ] 2. Configure Hostinger domain DNS records

  - Access Hostinger hPanel and navigate to DNS management
  - Add CNAME record for api subdomain: api → earn9ja-backend.onrender.com
  - Add CNAME record for www subdomain: www → earn9ja.site
  - Add CNAME record for legal subdomain: legal → <github-username>.github.io
  - Set TTL to 3600 for all records
  - Document all DNS records in a configuration file
  - Wait for DNS propagation (use whatsmydns.net to check)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Configure custom domain on Render

  - [ ] 3.1 Add custom domain in Render dashboard

    - Navigate to Settings → Custom Domains in Render
    - Click "Add Custom Domain"
    - Enter: api.earn9ja.site
    - Copy the CNAME target provided by Render
    - _Requirements: 1.5, 2.5_

  - [ ] 3.2 Update DNS and verify SSL certificate
    - Ensure DNS CNAME record points to Render's target
    - Wait for DNS propagation (1-24 hours)
    - Render will automatically provision SSL certificate
    - Verify HTTPS is working: curl -I https://api.earn9ja.site
    - Check SSL certificate: openssl s_client -connect api.earn9ja.site:443
    - _Requirements: 1.4, 1.5, 2.5_

- [ ] 4. Set up legal documents hosting on GitHub Pages

  - [ ] 4.1 Create GitHub repository for legal documents

    - Go to https://github.com and sign in
    - Create public repository named 'earn9ja-legal'
    - Initialize with README.md
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.2 Upload and configure legal documents

    - Copy privacy-policy.md from legal-docs folder to repository
    - Copy terms-of-service.md from legal-docs folder to repository
    - Copy data-protection.md from legal-docs folder to repository
    - Create \_config.yml with Jekyll theme (jekyll-theme-cayman)
    - Create CNAME file with content: legal.earn9ja.site
    - Update README.md with links to all legal documents
    - Commit and push all changes
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.3 Enable GitHub Pages and verify deployment
    - Navigate to repository Settings → Pages
    - Set Source to "Deploy from a branch"
    - Select branch: main, folder: / (root)
    - Click Save
    - Add custom domain: legal.earn9ja.site
    - Wait for DNS check and HTTPS provisioning (10-30 minutes)
    - Enable "Enforce HTTPS" checkbox
    - Test URLs: https://legal.earn9ja.site/privacy-policy
    - Test URLs: https://legal.earn9ja.site/terms-of-service
    - Test URLs: https://legal.earn9ja.site/data-protection
    - _Requirements: 3.4, 3.5_

- [ ] 5. Configure production database and indexes

  - [ ] 5.1 Set up MongoDB Atlas production cluster

    - Log in to MongoDB Atlas (https://cloud.mongodb.com)
    - Create new cluster or use existing
    - Create production database: earn9ja-prod
    - Configure network access (whitelist 0.0.0.0/0 for Render)
    - Create database user with strong password
    - Get connection string with retry writes enabled
    - Add connection string to Render environment variables
    - _Requirements: 2.2_

  - [ ] 5.2 Create database indexes for performance

    - Connect to MongoDB using MongoDB Compass or shell
    - Create unique index on users.email
    - Create unique index on users.phoneNumber
    - Create unique sparse index on users.referralCode
    - Create index on users.roles
    - Create compound index on tasks (sponsorId, status)
    - Create index on tasks.createdAt (descending)
    - Create index on tasks.expiresAt
    - Create compound index on tasksubmissions (taskId, workerId)
    - Create compound index on tasksubmissions (workerId, status)
    - Create compound index on transactions (userId, createdAt descending)
    - Create index on transactions.type
    - Create index on transactions.status
    - Create compound index on notifications (userId, createdAt descending)
    - Create compound index on notifications (userId, read)
    - Create index on referrals.referrerId
    - Create unique index on referrals.referredUserId
    - Create compound unique index on dailybonuses (userId, date)
    - Verify all indexes created successfully
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 5.3 Configure Redis Cloud production instance
    - Sign up at Redis Cloud (https://redis.com/try-free)
    - Create new subscription (free 30MB tier available)
    - Create database with name: earn9ja-prod
    - Configure persistence: AOF + RDB
    - Set eviction policy to allkeys-lru
    - Enable password authentication
    - Enable TLS/SSL for production
    - Get connection string (redis://:<password>@<host>:port)
    - Add connection string to Render environment variables
    - Test connection from Render logs
    - _Requirements: 2.3_

- [ ] 6. Set up production payment gateways

  - [ ] 6.1 Configure Paystack production account

    - Create Paystack business account at https://paystack.com
    - Complete KYC verification (business documents required)
    - Navigate to Settings → API Keys & Webhooks
    - Copy production secret key (sk*live*...)
    - Copy production public key (pk*live*...)
    - Add webhook URL: https://api.earn9ja.site/api/v1/webhooks/paystack
    - Copy webhook secret for signature verification
    - Add all keys to Render environment variables
    - Test webhook delivery with Paystack test tool
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ] 6.2 Configure Flutterwave production account

    - Create Flutterwave business account at https://flutterwave.com
    - Complete KYC verification (business documents required)
    - Navigate to Settings → API
    - Copy production secret key (FLWSECK-...)
    - Copy production public key (FLWPUBK-...)
    - Copy production encryption key
    - Add webhook URL: https://api.earn9ja.site/api/v1/webhooks/flutterwave
    - Generate and save webhook secret hash
    - Add all keys to Render environment variables
    - Test webhook delivery with Flutterwave test tool
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 6.3 Test payment gateway integration
    - Test Paystack payment initiation with small amount
    - Test Flutterwave payment initiation with small amount
    - Verify webhook delivery for successful payments
    - Verify webhook delivery for failed payments
    - Test payment refund functionality
    - Verify transaction records in database
    - Check Sentry for any payment errors
    - _Requirements: 6.5_

- [ ] 7. Configure production monitoring and alerting

  - [ ] 7.1 Set up Sentry for backend error tracking

    - Sign up at https://sentry.io
    - Create new project for backend (Node.js/Express)
    - Copy production DSN
    - Add SENTRY_DSN to Render environment variables
    - Add SENTRY_ENVIRONMENT=production to Render
    - Redeploy backend service on Render
    - Trigger test error to verify Sentry captures it
    - Configure alert rules in Sentry dashboard
    - _Requirements: 2.6, 7.1_

  - [ ] 7.2 Set up Sentry for mobile app crash reporting

    - Create new project in Sentry for mobile app (React Native)
    - Copy production DSN for mobile
    - Add to mobile app .env file as EXPO_PUBLIC_SENTRY_DSN
    - Configure Sentry environment as 'production'
    - Test crash reporting in development build
    - _Requirements: 7.2_

  - [ ] 7.3 Configure alert notifications
    - Set up email alerts for critical errors in Sentry
    - Configure alert thresholds (e.g., >10 errors in 5 minutes)
    - Test financial anomaly alerts in backend
    - Test system downtime alerts
    - Add team members to Sentry project
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 8. Configure production email and SMS services

  - [ ] 8.1 Set up production email service with Resend

    - Sign up for Resend at https://resend.com (free tier: 3,000 emails/month)
    - Create API key in Resend dashboard (name: Earn9ja Production)
    - Copy the API key (starts with re\_...) - save it securely
    - Add RESEND_API_KEY to Render environment variables
    - Add EMAIL_FROM=Earn9ja <noreply@earn9ja.site> to Render
    - (Optional) Verify domain earn9ja.site in Resend for better deliverability
    - (Optional) Add DNS records in Hostinger for domain verification
    - Install Resend package in backend: npm install resend
    - Update email service code to use Resend API (see EMAIL_SERVICE_SETUP.md)
    - Redeploy backend service on Render
    - Test email sending with sample verification email
    - _Requirements: 8.1, 8.3, 8.4_

  - [ ] 8.2 Set up production SMS service with Twilio
    - Create Twilio production account at https://twilio.com
    - Complete account verification
    - Purchase phone number for SMS sending (Nigerian number recommended)
    - Navigate to Console → Account Info
    - Copy Account SID
    - Copy Auth Token
    - Add TWILIO_ACCOUNT_SID to Render environment variables
    - Add TWILIO_AUTH_TOKEN to Render environment variables
    - Add TWILIO_PHONE_NUMBER to Render environment variables
    - Redeploy backend service
    - Test SMS sending with sample verification code
    - _Requirements: 8.2, 8.5_

- [ ] 9. Configure mobile app for production

  - [ ] 9.1 Update mobile app environment variables

    - Navigate to Earn9ja directory
    - Create or update .env file
    - Set EXPO_PUBLIC_API_URL=https://api.earn9ja.site/api/v1
    - Add production AdMob app IDs for Android
    - Add production AdMob app IDs for iOS
    - Add production AdMob ad unit IDs (banner, interstitial, rewarded)
    - Add production Sentry DSN
    - Set NODE_ENV=production
    - Commit .env file to repository (or use EAS Secrets)
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 9.2 Update legal document URLs in mobile app

    - Search codebase for legal document URL references
    - Update privacy policy URL to https://legal.earn9ja.site/privacy-policy
    - Update terms of service URL to https://legal.earn9ja.site/terms-of-service
    - Update data protection URL to https://legal.earn9ja.site/data-protection
    - Test URLs open correctly in mobile app browser
    - Commit changes to repository
    - _Requirements: 4.1_

  - [ ] 9.3 Configure production Firebase for mobile app
    - Go to Firebase Console (https://console.firebase.google.com)
    - Create new project or use existing: earn9ja-21ae7
    - Add Android app with package: com.earn9ja.app
    - Download google-services.json for Android
    - Add iOS app with bundle ID: com.earn9ja.app
    - Download GoogleService-Info.plist for iOS
    - Replace development Firebase config files with production versions
    - Configure Firebase Cloud Messaging for push notifications
    - Test push notification delivery
    - _Requirements: 4.5_

- [ ] 10. Build mobile app for production

  - [ ] 10.1 Prepare app for production build

    - Open Earn9ja/app.json
    - Update version number (e.g., from 1.0.0 to 1.0.1)
    - Update android.versionCode (increment by 1)
    - Update ios.buildNumber (increment by 1)
    - Review app name, description, and metadata
    - Commit changes to repository
    - _Requirements: 5.1, 5.2_

  - [ ] 10.2 Build Android production APK/AAB

    - Ensure EAS CLI is installed: npm install -g eas-cli
    - Log in to EAS: eas login
    - Configure EAS build profile in eas.json for production
    - Run build command: eas build --platform android --profile production
    - Wait for build to complete (15-30 minutes)
    - Download generated AAB file from EAS dashboard
    - Test AAB installation on physical Android device
    - Verify app connects to production API
    - _Requirements: 5.1_

  - [ ] 10.3 Build iOS production IPA
    - Ensure Apple Developer account is active
    - Configure EAS build profile in eas.json for production
    - Run build command: eas build --platform ios --profile production
    - Wait for build to complete (20-40 minutes)
    - Download generated IPA file from EAS dashboard
    - Upload to TestFlight for testing
    - Test IPA installation on physical iOS device
    - Verify app connects to production API
    - _Requirements: 5.2_

- [ ] 11. Submit mobile app to app stores

  - [ ] 11.1 Create Google Play Console listing

    - Create Google Play Developer account ($25 one-time fee)
    - Go to https://play.google.com/console
    - Click "Create app"
    - Fill in app name: Earn9ja
    - Select app category: Productivity
    - Fill in short description (80 characters max)
    - Fill in full description (4000 characters max)
    - Set content rating to Everyone or Teen
    - Add privacy policy URL: https://legal.earn9ja.site/privacy-policy
    - _Requirements: 5.3_

  - [ ] 11.2 Upload Android app assets and submit

    - Upload app icon (512x512 PNG, no transparency)
    - Upload feature graphic (1024x500 PNG)
    - Upload at least 2 phone screenshots (1080x1920 or 1080x2340)
    - Upload at least 1 tablet screenshot (1920x1200 or 2560x1600)
    - Navigate to Production → Create new release
    - Upload AAB file
    - Fill in release notes (what's new)
    - Review and rollout to production
    - Submit app for review
    - _Requirements: 5.5, 5.6_

  - [ ] 11.3 Create Apple App Store Connect listing

    - Create Apple Developer account ($99/year)
    - Go to https://appstoreconnect.apple.com
    - Click "My Apps" → "+" → "New App"
    - Fill in app name: Earn9ja
    - Fill in subtitle (30 characters max)
    - Select primary category: Productivity
    - Fill in description (4000 characters max)
    - Add privacy policy URL: https://legal.earn9ja.site/privacy-policy
    - Add terms of service URL: https://legal.earn9ja.site/terms-of-service
    - Set age rating to 17+ (financial transactions)
    - _Requirements: 5.4_

  - [ ] 11.4 Upload iOS app assets and submit
    - Upload app icon (1024x1024 PNG, no transparency)
    - Upload 6.5" display screenshots (1284x2778) - at least 3
    - Upload 5.5" display screenshots (1242x2208) - at least 3
    - Upload IPA file via Xcode or Transporter app
    - Select build from TestFlight
    - Fill in release notes (what's new)
    - Complete export compliance information
    - Submit app for review
    - _Requirements: 5.5, 5.6_

- [ ] 12. Implement backup and rollback procedures

  - [ ] 12.1 Configure automated database backups

    - In MongoDB Atlas, navigate to Backup tab
    - Enable Cloud Backup (available on M10+ clusters)
    - Configure backup schedule (daily recommended)
    - Set backup retention policy (7 days minimum)
    - Test database restore from backup
    - Document backup restoration procedure
    - _Requirements: 10.1_

  - [ ] 12.2 Document backend rollback procedure

    - Document Render rollback process (Dashboard → Deploys → Rollback)
    - Test rollback to previous deployment
    - Document steps for emergency rollback
    - Create checklist for rollback decision
    - Document how to check deployment history
    - _Requirements: 10.2, 10.5_

  - [ ] 12.3 Document mobile app rollback procedure
    - Document Play Store version rollback process
    - Document App Store version rollback process
    - Test promoting previous version in Play Console
    - Create checklist for app rollback decision
    - Document how to halt rollout if issues detected
    - _Requirements: 10.4, 10.5_

- [ ] 13. Perform post-deployment verification

  - [ ] 13.1 Verify DNS and SSL configuration

    - Test DNS resolution: nslookup api.earn9ja.site
    - Test DNS resolution: nslookup legal.earn9ja.site
    - Verify SSL certificate: curl -I https://api.earn9ja.site
    - Check SSL rating on https://www.ssllabs.com/ssltest/
    - Verify HTTPS redirects are working
    - Test from multiple locations using whatsmydns.net
    - _Requirements: 1.4, 1.5_

  - [ ] 13.2 Verify backend API functionality

    - Test health endpoint: curl https://api.earn9ja.site/health
    - Test API status: curl https://api.earn9ja.site/api/v1/status
    - Test user registration endpoint with sample data
    - Test user login endpoint with test credentials
    - Test task listing endpoint
    - Test payment initiation endpoint
    - Verify all endpoints use HTTPS
    - Check Render logs for any errors
    - _Requirements: 2.4, 2.5_

  - [ ] 13.3 Verify mobile app functionality

    - Download production app from Play Store/App Store
    - Test user registration flow
    - Test user login flow
    - Test task browsing and filtering
    - Test task submission
    - Test ad viewing and reward claiming
    - Test payment withdrawal
    - Test push notifications
    - Verify all API calls use production endpoint
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 13.4 Verify monitoring and alerting

    - Trigger test error and verify Sentry captures it
    - Verify Render shows service metrics (CPU, memory)
    - Test financial alert triggers
    - Verify email notifications are sent
    - Check all monitoring dashboards are accessible
    - Verify webhook deliveries are logged
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 13.5 Perform load testing
    - Install Apache Bench or use online tool
    - Run load test: ab -n 1000 -c 50 https://api.earn9ja.site/health
    - Monitor Render metrics during load test
    - Verify API response times are acceptable
    - Check database query performance
    - Verify Redis cache is being utilized
    - Document performance baseline
    - _Requirements: 9.5_

- [ ] 14. Create deployment documentation

  - [ ] 14.1 Document server configuration

    - Document Render service specifications
    - Document all environment variables (securely)
    - Document Render configuration settings
    - Document custom domain setup
    - Document SSL certificate configuration
    - _Requirements: 2.7_

  - [ ] 14.2 Document environment variables

    - Create secure document with all production environment variables
    - Document where each credential was obtained
    - Document how to rotate credentials
    - Store securely in password manager or encrypted file
    - Share with team members securely
    - _Requirements: 2.1_

  - [ ] 14.3 Create operations runbook

    - Document how to deploy backend updates (Git push to main)
    - Document how to restart services (Render dashboard)
    - Document how to check logs (Render logs tab)
    - Document how to handle common issues
    - Document emergency contacts and escalation procedures
    - Document monitoring dashboard URLs
    - _Requirements: 10.5_

  - [ ] 14.4 Update deployment guide
    - Update DEPLOYMENT_GUIDE.md with actual production URLs
    - Add screenshots of Render configuration steps
    - Document any deviations from original plan
    - Add troubleshooting section with actual issues encountered
    - Document lessons learned
    - _Requirements: 10.5_

## Notes

- All tasks are required for a comprehensive production deployment
- Each task should be completed and verified before moving to the next
- Keep detailed notes of any issues encountered and their solutions
- Take screenshots of important configuration steps for documentation
- Test thoroughly at each stage before proceeding
- Render provides automatic deployments on Git push to main branch
- DNS propagation can take up to 48 hours but usually completes in 1-4 hours
- App store review typically takes 1-7 days for both platforms

## Estimated Timeline

- Task 1: 2-4 hours (Render setup and initial deployment)
- Task 2: 1-2 days (DNS configuration and propagation)
- Task 3: 2-4 hours (Custom domain on Render)
- Task 4: 2-4 hours (Legal documents hosting)
- Task 5: 4-6 hours (Database and Redis setup)
- Task 6: 4-6 hours (Payment gateway configuration)
- Task 7: 2-3 hours (Monitoring setup)
- Task 8: 2-3 hours (Email and SMS configuration)
- Task 9: 2-3 hours (Mobile app configuration)
- Task 10: 4-6 hours (Mobile app builds)
- Task 11: 3-7 days (App store submission and review)
- Task 12: 2-3 hours (Backup and rollback documentation)
- Task 13: 3-4 hours (Post-deployment verification)
- Task 14: 2-3 hours (Documentation)

**Total: 6-13 days** (including app store review time)

## Render-Specific Notes

- Render automatically builds and deploys on Git push to main branch
- Free tier available but has limitations (spins down after inactivity)
- Standard plan ($7/month) recommended for production (no spin down)
- SSL certificates are automatically provisioned and renewed
- Health checks run every 30 seconds by default
- Logs are retained for 7 days on free tier, 30 days on paid plans
- Environment variables are encrypted at rest
- One-click rollback available for all deployments
- Zero-downtime deployments (new version deployed before old stops)
