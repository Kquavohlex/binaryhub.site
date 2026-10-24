CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Virtual demo balances only. Never treat these balances as real money.
CREATE TABLE IF NOT EXISTS demo_wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 10000.00 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('demo_credit','trade_stake','trade_payout','admin_adjustment')),
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  reference TEXT NOT NULL UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_trades (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up','down')),
  stake NUMERIC(14,2) NOT NULL CHECK (stake > 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 5 AND 300),
  entry_price NUMERIC(18,8) NOT NULL,
  exit_price NUMERIC(18,8),
  result TEXT NOT NULL CHECK (result IN ('pending','win','loss','draw')),
  payout NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- M-Pesa payment records are separate from the demo wallet.
-- Real deposits must NEVER automatically become virtual trading funds.
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('stk_deposit','b2c_withdrawal')),
  phone TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','pending','success','failed','cancelled')),
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  conversation_id TEXT,
  mpesa_receipt TEXT,
  provider_result_code TEXT,
  provider_result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_created ON demo_trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON demo_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_user_created ON mpesa_transactions(user_id, created_at DESC);
