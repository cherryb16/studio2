-- BigQuery Schema for Trading Data Storage
-- This schema is designed to store all SnapTrade data for analytical queries

-- Raw trading data from SnapTrade API
CREATE TABLE IF NOT EXISTS `trading_data.raw_trades` (
  -- Trade identification
  trade_id STRING NOT NULL,
  account_id STRING NOT NULL,
  user_id STRING NOT NULL,
  
  -- Trade basic info
  symbol STRING,
  instrument STRING,
  action STRING, -- BUY, SELL, OPTIONEXPIRATION, etc.
  position STRING, -- long, short, close
  units NUMERIC,
  price NUMERIC,
  total_value NUMERIC,
  fee NUMERIC,
  currency STRING,
  
  -- Dates
  trade_date DATE,
  settlement_date DATE,
  executed_at TIMESTAMP,
  
  -- Option details (nullable for non-options)
  is_option BOOLEAN,
  option_underlying STRING,
  option_type STRING, -- CALL, PUT
  option_strike NUMERIC,
  option_expiration DATE,
  
  -- Realized P&L for closed positions
  entry_price NUMERIC,
  exit_price NUMERIC,
  realized_pnl NUMERIC,
  holding_period INTEGER,
  trade_status STRING, -- open, closed, partial, expired, assigned, exercised
  
  -- Raw SnapTrade response for reference
  raw_snaptrade_data JSON,
  
  -- Metadata
  data_source STRING DEFAULT 'snaptrade',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) 
PARTITION BY trade_date
CLUSTER BY user_id, account_id, symbol;

-- Account holdings snapshots (daily snapshots)
CREATE TABLE IF NOT EXISTS `trading_data.holdings_snapshots` (
  -- Snapshot identification
  snapshot_id STRING NOT NULL,
  user_id STRING NOT NULL,
  account_id STRING NOT NULL,
  snapshot_date DATE NOT NULL,
  snapshot_timestamp TIMESTAMP NOT NULL,
  
  -- Account balances
  total_balance NUMERIC,
  cash_balance NUMERIC,
  buying_power NUMERIC,
  
  -- Position data
  positions JSON, -- Array of position objects
  option_positions JSON, -- Array of option position objects
  
  -- Calculated metrics
  total_unrealized_pnl NUMERIC,
  equities_balance NUMERIC,
  options_balance NUMERIC,
  crypto_balance NUMERIC,
  other_balance NUMERIC,
  
  -- Raw SnapTrade response
  raw_holdings_data JSON,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY snapshot_date
CLUSTER BY user_id, account_id;

-- Calculated portfolio analytics (daily aggregations)
CREATE TABLE IF NOT EXISTS `trading_data.portfolio_analytics` (
  -- Identification
  analytics_id STRING NOT NULL,
  user_id STRING NOT NULL,
  account_id STRING,
  calculation_date DATE NOT NULL,
  calculation_timestamp TIMESTAMP NOT NULL,
  
  -- Basic metrics
  total_portfolio_value NUMERIC,
  total_cash NUMERIC,
  total_equities NUMERIC,
  total_options NUMERIC,
  total_crypto NUMERIC,
  total_unrealized_pnl NUMERIC,
  total_realized_pnl NUMERIC,
  
  -- Performance metrics
  total_return_percentage NUMERIC,
  volatility NUMERIC,
  sharpe_ratio NUMERIC,
  win_rate NUMERIC,
  profit_factor NUMERIC,
  
  -- Position metrics
  position_count INTEGER,
  top_position_concentration NUMERIC,
  top5_concentration NUMERIC,
  top10_concentration NUMERIC,
  
  -- Risk metrics
  risk_score NUMERIC,
  diversification_score NUMERIC,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY calculation_date
CLUSTER BY user_id, account_id;

-- Trade statistics (aggregated by various periods)
CREATE TABLE IF NOT EXISTS `trading_data.trade_statistics` (
  -- Identification
  stats_id STRING NOT NULL,
  user_id STRING NOT NULL,
  account_id STRING,
  period_type STRING, -- day, week, month, year, all
  period_start DATE,
  period_end DATE,
  calculation_timestamp TIMESTAMP NOT NULL,
  
  -- Trade counts
  total_trades INTEGER,
  closed_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  
  -- P&L metrics
  total_realized_pnl NUMERIC,
  total_fees NUMERIC,
  avg_win NUMERIC,
  avg_loss NUMERIC,
  largest_win NUMERIC,
  largest_loss NUMERIC,
  
  -- Performance ratios
  win_rate NUMERIC,
  profit_factor NUMERIC,
  
  -- Most traded symbols
  most_traded_symbols JSON,
  trades_by_day JSON,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY period_start
CLUSTER BY user_id, account_id, period_type;

-- Risk analysis results
CREATE TABLE IF NOT EXISTS `trading_data.risk_analysis` (
  -- Identification
  analysis_id STRING NOT NULL,
  user_id STRING NOT NULL,
  account_id STRING,
  analysis_date DATE NOT NULL,
  analysis_timestamp TIMESTAMP NOT NULL,
  
  -- Position sizing analysis
  risk_tolerance STRING,
  position_violations JSON,
  risk_score NUMERIC,
  diversification_score NUMERIC,
  
  -- Tax analysis
  tax_loss_opportunities JSON,
  tax_gain_positions JSON,
  harvestable_amount NUMERIC,
  
  -- Sector allocation
  sector_allocation JSON,
  
  -- Correlation analysis
  average_correlation NUMERIC,
  high_correlation_pairs JSON,
  
  -- ESG analysis
  esg_scores JSON,
  
  -- Action items
  risk_action_items JSON,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY analysis_date
CLUSTER BY user_id, account_id;

-- Performance attribution analysis
CREATE TABLE IF NOT EXISTS `trading_data.performance_attribution` (
  -- Identification
  attribution_id STRING NOT NULL,
  user_id STRING NOT NULL,
  account_id STRING,
  analysis_date DATE NOT NULL,
  
  -- Attribution data
  top_contributors JSON,
  top_detractors JSON,
  sector_contributions JSON,
  position_contributions JSON,
  
  -- Overall metrics
  total_return NUMERIC,
  concentration_risk NUMERIC,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY analysis_date
CLUSTER BY user_id, account_id;