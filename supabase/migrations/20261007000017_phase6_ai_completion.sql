-- Phase 6: AI/RAG Completion ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Verification, Analytics, and Multi-Role Chats

-- Table: verification_gate_events
-- Tracks verification gate results for monitoring and improvement
CREATE TABLE public.verification_gate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  query_length INT NOT NULL,
  source_count INT NOT NULL,
  passed BOOLEAN NOT NULL,
  issue_count INT NOT NULL DEFAULT 0,
  tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_gate_events_user_building ON public.verification_gate_events(user_id, building_id);
CREATE INDEX idx_verification_gate_events_created ON public.verification_gate_events(created_at DESC);
CREATE INDEX idx_verification_gate_events_passed ON public.verification_gate_events(passed);

-- Table: citation_usage
-- Tracks citation patterns and validation results
CREATE TABLE public.citation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  response_id UUID NOT NULL,
  query_length INT NOT NULL,
  used_sources INT NOT NULL,
  total_sources_available INT NOT NULL,
  citation_count INT NOT NULL,
  by_kind JSONB NOT NULL DEFAULT '{}',
  valid BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citation_usage_building ON public.citation_usage(building_id);
CREATE INDEX idx_citation_usage_user ON public.citation_usage(user_id);
CREATE INDEX idx_citation_usage_valid ON public.citation_usage(valid);
CREATE INDEX idx_citation_usage_created ON public.citation_usage(created_at DESC);

-- Table: security_events
-- Audit trail for security-relevant events (attempted cross-building access, adversarial prompts, etc.)
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  event_type VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_user_building ON public.security_events(user_id, building_id);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);

-- Table: query_expansion_cache
-- Cache query expansions to avoid repeated calls to Haiku
CREATE TABLE public.query_expansion_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_query TEXT NOT NULL,
  variants TEXT[] NOT NULL,
  extracted_refs TEXT[] NOT NULL DEFAULT '{}',
  hit_count INT NOT NULL DEFAULT 1,
  last_used TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_query_expansion_cache_query ON public.query_expansion_cache(
  LOWER(TRIM(original_query))
);

-- Table: intent_classifications
-- Store intent classifications for learning and improvement
CREATE TABLE public.intent_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  intent VARCHAR(50) NOT NULL,
  confidence NUMERIC(3, 2) NOT NULL,
  correct BOOLEAN, -- Set by admin review
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_intent_classifications_intent ON public.intent_classifications(intent);
CREATE INDEX idx_intent_classifications_confidence ON public.intent_classifications(confidence);
CREATE INDEX idx_intent_classifications_created ON public.intent_classifications(created_at DESC);

-- Extend existing tables

-- Add to resident_audit_log if not exists
ALTER TABLE public.resident_audit_log ADD COLUMN IF NOT EXISTS query_text TEXT;
ALTER TABLE public.resident_audit_log ADD COLUMN IF NOT EXISTS response_length INT;
ALTER TABLE public.resident_audit_log ADD COLUMN IF NOT EXISTS gate_passed BOOLEAN;

-- Add verification and gate tracking to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS verification_issues TEXT[];

-- Enable RLS for new tables
ALTER TABLE public.verification_gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_expansion_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_classifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- verification_gate_events: Users can see their own events
CREATE POLICY verification_gate_events_user_access ON public.verification_gate_events
  USING (auth.uid() = user_id);

-- citation_usage: Users can see their own, staff can see building data
CREATE POLICY citation_usage_user_access ON public.citation_usage
  USING (
    auth.uid() = user_id
    OR (auth.uid() IN (
      SELECT user_id FROM public.building_members
      WHERE building_id = citation_usage.building_id
        AND role = 'building_manager'
        AND status = 'active'
    ))
  );

-- security_events: Platform admins and building staff can view
CREATE POLICY security_events_admin_access ON public.security_events
  USING (
    auth.uid() IN (SELECT user_id FROM public.org_members WHERE role = 'platform_admin' AND status = 'active')
    OR (auth.uid() IN (
      SELECT user_id FROM public.building_members
      WHERE building_id = security_events.building_id
        AND role = 'building_manager'
        AND status = 'active'
    ))
  );

-- query_expansion_cache: Anyone can read (public cache)
CREATE POLICY query_expansion_cache_read ON public.query_expansion_cache
  FOR SELECT USING (true);

-- intent_classifications: Public read, admin write
CREATE POLICY intent_classifications_read ON public.intent_classifications
  FOR SELECT USING (true);

CREATE POLICY intent_classifications_admin_write ON public.intent_classifications
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.org_members WHERE role = 'platform_admin' AND status = 'active')
  );

CREATE POLICY intent_classifications_admin_update ON public.intent_classifications
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.org_members WHERE role = 'platform_admin' AND status = 'active')
  );

-- Materialized view for verification gate metrics (by building, daily)
CREATE MATERIALIZED VIEW verification_metrics_daily AS
SELECT
  building_id,
  DATE(created_at) as date,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN passed THEN 1 END) as passed_queries,
  ROUND(
    COUNT(CASE WHEN passed THEN 1 END)::NUMERIC / COUNT(*) * 100, 2
  ) as pass_rate,
  AVG(tokens) as avg_tokens,
  SUM(tokens) as total_tokens
FROM public.verification_gate_events
GROUP BY building_id, DATE(created_at);

CREATE INDEX idx_verification_metrics_daily_building ON verification_metrics_daily(building_id);
CREATE INDEX idx_verification_metrics_daily_date ON verification_metrics_daily(date DESC);

-- Materialized view for citation quality metrics
CREATE MATERIALIZED VIEW citation_quality_metrics AS
SELECT
  building_id,
  DATE(created_at) as date,
  COUNT(*) as total_responses,
  COUNT(CASE WHEN valid THEN 1 END) as valid_citations,
  ROUND(
    COUNT(CASE WHEN valid THEN 1 END)::NUMERIC / COUNT(*) * 100, 2
  ) as citation_accuracy,
  AVG(citation_count) as avg_citations_per_response
FROM public.citation_usage
GROUP BY building_id, DATE(created_at);

CREATE INDEX idx_citation_quality_building ON citation_quality_metrics(building_id);
CREATE INDEX idx_citation_quality_date ON citation_quality_metrics(date DESC);
