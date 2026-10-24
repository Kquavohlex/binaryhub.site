const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// SAFETY: payment routes remain disabled by default. This starter does not claim to
// process real payments. Configure Daraja, public HTTPS callbacks, verification,
// reconciliation, and B2C approval before enabling any live integration.
router.get('/status', (_req, res) => {
  res.json({
    enabled: process.env.MPESA_ENABLED === 'true',
    configured: Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_URL),
    message: 'M-Pesa integration is a scaffold only. Real deposits/withdrawals are not implemented.'
  });
});
router.post('/deposit', requireAuth, (_req, res) => {
  if (process.env.MPESA_ENABLED !== 'true') return res.status(503).json({ error: 'M-Pesa is disabled. Configure and test Safaricom Daraja first.' });
  return res.status(501).json({ error: 'STK Push integration is not implemented in this starter. No payment was requested.' });
});
router.post('/withdraw', requireAuth, (_req, res) => {
  if (process.env.MPESA_ENABLED !== 'true') return res.status(503).json({ error: 'M-Pesa is disabled. Configure and test Safaricom Daraja first.' });
  return res.status(501).json({ error: 'B2C withdrawal integration is not implemented in this starter. No payment was sent.' });
});
router.post('/callback', (_req, res) => {
  // Do not trust a callback merely because it reached this endpoint. Implement
  // provider verification, idempotency, amount/phone checks, and durable reconciliation.
  res.status(501).json({ ResultCode: 1, ResultDesc: 'Callback processing not configured' });
});
module.exports = router;
