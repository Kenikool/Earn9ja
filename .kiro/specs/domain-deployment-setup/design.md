# Domain Deployment Setup - Design Document

## Overview

This design document outlines the architecture and implementation strategy for deploying the Earn9ja platform to production using the Hostinger domain (**earn9ja.site**) and **Render** as the hosting platform. The solution encompasses DNS configuration, backend API deployment on Render, legal document hosting, mobile app configuration, and production service setup.

The deployment follows a phased approach:

1. Domain and DNS configuration (Hostinger)
2. Legal documents hosting (GitHub Pages)
3. Backend API deployment (Render)
4. Mobile app production build and store submission
5. Production services configuration (payment gateways, monitoring, notifications)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Hostinger Domain                           │
│                    (earn9ja.site)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │   www    │  │   api    │  │  legal   │
        │          │  │          │  │          │
        └──────────┘  └──────────┘  └──────────┘
             │             │             │
             ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Landing  │  │  Render  │  │  GitHub  │
        │   Page   │  │  Service │  │  Pages   │
        │ (Future) │  │          │  │          │
        └──────────┘  └──────────┘  └──────────┘
                           │
                           │ (Auto SSL, Auto Deploy)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │ MongoDB │      │  Redis   │      │ Firebase │
   │  Atlas  │      │  Cloud   │      │  Admin   │
   └─────────┘      └──────────┘      └──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │Paystack │      │Flutterwave│     │  Twilio  │
   │         │      │          │      │   SMS    │
   └─────────┘      └──────────┘      └──────────┘

                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
   ┌─────────┐                          ┌──────────┐
   │  Play   │                          │   App    │
   │  Store  │                          │  Store   │
   │ (Android)│                         │  (iOS)   │
   └─────────┘                          └──────────┘
```

### DNS Configuration

```
Domain: earn9ja.site (Hostinger)

