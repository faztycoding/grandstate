const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3002;

const OMISE_SECRET_KEY = process.env.OMISE_SECRET_KEY || '';
const OMISE_PUBLIC_KEY = process.env.OMISE_PUBLIC_KEY || '';

// Email configuration
const nodemailer = require('nodemailer');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const transporter = EMAIL_USER && EMAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    })
    : null;

if (!transporter) {
    console.warn('⚠️ Email delivery is disabled (EMAIL_USER / EMAIL_PASS not set)');
}

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const missingPaymentEnv = [
    !OMISE_SECRET_KEY && 'OMISE_SECRET_KEY',
    !OMISE_PUBLIC_KEY && 'OMISE_PUBLIC_KEY',
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
].filter(Boolean);

const paymentConfigReady = missingPaymentEnv.length === 0;

if (!paymentConfigReady) {
    console.error(`❌ Payment service is not fully configured. Missing: ${missingPaymentEnv.join(', ')}`);
}

const omise = paymentConfigReady
    ? Omise({
        publicKey: OMISE_PUBLIC_KEY,
        secretKey: OMISE_SECRET_KEY,
    })
    : null;

const supabase = paymentConfigReady
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

function requirePaymentConfig(req, res, next) {
    if (!paymentConfigReady) {
        return res.status(503).json({
            success: false,
            error: 'Payment service is not configured',
            missing: missingPaymentEnv,
        });
    }
    next();
}

// Rate limiting
const chargeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, error: 'Too many payment requests, please try again later' } });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many webhook calls' } });

// Middleware
app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
    if (req.path === '/api/payment/webhook') {
        return next();
    }
    return jsonParser(req, res, next);
});

// Store pending charges for status checking
const pendingCharges = new Map();

// Package configurations
const PACKAGES = {
    agent: { name: 'Top Agent', durationDays: 30, maxFbSessions: 3 },
    elite: { name: 'Elite', durationDays: 30, maxFbSessions: 5 },
};

// ===========================================
// HELPER: Generate License Key (GSXXX-XXXXX-XXXXX-XXXXX)
// ===========================================
function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'GS';

    // First segment: 3 chars
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result += '-';

    // Next 3 segments: 5 chars each
    for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (j < 2) result += '-';
    }

    return result;
}

// ===========================================
// HELPER: Create License After Payment
// ===========================================
async function createLicenseForPayment(chargeId, packageId, customerEmail) {
    const pkg = PACKAGES[packageId] || PACKAGES.agent;
    const licenseKey = generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pkg.durationDays);

    try {
        // Insert license key into Supabase
        const { data, error } = await supabase
            .from('license_keys')
            .insert({
                license_key: licenseKey,
                package: packageId,
                max_devices: pkg.maxFbSessions,
                expires_at: expiresAt.toISOString(),
                is_active: true,
                owner_contact: customerEmail || null,
                note: `Auto-created from Omise charge: ${chargeId}`,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating license:', error);
            return null;
        }

        console.log(`✅ License created: ${licenseKey} for ${packageId}`);
        return { licenseKey, expiresAt, packageId };
    } catch (err) {
        console.error('Failed to create license:', err);
        return null;
    }
}

// ===========================================
// HELPER: Send License Email
// ===========================================
async function sendLicenseEmail(to, license) {
    if (!to || !to.includes('@')) {
        console.log('⚠️ No valid email provided, skipping email notification');
        return;
    }

    if (!transporter) {
        console.log('⚠️ Email transporter not configured, skipping email notification');
        return;
    }

    const htmlContent = `
    <div style="font-family: 'Sarabun', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4F46E5; margin: 0;">GrandState</h1>
            <p style="color: #666;">ขอบคุณที่ไว้วางใจเลือกใช้บริการของเรา</p>
        </div>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0; color: #374151; font-weight: bold;">License Key ของคุณคือ:</p>
            <h2 style="color: #111827; font-family: monospace; font-size: 24px; letter-spacing: 2px; background: white; padding: 15px; border-radius: 5px; border: 1px dashed #ccc; margin: 10px 0;">${license.licenseKey}</h2>
            <p style="margin: 0; font-size: 14px; color: #6B7280;">แพ็คเกจ: <span style="color: #4F46E5; font-weight: bold;">${PACKAGES[license.packageId]?.name || license.packageId}</span></p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #6B7280;">หมดอายุ: ${new Date(license.expiresAt).toLocaleDateString('th-TH')}</p>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="color: #374151;">วิธีใช้งาน:</h3>
            <ol style="color: #4B5563; line-height: 1.6;">
                <li>เปิดเว็บ GrandState (grandstate.io)</li>
                <li>ไปที่หน้าตั้งค่า (Settings)</li>
                <li>กรอก License Key ด้านบนลงในช่อง "Activate License"</li>
                <li>กดปุ่มยืนยัน</li>
            </ol>
        </div>

        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; font-size: 12px; color: #9CA3AF;">
            <p>หากมีข้อสงสัย ติดต่อเราได้ที่ Line OA: @grandstate</p>
            <p>© 2026 GrandState. All rights reserved.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: `"GrandState Team" <${EMAIL_USER}>`,
            to: to,
            subject: `🎉 License Key ของคุณมาแล้ว! - ${license.licenseKey}`,
            html: htmlContent,
        });
        console.log(`📧 Email sent to ${to}`);
    } catch (error) {
        console.error('❌ Failed to send email:', error);
    }
}

// ===========================================
// ENDPOINT: Create Charge
// ===========================================
app.post('/api/payment/charge', chargeLimiter, requirePaymentConfig, async (req, res) => {
    try {
        const { source, token, amount, currency, package: packageId, description, email } = req.body;

        // Validate package
        if (!PACKAGES[packageId]) {
            return res.status(400).json({ success: false, error: 'Invalid package' });
        }

        // Create charge with Omise
        const chargeData = {
            amount,
            currency,
            description,
            metadata: {
                package: packageId,
                email: email || '',
            },
        };

        // Use source for PromptPay, token for credit card
        if (source) {
            chargeData.source = source;
            chargeData.return_uri = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth?payment=pending`;
        } else if (token) {
            chargeData.card = token;
        }

        const charge = await omise.charges.create(chargeData);

        // Store for status checking
        pendingCharges.set(charge.id, {
            status: charge.status,
            package: packageId,
            amount,
            email: email || '',
        });

        // For PromptPay, return QR code URL
        if (source && charge.source?.scannable_code?.image?.download_uri) {
            return res.json({
                success: true,
                chargeId: charge.id,
                qrCodeUrl: charge.source.scannable_code.image.download_uri,
                status: charge.status,
            });
        }

        // For card payment, check if successful and auto-create license
        if (charge.status === 'successful') {
            const license = await createLicenseForPayment(charge.id, packageId, email);
            return res.json({
                success: true,
                chargeId: charge.id,
                status: charge.status,
                license: license,
            });
        }

        // Handle pending or failed
        return res.json({
            success: charge.status !== 'failed',
            chargeId: charge.id,
            status: charge.status,
            error: charge.failure_message,
        });

    } catch (error) {
        console.error('Charge error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Payment failed',
        });
    }
});

