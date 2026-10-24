const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { z } = require('zod');

const tradeSchema = z.object({
  asset: z.enum(['EUR/USD','GBP/USD','USD/JPY','BTC/USD','ETH/USD']),
  direction: z.enum(['up','down']),
  stake: z.number().min(10).max(5000),
  durationSeconds: z.number().int().min(5).max(300)
});
function simulatedPrice() { return 1 + Math.random() * 0.2; }

// This simulator does not use live market data or execute real orders.
router.post('/', requireAuth, async (req, res, next) => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Check asset, direction, stake (10–5,000), and duration (5–300 seconds).' });
  const pool = req.app.locals.pool, client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await client.query('SELECT balance FROM demo_wallets WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    const balance = Number(wallet.rows[0].balance), stake = parsed.data.stake;
    if (balance < stake) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient virtual demo funds.' }); }
    const after = Math.round((balance - stake) * 100) / 100;
    const entry = simulatedPrice();
    await client.query('UPDATE demo_wallets SET balance=$1,updated_at=NOW() WHERE user_id=$2', [after, req.user.id]);
    await client.query(
      "INSERT INTO demo_ledger(user_id,entry_type,amount,balance_after,reference,note) VALUES($1,'trade_stake',$2,$3,$4,$5)",
      [req.user.id, -stake, after, `stake-${require('crypto').randomUUID()}`, `Virtual stake on ${parsed.data.asset}`]
    );
    const trade = await client.query(
      "INSERT INTO demo_trades(user_id,asset,direction,stake,duration_seconds,entry_price,result) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING *",
      [req.user.id, parsed.data.asset, parsed.data.direction, stake, parsed.data.durationSeconds, entry]
    );
    await client.query('COMMIT');
    res.status(201).json({ trade: trade.rows[0], balance: after, notice: 'Demo-only trade. The simulator settles it after the selected duration.' });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const r = await req.app.locals.pool.query('SELECT * FROM demo_trades WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.user.id]);
    res.json({ trades: r.rows });
  } catch (e) { next(e); }
});

// Settlement uses a random simulator outcome, NOT real prices. Replace with an audited engine only if appropriate.
router.post('/:id/settle', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid trade ID.' });
  const pool = req.app.locals.pool, client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tr = await client.query("SELECT * FROM demo_trades WHERE id=$1 AND user_id=$2 FOR UPDATE", [id, req.user.id]);
    if (!tr.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Trade not found.' }); }
    const trade = tr.rows[0];
    if (trade.result !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Trade already settled.' }); }
    const ageMs = Date.now() - new Date(trade.created_at).getTime();
    if (ageMs < Number(trade.duration_seconds) * 1000) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Trade duration has not elapsed.' }); }
    const outcome = Math.random() < 0.5 ? 'win' : 'loss';
    const payout = outcome === 'win' ? Math.round(Number(trade.stake) * 1.8 * 100) / 100 : 0;
    const w = await client.query('SELECT balance FROM demo_wallets WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    const balance = Math.round((Number(w.rows[0].balance) + payout) * 100) / 100;
    await client.query('UPDATE demo_wallets SET balance=$1,updated_at=NOW() WHERE user_id=$2', [balance, req.user.id]);
    if (payout > 0) await client.query(
      "INSERT INTO demo_ledger(user_id,entry_type,amount,balance_after,reference,note) VALUES($1,'trade_payout',$2,$3,$4,'Virtual demo trade payout')",
      [req.user.id, payout, balance, `payout-${require('crypto').randomUUID()}`]
    );
    const exit = simulatedPrice();
    const updated = await client.query("UPDATE demo_trades SET result=$1,payout=$2,exit_price=$3,settled_at=NOW() WHERE id=$4 RETURNING *", [outcome, payout, exit, id]);
    await client.query('COMMIT');
    res.json({ trade: updated.rows[0], balance, notice: 'Random simulated result; not connected to market prices.' });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
module.exports = router;