DNS Records:
┌──────────────┬──────┬─────────────────────────────────────────┬─────┐
│ Name         │ Type │ Value                                   │ TTL │
├──────────────┼──────┼─────────────────────────────────────────┼─────┤
│ @            │ A    │ 76.76.21.21 (Render's IP - optional)    │ 3600│
│ www          │ CNAME│ earn9ja.site                            │ 3600│
│ api          │ CNAME│ earn9ja-backend.onrender.com            │ 3600│
│ legal        │ CNAME│ <github-username>.github.io             │ 3600│
└──────────────┴──────┴─────────────────────────────────────────┴─────┘
```

## Components and Interfaces

### 1. Hostinger Domain Configuration

**Component:** DNS Management Interface

**Configuration Steps:**

1. Access Hostinger control panel (hPanel)
2. Navigate to Domain → DNS/Name Servers
3. Add DNS records as specified in architecture
4. Wait for DNS propagation (typically 1-24 hours)

**DNS Record Details:**

- **API Subdomain (api)**: CNAME pointing to Render service URL (earn9ja-backend.onrender.com)
- **Legal Subdomain (legal)**: CNAME pointing to GitHub Pages
- **WWW Subdomain**: CNAME redirecting to root domain
- **Root Domain (@)**: Optional A record to Render's IP

### 2. Render Backend Deployment

**Component:** Render Web Service

**Why Render?**

- ✅ Automatic HTTPS/SSL certificates
- ✅ Automatic deployments from Git
- ✅ Built-in health checks and auto-restart
- ✅ Environment variable management
- ✅ Free tier available ($0/month for starter)
- ✅ Easy scaling options
- ✅ No server management required
- ✅ Better than VPS for Node.js apps

**Render Service Configuration:**

```yaml
# render.yaml (optional - for infrastructure as code)
services:
  - type: web
    name: earn9ja-backend
    env: node
    region: oregon
    plan: starter # Free tier or upgrade to $7/month
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: API_VERSION
        value: v1
    # Add all other environment variables in Render dashboard
```

**Deployment Process:**

1. **Connect GitHub Repository:**

   - Sign up at https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select your Earn9ja repository
   - Render will auto-detect Node.js

2. **Configure Build Settings:**

   ```
   Name: earn9ja-backend
   Region: Oregon (US West) or Frankfurt (Europe)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

3. **Configure Environment Variables:**

   - Add all variables from backend/.env.example
   - Use Render's dashboard (Environment tab)
   - Variables are encrypted at rest

4. **Configure Custom Domain:**

   - In Render dashboard → Settings → Custom Domains
   - Add: api.earn9ja.site
   - Render provides CNAME target
   - Add CNAME record in Hostinger DNS
   - SSL certificate auto-generated (Let's Encrypt)

5. **Configure Health Checks:**
   ```
   Health Check Path: /health
   ```

**Render Features:**

- **Auto-Deploy**: Pushes to main branch trigger automatic deployment
- **Zero-Downtime Deploys**: New version deployed before old one stops
- **Persistent Disk**: Optional for file storage (not needed for this app)
- **Logs**: Real-time logs in dashboard
- **Metrics**: CPU, memory, bandwidth monitoring
- **Rollback**: One-click rollback to previous deployment

### 3. SSL Certificate Setup

**Component:** Automatic SSL via Render

**Implementation:**

- Render automatically provisions SSL certificates via Let's Encrypt
- Certificates auto-renew every 90 days
- HTTPS enforced by default
- No manual configuration required
- Custom domain SSL configured automatically after DNS verification

**Verification:**

```bash
# Test SSL certificate
curl -I https://api.earn9ja.site

# Check certificate details
openssl s_client -connect api.earn9ja.site:443 -servername api.earn9ja.site
```

### 4. Legal Documents Hosting

**Component:** GitHub Pages

**Setup Process:**

1. **Create GitHub Repository:**

```bash
# Repository name: earn9ja-legal
# Visibility: Public
```

2. **Repository Structure:**

```
earn9ja-legal/
├── README.md
├── _config.yml
├── CNAME
├── privacy-policy.md
├── terms-of-service.md
└── data-protection.md
```

3. **Jekyll Configuration (\_config.yml):**

```yaml
title: Earn9ja Legal Documents
description: Privacy Policy, Terms of Service, and Data Protection
theme: jekyll-theme-cayman
baseurl: ""
url: "https://legal.earn9ja.site"

# SEO
lang: en
author: Earn9ja
```

4. **CNAME File:**

```
legal.earn9ja.site
```

5. **Custom Domain Setup:**

- Add CNAME file with content: `legal.earn9ja.site`
- Configure DNS CNAME record in Hostinger: `legal` → `<username>.github.io`
- Enable HTTPS in GitHub Pages settings (automatic after DNS propagation)

**URLs:**

- Privacy Policy: `https://legal.earn9ja.site/privacy-policy`
- Terms of Service: `https://legal.earn9ja.site/terms-of-service`
- Data Protection: `https://legal.earn9ja.site/data-protection`

### 5. Production Environment Variables

**Backend Environment Variables (Render Dashboard):**

```bash
# Server
NODE_ENV=production
PORT=5000
API_VERSION=v1
CORS_ORIGIN=https://earn9ja.site,https://www.earn9ja.site

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/earn9ja-prod?retryWrites=true&w=majority

# Redis
REDIS_URL=redis://:<password>@<host>:6379

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_REFRESH_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Email (Resend - Recommended)
RESEND_API_KEY=re_<your-production-api-key>
EMAIL_FROM=Earn9ja <noreply@earn9ja.site>

# Alternative: Email via SMTP (if using Resend SMTP)
# EMAIL_HOST=smtp.resend.com
# EMAIL_PORT=465
# EMAIL_SECURE=true
# EMAIL_USER=resend
# EMAIL_PASSWORD=re_<your-api-key>
# EMAIL_FROM=Earn9ja <noreply@earn9ja.site>

# SMS
TWILIO_ACCOUNT_SID=<production-sid>
TWILIO_AUTH_TOKEN=<production-token>
TWILIO_PHONE_NUMBER=<production-number>

# Payment Gateways
PAYSTACK_SECRET_KEY=sk_live_<production-key>
PAYSTACK_PUBLIC_KEY=pk_live_<production-key>
FLUTTERWAVE_SECRET_KEY=FLWSECK-<production-key>
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-<production-key>
FLUTTERWAVE_ENCRYPTION_KEY=<production-encryption-key>
FLUTTERWAVE_SECRET_HASH=<webhook-secret>

# Firebase
FIREBASE_PROJECT_ID=earn9ja-21ae7
FIREBASE_CLIENT_EMAIL=<service-account-email>
FIREBASE_PRIVATE_KEY=<private-key>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<production-cloud>
CLOUDINARY_API_KEY=<production-key>
CLOUDINARY_API_SECRET=<production-secret>

# Sentry
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production

# AdMob
ADMOB_APP_ID_ANDROID=ca-app-pub-<your-id>~<app-id>
ADMOB_APP_ID_IOS=ca-app-pub-<your-id>~<app-id>
ADMOB_MAX_ADS_PER_DAY=50
ADMOB_FRAUD_CHECK_WINDOW=60000

# Platform Fees
PLATFORM_FEE_PERCENTAGE=10
WITHDRAWAL_FEE_PERCENTAGE=2
MIN_WITHDRAWAL_AMOUNT=1000
```

**Mobile App .env Configuration:**

```bash
# API
EXPO_PUBLIC_API_URL=https://api.earn9ja.site/api/v1

# AdMob (Production)
EXPO_PUBLIC_ADMOB_APP_ID_ANDROID=ca-app-pub-<your-id>~<app-id>
EXPO_PUBLIC_ADMOB_APP_ID_IOS=ca-app-pub-<your-id>~<app-id>
EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID=ca-app-pub-<your-id>/<banner-id>
EXPO_PUBLIC_ADMOB_BANNER_ID_IOS=ca-app-pub-<your-id>/<banner-id>
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID=ca-app-pub-<your-id>/<interstitial-id>
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS=ca-app-pub-<your-id>/<interstitial-id>
EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID=ca-app-pub-<your-id>/<rewarded-id>
EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS=ca-app-pub-<your-id>/<rewarded-id>

# Sentry
EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>

# Environment
NODE_ENV=production
```

### 6. Mobile App Production Build

**Android Build Process:**

```bash
# 1. Update version in app.json
# Increment versionCode and version

# 2. Build with EAS
cd Earn9ja
eas build --platform android --profile production

# Or build locally
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

**iOS Build Process:**

```bash
# 1. Update version in app.json
# Increment buildNumber and version

# 2. Build with EAS
eas build --platform ios --profile production

# Or build with Xcode
# Open ios/Earn9ja.xcworkspace
# Product > Archive
# Distribute App > App Store Connect
```

**EAS Build Configuration (eas.json):**

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.earn9ja.site/api/v1"
      },
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      },
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

### 7. App Store Submission

**Google Play Store:**

1. **Create App Listing:**

   - App name: Earn9ja
   - Short description: Earn money by completing tasks
   - Full description: (Detailed description of features)
   - Category: Productivity
   - Content rating: Everyone
   - Privacy Policy URL: `https://legal.earn9ja.site/privacy-policy`

2. **Required Assets:**

   - App icon: 512x512 PNG
   - Feature graphic: 1024x500 PNG
   - Screenshots: At least 2 (phone), 1080x1920 or 1080x2340
   - Screenshots: At least 1 (tablet), 1920x1200 or 2560x1600

3. **App Content:**
   - Target audience: 18+
   - Ads: Yes (AdMob)
   - In-app purchases: No
   - Permissions justification: (Explain each permission)

**Apple App Store:**

1. **Create App in App Store Connect:**

   - App name: Earn9ja
   - Subtitle: Earn Money Completing Tasks
   - Category: Productivity
   - Privacy Policy URL: `https://legal.earn9ja.site/privacy-policy`
   - Terms of Service URL: `https://legal.earn9ja.site/terms-of-service`

2. **Required Assets:**

   - App icon: 1024x1024 PNG
   - Screenshots: 6.5" display (1284x2778)
   - Screenshots: 5.5" display (1242x2208)
   - App preview video: Optional but recommended

3. **App Information:**
   - Age rating: 17+ (due to financial transactions)
   - Ads: Yes (AdMob)
   - In-app purchases: No
   - Export compliance: No encryption

## Data Models

### Deployment Configuration

```typescript
interface DeploymentConfig {
  domain: {
    registrar: "hostinger";
    name: "earn9ja.site";
    nameservers: string[];
  };

  dns: {
    records: DNSRecord[];
  };

  backend: {
    platform: "render";
    serviceName: "earn9ja-backend";
    region: "oregon" | "frankfurt";
    plan: "starter" | "standard" | "pro";
    customDomain: "api.earn9ja.site";
    ssl: {
      enabled: true;
      provider: "letsencrypt";
      autoRenew: true;
    };
  };

  legal: {
    host: "github-pages";
    repository: string;
    customDomain: "legal.earn9ja.site";
  };

  mobile: {
    android: {
      packageName: "com.earn9ja.app";
      versionCode: number;
      version: string;
    };
    ios: {
      bundleIdentifier: "com.earn9ja.app";
      buildNumber: number;
      version: string;
    };
  };
}

interface DNSRecord {
  name: string; // '@', 'www', 'api', 'legal'
  type: "A" | "CNAME" | "TXT" | "MX";
  value: string;
  ttl: number;
}
```

## Error Handling

### Deployment Errors

1. **DNS Propagation Delays:**

   - **Issue:** DNS changes take up to 48 hours to propagate
   - **Solution:** Use DNS checker tools (whatsmydns.net) to verify propagation
   - **Mitigation:** Plan deployment during low-traffic periods

2. **Render Build Failures:**

   - **Issue:** Build fails due to missing dependencies or configuration
   - **Solution:** Check build logs in Render dashboard
   - **Mitigation:** Test build locally before deploying (`npm run build`)

3. **Backend API Connection Errors:**

   - **Issue:** API cannot connect to MongoDB/Redis
   - **Solution:** Verify connection strings and network access in MongoDB Atlas/Redis Cloud
   - **Mitigation:** Test connections locally before deployment

4. **Mobile App Build Failures:**
   - **Issue:** EAS build fails due to configuration errors
   - **Solution:** Review build logs and fix configuration issues
   - **Mitigation:** Test builds locally before using EAS

### Runtime Errors

1. **API Downtime:**

   - **Detection:** Render health check monitoring
   - **Response:** Render automatic restart
   - **Notification:** Sentry alert to administrators
   - **Escalation:** Check Render logs and metrics

2. **Database Connection Loss:**

   - **Detection:** Mongoose connection error events
   - **Response:** Automatic reconnection with exponential backoff
   - **Notification:** Log to Sentry
   - **Escalation:** Alert if reconnection fails after 5 attempts

3. **Payment Gateway Failures:**
   - **Detection:** Webhook delivery failures or API errors
   - **Response:** Retry with exponential backoff (3 attempts)
   - **Notification:** Log transaction failure
   - **Escalation:** Manual review of failed transactions

## Testing Strategy

### Pre-Deployment Testing

1. **DNS Configuration Verification:**

```bash
# Test DNS resolution
nslookup api.earn9ja.site
nslookup legal.earn9ja.site

# Test DNS propagation
dig api.earn9ja.site +short
dig legal.earn9ja.site +short
```

2. **SSL Certificate Verification:**

```bash
# Test SSL certificate
curl -I https://api.earn9ja.site

# Check certificate details
echo | openssl s_client -servername api.earn9ja.site -connect api.earn9ja.site:443 2>/dev/null | openssl x509 -noout -dates
```

3. **Backend API Health Checks:**

```bash
# Test health endpoint
curl https://api.earn9ja.site/health

# Test API status
curl https://api.earn9ja.site/api/v1/status

# Test authentication
curl -X POST https://api.earn9ja.site/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

4. **Legal Documents Accessibility:**

```bash
# Test legal document URLs
curl -I https://legal.earn9ja.site/privacy-policy
curl -I https://legal.earn9ja.site/terms-of-service
curl -I https://legal.earn9ja.site/data-protection
```

### Post-Deployment Testing

1. **End-to-End Mobile App Testing:**

   - User registration flow
   - Login and authentication
   - Task browsing and completion
   - Payment transactions
   - Ad viewing and rewards
   - Notifications

2. **Load Testing:**

```bash
# Install Apache Bench
# Windows: Download from Apache website
# Mac: brew install httpd

# Test API load
ab -n 1000 -c 50 https://api.earn9ja.site/api/v1/tasks

# Monitor response times
ab -n 100 -c 10 -g results.tsv https://api.earn9ja.site/api/v1/tasks
```

3. **Security Testing:**

   - SSL/TLS configuration (ssllabs.com/ssltest)
   - API security headers
   - CORS configuration
   - Authentication token validation

4. **Monitoring Verification:**
   - Sentry error tracking
   - Render metrics (CPU, memory, bandwidth)
   - Database connection pooling
   - Redis cache hit rates
   - Payment webhook delivery

### Rollback Testing

1. **Backend Rollback:**

   - Render provides one-click rollback to previous deployment
   - Test rollback in Render dashboard → Deploys → Rollback

2. **Database Rollback:**

```bash
# Test database restore
mongorestore --uri="<mongodb-uri>" --drop backup-<date>
```

3. **Mobile App Rollback:**
   - Verify ability to promote previous version in Play Console
   - Verify ability to submit previous build in App Store Connect

## Deployment Checklist

### Phase 1: Render Setup

- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Create new Web Service
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Deploy initial version
- [ ] Verify deployment success

### Phase 2: Domain and DNS Setup

- [ ] Access Hostinger control panel
- [ ] Configure DNS CNAME record for api subdomain
- [ ] Configure DNS CNAME record for legal subdomain
- [ ] Configure DNS CNAME record for www subdomain
- [ ] Verify DNS propagation (24-48 hours)

### Phase 3: Custom Domain on Render

- [ ] Add custom domain in Render dashboard
- [ ] Copy CNAME target from Render
- [ ] Update DNS record in Hostinger
- [ ] Wait for SSL certificate provisioning
- [ ] Verify HTTPS is working

### Phase 4: Legal Documents Hosting

- [ ] Create GitHub repository (earn9ja-legal)
- [ ] Upload legal documents
- [ ] Configure Jekyll theme
- [ ] Add CNAME file
- [ ] Enable GitHub Pages
- [ ] Add custom domain (legal.earn9ja.site)
- [ ] Verify HTTPS is enabled
- [ ] Test all legal document URLs

### Phase 5: Production Services

- [ ] Configure MongoDB Atlas production cluster
- [ ] Configure Redis Cloud production instance
- [ ] Set up production Paystack account
- [ ] Set up production Flutterwave account
- [ ] Configure production Twilio account
- [ ] Set up production email (Gmail/SendGrid)
- [ ] Configure Sentry for backend
- [ ] Configure Sentry for mobile app
- [ ] Set up production Firebase project
- [ ] Configure production AdMob account

### Phase 6: Mobile App Build

- [ ] Update API URL in mobile app .env
- [ ] Update AdMob IDs for production
- [ ] Update legal document URLs
- [ ] Increment version numbers
- [ ] Build Android APK/AAB
- [ ] Build iOS IPA
- [ ] Test production builds locally

### Phase 7: App Store Submission

- [ ] Create Google Play Console account
- [ ] Create app listing in Play Console
- [ ] Upload screenshots and assets
- [ ] Submit Android app for review
- [ ] Create Apple Developer account
- [ ] Create app in App Store Connect
- [ ] Upload screenshots and assets
- [ ] Submit iOS app for review

### Phase 8: Post-Deployment

- [ ] Monitor Sentry for errors
- [ ] Monitor Render metrics
- [ ] Verify payment webhooks
- [ ] Test user registration flow
- [ ] Test task completion flow
- [ ] Test payment transactions
- [ ] Monitor database performance
- [ ] Set up automated backups
- [ ] Document rollback procedures
- [ ] Create monitoring dashboard

## Timeline Estimate

- **Phase 1 (Render Setup):** 2-4 hours
- **Phase 2 (DNS Setup):** 1-2 days (including propagation)
- **Phase 3 (Custom Domain):** 2-4 hours
- **Phase 4 (Legal Docs):** 2-4 hours
- **Phase 5 (Services):** 1-2 days
- **Phase 6 (Mobile Build):** 4-8 hours
- **Phase 7 (Store Submission):** 3-7 days (review time)
- **Phase 8 (Post-Deployment):** Ongoing

**Total Estimated Time:** 6-13 days (including app store review)

## Cost Estimate

### Monthly Recurring Costs

- **Hostinger Domain:** $10-15/year (~$1.25/month)
- **Render Hosting:**
  - Starter: $0/month (free tier with limitations)
  - Standard: $7/month (recommended for production)
  - Pro: $25/month (for high traffic)
- **MongoDB Atlas:** $0-57/month (M0 free tier or M10 shared)
- **Redis Cloud:** $0-7/month (30MB free or 250MB paid)
- **Twilio SMS:** Pay-as-you-go (~$0.0075 per SMS)
- **Email (Gmail):** Free (or SendGrid $15/month for 40k emails)
- **Sentry:** Free tier (5k errors/month) or $26/month
- **Firebase:** Free tier (Spark plan)
- **AdMob:** Free (revenue generating)
- **Cloudinary:** Free tier or $89/month

**Estimated Total:** $8-150/month depending on usage and tier selections

### One-Time Costs

- **Google Play Developer:** $25 (one-time)
- **Apple Developer Program:** $99/year
- **SSL Certificate:** Free (automatic via Render)

**Total One-Time:** $124 + $99/year for Apple

## Advantages of Render over VPS

1. **No Server Management:** No need to manage OS updates, security patches, or server configuration
2. **Automatic SSL:** Free SSL certificates with auto-renewal
3. **Auto-Deploy:** Push to Git triggers automatic deployment
4. **Zero-Downtime Deploys:** New version deployed before old one stops
5. **Built-in Monitoring:** CPU, memory, bandwidth metrics included
6. **Easy Scaling:** Upgrade plan with one click
7. **Health Checks:** Automatic restart on failure
8. **Logs:** Real-time logs in dashboard
9. **Rollback:** One-click rollback to previous deployment
10. **Cost-Effective:** Free tier available, paid plans start at $7/month
