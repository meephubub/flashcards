-- Exam Planning Tables for FSRS-Integrated Study Schedules

-- Exam plans table
CREATE TABLE IF NOT EXISTS exam_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('start_today', 'with_breaks', 'start_later')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  daily_review_cap INTEGER NOT NULL DEFAULT 50,
  daily_new_cap INTEGER NOT NULL DEFAULT 20,
  estimated_minutes_per_day INTEGER NOT NULL DEFAULT 15,
  retrievability_window_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Exam plan sessions (daily study sessions)
CREATE TABLE IF NOT EXISTS exam_plan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_plan_id UUID NOT NULL REFERENCES exam_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  new_target INTEGER NOT NULL DEFAULT 0,
  review_target INTEGER NOT NULL DEFAULT 0,
  focus TEXT NOT NULL CHECK (focus IN ('learning', 'maintenance', 'retrievability')),
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_plan_id, session_date)
);

-- Push subscriptions for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, endpoint)
);

-- Review log for better FSRS statistics (optional but recommended)
CREATE TABLE IF NOT EXISTS review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
  grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 4),
  state_before INTEGER,
  state_after INTEGER,
  scheduled_days INTEGER,
  elapsed_days INTEGER,
  stability_before FLOAT,
  stability_after FLOAT,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_plans_user_id ON exam_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_plans_deck_id ON exam_plans(deck_id);
CREATE INDEX IF NOT EXISTS idx_exam_plans_status ON exam_plans(status);
CREATE INDEX IF NOT EXISTS idx_exam_plan_sessions_plan_id ON exam_plan_sessions(exam_plan_id);
CREATE INDEX IF NOT EXISTS idx_exam_plan_sessions_user_id ON exam_plan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_plan_sessions_date ON exam_plan_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_review_logs_user_id ON review_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON review_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed_at ON review_logs(reviewed_at);

-- Enable RLS
ALTER TABLE exam_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_plan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_plans
CREATE POLICY "Users can view their own exam plans"
  ON exam_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exam plans"
  ON exam_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam plans"
  ON exam_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exam plans"
  ON exam_plans FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for exam_plan_sessions
CREATE POLICY "Users can view their own exam sessions"
  ON exam_plan_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exam sessions"
  ON exam_plan_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam sessions"
  ON exam_plan_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exam sessions"
  ON exam_plan_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for review_logs
CREATE POLICY "Users can view their own review logs"
  ON review_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own review logs"
  ON review_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_exam_plans_updated_at
  BEFORE UPDATE ON exam_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_plan_sessions_updated_at
  BEFORE UPDATE ON exam_plan_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
