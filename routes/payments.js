'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const router = express.Router();

function getUser(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token || !process.env.JWT_SECRET) return null;

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

function isProduction() {
    return (process.env.SAFEPAY_ENV || 'sandbox').toLowerCase() === 'production';
}

function apiBaseUrl() {
    return isProduction()
        ? 'https://api.getsafepay.com'
        : 'https://sandbox.api.getsafepay.com';
}

// Checkout host for the v3 embedded checkout.
// Sandbox host is confirmed; verify the production host in Safepay docs before go-live.
function checkoutHost() {
    return isProduction()
        ? 'https://getsafepay.com'
        : 'https://sandbox.api.getsafepay.com';
}

function safepayConfigured() {
    return Boolean(
        process.env.SAFEPAY_API_KEY &&
        process.env.SAFEPAY_SECRET_KEY &&
        process.env.SAFEPAY_WEBHOOK_SECRET
    );
}

async function readResponse(response) {
    const raw = await response.text();

    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return { message: raw };
    }
}

async function createSafepayTracker({ amountMinor, appointment }) {
    const response = await fetch(`${apiBaseUrl()}/order/payments/v3/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-SFPY-MERCHANT-SECRET': process.env.SAFEPAY_SECRET_KEY
        },
        body: JSON.stringify({
            merchant_api_key: process.env.SAFEPAY_API_KEY,
            intent: 'CYBERSOURCE',
            mode: 'payment',
            currency: 'PKR',
            amount: amountMinor,
            entry_mode: 'raw',
            metadata: {
                order_id: String(appointment._id)
            }
        })
    });

    const payload = await readResponse(response);

    if (
        !response.ok ||
        payload.status?.message === 'failure' ||
        payload.status?.message === 'fail'
    ) {
        console.error('Safepay tracker error:', {
            httpStatus: response.status,
            message: payload.status?.message || payload.message,
            errors: payload.status?.errors
        });

        throw new Error('Safepay tracker creation failed');
    }

    const data = payload.data || payload;
    const tracker =
        data.token ||
        data.tracker?.token ||
        data.tracker ||
        data.beacon;

    if (typeof tracker !== 'string' || !tracker) {
        throw new Error('Safepay response did not contain a tracker token');
    }

    return tracker;
}

async function createSafepayAuthToken() {
    const response = await fetch(`${apiBaseUrl()}/client/passport/v1/token`, {
        method: 'POST',
        headers: {
            'X-SFPY-MERCHANT-SECRET': process.env.SAFEPAY_SECRET_KEY,
            Accept: 'application/json'
        }
    });

    const payload = await readResponse(response);

    if (!response.ok) {
        console.error('Safepay authentication error:', {
            httpStatus: response.status,
            message: payload.status?.message || payload.message
        });

        throw new Error('Safepay authentication token creation failed');
    }

    const data = payload.data || payload;
    const token =
        typeof data === 'string'
            ? data
            : data.token || data.tbt || data.access_token;

    if (typeof token !== 'string' || !token) {
        throw new Error('Safepay authentication response did not contain a token');
    }

    return token;
}

function getBaseUrl(req) {
    return (
        process.env.APP_BASE_URL ||
        `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
}

// v3 trackers must go to the /embedded/ checkout (NOT the legacy /checkout/pay?beacon=...).
function getCheckoutUrl(tracker, tbt, baseUrl) {
    const params = new URLSearchParams({
        environment: isProduction() ? 'production' : 'sandbox',
        tracker,
        tbt,
        source: 'hosted',
        // No query string here: Safepay appends its own "?tracker=..." and would corrupt it.
        redirect_url: `${baseUrl}/payment/return`,
        cancel_url: `${baseUrl}/payment/cancel`
    });

    return `${checkoutHost()}/embedded/?${params.toString()}`;
}

// Patient can pay only after the doctor accepts the appointment.
router.post('/checkout/:appointmentId', async (req, res) => {
    try {
        const decoded = getUser(req);

        if (!decoded) {
            return res.status(401).json({ success: false, message: 'Please login first' });
        }

        if (decoded.role !== 'patient') {
            return res.status(403).json({ success: false, message: 'Only patients can pay for appointments' });
        }

        if (!safepayConfigured()) {
            return res.status(503).json({ success: false, message: 'Safepay environment variables are missing' });
        }

        const appointment = await Appointment.findById(req.params.appointmentId);

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        if (String(appointment.patient) !== String(decoded.id)) {
            return res.status(403).json({ success: false, message: 'You cannot pay for another patient’s appointment' });
        }

        if (appointment.status !== 'accepted') {
            return res.status(400).json({ success: false, message: 'Doctor must accept the appointment first' });
        }

        if (appointment.paymentStatus === 'paid') {
            return res.status(400).json({ success: false, message: 'Appointment is already paid' });
        }

        if (!appointment.paymentDeadline || appointment.paymentDeadline <= new Date()) {
            appointment.status = 'expired';
            appointment.paymentStatus = 'expired';
            await appointment.save();

            return res.status(400).json({ success: false, message: 'Payment deadline has passed' });
        }

        const doctor = await User.findById(appointment.psychiatrist).select('consultationFee');

        if (
            !doctor ||
            !Number.isFinite(Number(doctor.consultationFee)) ||
            Number(doctor.consultationFee) <= 0
        ) {
            return res.status(400).json({ success: false, message: 'Doctor consultation fee is invalid' });
        }

        const amountMajor = Number(doctor.consultationFee);
        const amountMinor = Math.round(amountMajor * 100);

        if (amountMinor < 100) {
            return res.status(400).json({ success: false, message: 'Consultation fee must be at least PKR 1' });
        }

        const tracker = await createSafepayTracker({ amountMinor, appointment });
        const tbt = await createSafepayAuthToken();

        appointment.paymentStatus = 'pending';
        appointment.paymentAmount = amountMajor;
        appointment.paymentCurrency = 'PKR';
        appointment.safepayTrackerToken = tracker;
        appointment.safepayReferenceCode = '';

        await appointment.save();

        return res.json({
            success: true,
            checkoutUrl: getCheckoutUrl(tracker, tbt, getBaseUrl(req))
        });
    } catch (err) {
        console.error('Safepay checkout error:', err.message);

        return res.status(502).json({
            success: false,
            message: 'Could not start Safepay payment. Check server logs.'
        });
    }
});

// Mount webhook with express.raw() before express.json().
function hmacSha512Hex(secret, data) {
    return crypto.createHmac('sha512', secret).update(data).digest('hex');
}

function safeEqualHex(a, b) {
    const x = Buffer.from(String(a).trim().toLowerCase(), 'utf8');
    const y = Buffer.from(String(b).trim().toLowerCase(), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function webhookHandler(req, res) {
    console.log('Safepay webhook HIT', {
        hasSignature: Boolean(req.headers['x-sfpy-signature']),
        eventTypeHeader: req.headers['x-sfpy-event-type'],
        rawBody: Buffer.isBuffer(req.body)
    });

    const secret = process.env.SAFEPAY_WEBHOOK_SECRET;

    if (!secret) {
        return res.status(503).send('Webhook is not configured');
    }

    if (!Buffer.isBuffer(req.body)) {
        return res.status(400).send('Expected raw webhook body');
    }

    const signature = req.headers['x-sfpy-signature'];

    if (!signature) {
        console.error('Safepay webhook REJECTED: missing x-sfpy-signature header, headers:', Object.keys(req.headers));
        return res.status(400).send('Missing Safepay signature');
    }

    let event;

    try {
        event = JSON.parse(req.body.toString('utf8'));
    } catch {
        console.error('Safepay webhook REJECTED: body is not valid JSON');
        return res.status(400).send('Invalid webhook JSON');
    }

    // Safepay's docs are ambiguous about what is signed (raw body, whole payload or only data),
    // so accept an HMAC-SHA512 over any of them. All need the shared secret.
    const candidates = [req.body, JSON.stringify(event)];
    if (event && event.data !== undefined) candidates.push(JSON.stringify(event.data));

    const signatureOk = candidates.some(c => safeEqualHex(signature, hmacSha512Hex(secret, c)));

    if (!signatureOk) {
        console.error('Safepay webhook REJECTED: signature mismatch. Check SAFEPAY_WEBHOOK_SECRET matches the "shared secret" in the Safepay dashboard (Developer > Endpoints > View shared secret).');
        return res.status(400).send('Invalid webhook signature');
    }

    // TEMPORARY: remove after you have seen one real sandbox event.
    if (!isProduction()) {
        console.log('Safepay webhook event:', JSON.stringify(event, null, 2));
    }

    try {
        const eventType = String(
            event.type || event.event || req.headers['x-sfpy-event-type'] || ''
        ).toLowerCase();

        // New (Payments 2.0 / webhooks v2): type "payment.succeeded", details in event.data
        const isV2Paid = eventType === 'payment.succeeded';
        // Legacy: type "payment:created" with notification.state === "PAID"
        const legacy = event.notification || {};
        const isLegacyPaid =
            eventType === 'payment:created' &&
            String(legacy.state || '').toUpperCase() === 'PAID';

        if (!isV2Paid && !isLegacyPaid) {
            console.log('Safepay webhook ignored (not a successful payment): type =', eventType);
            return res.json({ received: true, ignored: true });
        }

        const body = isV2Paid ? (event.data || {}) : legacy;

        const rawTracker = body.tracker;
        const tracker =
            (typeof rawTracker === 'string' ? rawTracker : rawTracker?.token) ||
            event.tracker ||
            '';
        const metadata = body.metadata || event.metadata || {};

        const appointmentId =
            metadata.order_id ||
            metadata.orderId ||
            event.order_id;

        let appointment = null;

        if (tracker) {
            appointment = await Appointment.findOne({ safepayTrackerToken: String(tracker) });
        }

        if (!appointment && appointmentId) {
            appointment = await Appointment.findById(String(appointmentId));
        }

        if (!appointment) {
            console.error('Safepay webhook: appointment not found', { tracker, appointmentId });
            return res.status(404).send('Appointment not found');
        }

        if (
            appointment.safepayTrackerToken &&
            tracker &&
            String(appointment.safepayTrackerToken) !== String(tracker)
        ) {
            console.error('Safepay webhook: tracker mismatch', {
                stored: appointment.safepayTrackerToken,
                received: tracker
            });
            return res.status(400).send('Tracker mismatch');
        }

        if (
            appointment.status !== 'accepted' ||
            !appointment.paymentDeadline ||
            appointment.paymentDeadline <= new Date()
        ) {
            console.warn('Safepay webhook: payment received but appointment is not payable (status/deadline). Check manually / refund if needed:', {
                appointment: String(appointment._id),
                status: appointment.status,
                paymentDeadline: appointment.paymentDeadline
            });
            return res.json({ received: true, ignored: true });
        }

        // Amount may arrive in rupees or in paisa: accept either.
        if (body.amount != null && appointment.paymentAmount != null) {
            const amount = Number(body.amount);
            const major = Number(appointment.paymentAmount);
            const matches =
                Number.isFinite(amount) &&
                (Math.abs(amount - major) <= 0.01 || Math.abs(amount - major * 100) <= 1);

            if (!matches) {
                console.error('Safepay amount mismatch:', { got: amount, expectedMajor: major });
                return res.status(400).send('Payment amount mismatch');
            }
        }

        if (body.currency && String(body.currency).toUpperCase() !== 'PKR') {
            console.error('Safepay currency mismatch:', body.currency);
            return res.status(400).send('Payment currency mismatch');
        }

        if (appointment.paymentStatus !== 'paid') {
            appointment.paymentStatus = 'paid';
            appointment.paymentCurrency = 'PKR';
            appointment.safepayReferenceCode = String(
                body.reference ||
                body.reference_code ||
                body.reference_number ||
                event.reference ||
                ''
            );
            appointment.paidAt = new Date();

            await appointment.save();
            console.log('Safepay webhook: appointment marked PAID', String(appointment._id));
        }

        return res.json({ received: true });
    } catch (err) {
        console.error('Safepay webhook processing error:', err.message);
        return res.status(500).send('Webhook processing failed');
    }
}

module.exports = {
    router,
    webhookHandler
};