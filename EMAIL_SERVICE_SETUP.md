# Email Service Setup Guide for Earn9ja

## Why Not Gmail in Production?

Gmail with app-specific passwords has several limitations:

- ❌ Daily sending limits (500 emails/day)
- ❌ Can be flagged as spam
- ❌ Not designed for transactional emails
- ❌ Can be blocked by email providers
- ❌ No delivery tracking or analytics

## Recommended: Resend

### Why Resend?

- ✅ Free tier: 3,000 emails/month, 100 emails/day
- ✅ Simple API integration (just change env variables)
- ✅ Excellent deliverability
- ✅ Custom domain support (noreply@earn9ja.site)
- ✅ Email tracking and analytics
- ✅ No credit card required for free tier

---

## Step 1: Sign Up for Resend

1. Go to https://resend.com
2. Click "Start Building"
3. Sign up with GitHub or email
4. Verify your email address

## Step 2: Get Your API Key

1. After login, go to **API Keys** in the dashboard
2. Click "Create API Key"
3. Name it: `Earn9ja Production`
4. Select permissions: **Sending access**
5. Click "Create"
6. **Copy the API key** (starts with `re_...`)
   - ⚠️ Save it securely - you won't see it again!

## Step 3: Verify Your Domain (Optional but Recommended)

### Why verify your domain?

- Emails will come from `noreply@earn9ja.site` instead of `onboarding@resend.dev`
- Better deliverability and trust
- Professional appearance

### How to verify:

1. In Resend dashboard, go to **Domains**
2. Click "Add Domain"
3. Enter: `earn9ja.site`
4. Resend will provide DNS records to add

5. **Add these DNS records in Hostinger:**

```
Type: TXT
Name: @
Value: [Resend will provide this]
TTL: 3600

Type: CNAME
Name: resend._domainkey
Value: [Resend will provide this]
TTL: 3600

Type: MX
Name: @
Value: [Resend will provide this]
Priority: 10
TTL: 3600
```

6. Wait 10-30 minutes for DNS propagation
7. Click "Verify" in Resend dashboard

## Step 4: Update Your Backend Code

### Option A: Using Resend SDK (Recommended)

1. **Install Resend package:**

```bash
cd backend
npm install resend
```

2. **Update your email service** (`backend/src/services/EmailService.ts`):

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Earn9ja <noreply@earn9ja.site>", // or 'onboarding@resend.dev' if domain not verified
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Email send error:", error);
      throw error;
    }

    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};
```

3. **Update environment variables:**

```bash
# In backend/.env (development)
RESEND_API_KEY=re_your_test_api_key_here
EMAIL_FROM=Earn9ja <onboarding@resend.dev>

# In Render (production)
RESEND_API_KEY=re_your_production_api_key_here
EMAIL_FROM=Earn9ja <noreply@earn9ja.site>
```

### Option B: Using SMTP (If you prefer to keep existing code)

Resend also provides SMTP access:

```bash
# SMTP Configuration
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=resend
EMAIL_PASSWORD=re_your_api_key_here
EMAIL_FROM=Earn9ja <noreply@earn9ja.site>
```

Your existing nodemailer code will work without changes!

## Step 5: Test Email Sending

Create a test script (`backend/src/scripts/test-email.ts`):

```typescript
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Earn9ja <onboarding@resend.dev>",
      to: ["your-email@example.com"], // Replace with your email
      subject: "Test Email from Earn9ja",
      html: "<h1>Hello!</h1><p>This is a test email from Earn9ja platform.</p>",
    });

    if (error) {
      console.error("Error:", error);
      return;
    }

    console.log("✅ Email sent successfully!");
    console.log("Email ID:", data?.id);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
  }
}

testEmail();
```

Run the test:

```bash
npx tsx src/scripts/test-email.ts
```

---

## Alternative Options

### SendGrid Setup (If you prefer SendGrid)

1. **Sign up**: https://sendgrid.com
2. **Get API key**: Settings → API Keys → Create API Key
3. **Install package**: `npm install @sendgrid/mail`
4. **Update code**:

```typescript
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (to: string, subject: string, html: string) => {
  const msg = {
    to: to,
    from: "noreply@earn9ja.site",
    subject: subject,
    html: html,
  };

  try {
    await sgMail.send(msg);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};
```

5. **Environment variables**:

```bash
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=Earn9ja <noreply@earn9ja.site>
```

### Mailgun Setup

1. **Sign up**: https://mailgun.com
2. **Get API key**: Settings → API Keys
3. **Install package**: `npm install mailgun.js form-data`
4. **Update code**:

```typescript
import formData from "form-data";
import Mailgun from "mailgun.js";

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const msg = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: "Earn9ja <noreply@earn9ja.site>",
      to: [to],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", msg);
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};
```

5. **Environment variables**:

```bash
MAILGUN_API_KEY=your_api_key_here
MAILGUN_DOMAIN=earn9ja.site
EMAIL_FROM=Earn9ja <noreply@earn9ja.site>
```

---

## Comparison Table

| Provider     | Free Tier   | Pricing | Ease of Use | Deliverability |
| ------------ | ----------- | ------- | ----------- | -------------- |
| **Resend**   | 3,000/month | $20/50k | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐     |
| **SendGrid** | 100/day     | $20/50k | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐     |
| **Mailgun**  | 5,000/3mo   | $35/50k | ⭐⭐⭐⭐    | ⭐⭐⭐⭐       |
| **Brevo**    | 300/day     | $25/20k | ⭐⭐⭐      | ⭐⭐⭐⭐       |

## Cost Estimate for Earn9ja

Assuming 1,000 users with:

- Welcome email: 1,000 emails
- Email verification: 1,000 emails
- Password reset: ~100 emails/month
- Notifications: ~500 emails/month

**Total: ~2,600 emails/month**

- **Resend**: FREE (under 3,000/month limit)
- **SendGrid**: FREE (under 100/day limit)
- **Mailgun**: $2.08/month (after free trial)
- **Brevo**: FREE (under 300/day limit)

## Recommended Setup for Earn9ja

1. **Start with Resend** (free tier)
2. **Verify your domain** (earn9ja.site)
3. **Monitor usage** in Resend dashboard
4. **Upgrade when needed** (after 3,000 emails/month)

## Next Steps

1. ✅ Sign up for Resend
2. ✅ Get API key
3. ✅ Update backend code
4. ✅ Test email sending
5. ✅ Verify domain (optional)
6. ✅ Deploy to production

## Support

- **Resend Docs**: https://resend.com/docs
- **Resend Discord**: https://resend.com/discord
- **SendGrid Docs**: https://docs.sendgrid.com
- **Mailgun Docs**: https://documentation.mailgun.com

---

**Created for Earn9ja Platform**  
Last Updated: December 5, 2024
