const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(100),
  displayName: z.string().trim().min(2).max(50)
});
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(100) });

function setSession(res, user) {
  const token = jwt.sign({ id: String(user.id), email: user.email }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.cookie('session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000, path: '/'
  });
}
router.post('/register', async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Use a valid email, display name, and password of at least 10 characters.' });
  const pool = req.app.locals.pool;
  try {
    const email = parsed.data.email.toLowerCase();
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name',
        [email, hash, parsed.data.displayName]
      );
      const user = result.rows[0];
      const start = Number(process.env.DEMO_STARTING_BALANCE || 10000);
      await client.query('INSERT INTO demo_wallets(user_id,balance) VALUES($1,$2)', [user.id, start]);
      await client.query(
        "INSERT INTO demo_ledger(user_id,entry_type,amount,balance_after,reference,note) VALUES($1,'demo_credit',$2,$2,$3,'Initial virtual demo funds')",
        [user.id, start, `welcome-${user.id}`]
      );
      await client.query('COMMIT');
      setSession(res, user);
      res.status(201).json({ user, mode: 'demo-only' });
    } catch (e) { await client.query('ROLLBACK'); if (e.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' }); throw e; }
    finally { client.release(); }
  } catch (e) { next(e); }
});
router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  try {
    const result = await req.app.locals.pool.query('SELECT id,email,display_name,password_hash FROM users WHERE email=$1', [parsed.data.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    setSession(res, user);
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name }, mode: 'demo-only' });
  } catch (e) { next(e); }
});
router.post('/logout', (_req, res) => { res.clearCookie('session', { path: '/' }); res.json({ ok: true }); });
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const r = await req.app.locals.pool.query('SELECT id,email,display_name,created_at FROM users WHERE id=$1', [req.user.id]);
    if (!r.rowCount) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user: r.rows[0], mode: 'demo-only' });
  } catch (e) { next(e); }
});
module.exports = router;
