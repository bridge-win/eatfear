-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notification_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock')),
  threshold_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_symbol, asset_type)
);

-- Alert history table
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock')),
  trigger_price DECIMAL(20,8),
  drop_percentage DECIMAL(5,2) NOT NULL,
  alert_condition TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advanced alert conditions table
CREATE TABLE IF NOT EXISTS public.alert_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  asset_symbol TEXT,
  asset_type TEXT CHECK (asset_type IN ('crypto', 'stock')),
  conditions JSONB NOT NULL,
  logic_operator TEXT DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_conditions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for alert_history
CREATE POLICY "Users can view their own alert history"
  ON public.alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert history"
  ON public.alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for alert_conditions
CREATE POLICY "Users can view their own alert conditions"
  ON public.alert_conditions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert conditions"
  ON public.alert_conditions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert conditions"
  ON public.alert_conditions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert conditions"
  ON public.alert_conditions FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_asset ON public.subscriptions(asset_symbol, asset_type);
CREATE INDEX idx_alert_history_user_id ON public.alert_history(user_id);
CREATE INDEX idx_alert_history_sent_at ON public.alert_history(sent_at);
CREATE INDEX idx_alert_conditions_user_id ON public.alert_conditions(user_id);