// ===========================================
// ENDPOINT: Check Payment Status
// ===========================================
app.get('/api/payment/status/:chargeId', requirePaymentConfig, async (req, res) => {
    try {
        const { chargeId } = req.params;
        const charge = await omise.charges.retrieve(chargeId);

        // If successful and we haven't created license yet
        if (charge.status === 'successful') {
            const stored = pendingCharges.get(chargeId);
            if (stored && !stored.licenseCreated) {
                const license = await createLicenseForPayment(
                    chargeId,
                    charge.metadata?.package || 'agent',
                    charge.metadata?.email || stored.email
                );
                if (license) {
                    stored.licenseCreated = true;
                    stored.license = license;
                }
            }
        }

        return res.json({
            chargeId: charge.id,
            status: charge.status,
            amount: charge.amount,
            package: charge.metadata?.package,
            license: pendingCharges.get(chargeId)?.license || null,
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to check status',
        });
    }
});

// ===========================================
// ENDPOINT: Webhook (with signature verification)
// ===========================================
app.post('/api/payment/webhook', webhookLimiter, express.raw({ type: 'application/json' }), requirePaymentConfig, async (req, res) => {
    try {
        // Verify webhook signature if available
        const signature = req.headers['omise-signature'];
        const payloadBuffer = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        // In production, verify the signature!
        // For now, we log a warning if no signature
        if (!signature) {
            console.warn('⚠️ Webhook received without signature - verify in production!');
        } else {
            // Verify signature using HMAC
            const expectedSignature = crypto
                .createHmac('sha256', OMISE_SECRET_KEY)
                .update(payloadBuffer)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error('❌ Invalid webhook signature!');
                return res.status(401).json({ error: 'Invalid signature' });
            }
            console.log('✅ Webhook signature verified');
        }

        const event = Buffer.isBuffer(req.body)
            ? JSON.parse(req.body.toString('utf8'))
            : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);

        if (event.key === 'charge.complete') {
            const charge = event.data;

            if (charge.status === 'successful') {
                console.log(`💳 Payment successful for charge ${charge.id}`);
                console.log(`📦 Package: ${charge.metadata?.package}`);

                // Auto-create license
                const license = await createLicenseForPayment(
                    charge.id,
                    charge.metadata?.package || 'agent',
                    charge.metadata?.email
                );

                if (license) {
                    console.log(`🔑 License created: ${license.licenseKey}`);

                    // Send email to customer with license key
                    await sendLicenseEmail(charge.metadata?.email, license);
                }
            }
        }

        return res.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Webhook handling failed' });
    }
});

// ===========================================
// ENDPOINT: Health Check
// ===========================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'payment-api',
        paymentConfigured: paymentConfigReady,
        missingConfig: missingPaymentEnv,
        timestamp: new Date().toISOString(),
    });
});

// ===========================================
// ENDPOINT: Verify License (for testing)
// ===========================================
app.get('/api/license/:key', requirePaymentConfig, async (req, res) => {
    try {
        const { key } = req.params;
        const { data, error } = await supabase
            .from('license_keys')
            .select('*')
            .eq('license_key', key.toUpperCase())
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'License not found' });
        }

        return res.json({
            valid: data.is_active && new Date(data.expires_at) > new Date(),
            license: {
                key: data.license_key,
                package: data.package,
                expiresAt: data.expires_at,
                isActive: data.is_active,
            },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`💳 Payment API running on http://localhost:${PORT}`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
