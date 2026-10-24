const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pool = req.app.locals.pool;
    const w = await pool.query('SELECT balance,updated_at FROM demo_wallets WHERE user_id=$1', [req.user.id]);
    const l = await pool.query('SELECT entry_type,amount,balance_after,note,created_at FROM demo_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 30', [req.user.id]);
    res.json({ mode: 'virtual demo funds only', wallet: w.rows[0], ledger: l.rows });
  } catch (e) { next(e); }
});

// Demo credit is a simulator-only action, capped and rate-limited. It is not a payment.
router.post('/demo-credit', requireAuth, async (req, res, next) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 100 || amount > 5000 || Math.round(amount * 100) !== amount * 100)
    return res.status(400).json({ error: 'Demo credit must be between 100 and 5,000 virtual units.' });
  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('SELECT balance FROM demo_wallets WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    const next = Number(w.rows[0].balance) + amount;
    await client.query('UPDATE demo_wallets SET balance=$1,updated_at=NOW() WHERE user_id=$2', [next, req.user.id]);
    await client.query(
      "INSERT INTO demo_ledger(user_id,entry_type,amount,balance_after,reference,note) VALUES($1,'demo_credit',$2,$3,$4,'User requested virtual demo top-up')",
      [req.user.id, amount, next, `demo-${req.user.id}-${require('crypto').randomUUID()}`]
    );
    await client.query('COMMIT');
    res.json({ balance: next, message: 'Virtual demo funds added. No money was charged.' });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
module.exports = router;
