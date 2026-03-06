ALTER TABLE public.review_log
ADD COLUMN IF NOT EXISTS decision_type TEXT,
ADD COLUMN IF NOT EXISTS action_type TEXT,
ADD COLUMN IF NOT EXISTS defer_reason TEXT;

ALTER TABLE public.review_log
DROP CONSTRAINT IF EXISTS review_log_decision_type_check;

ALTER TABLE public.review_log
ADD CONSTRAINT review_log_decision_type_check
CHECK (decision_type IS NULL OR decision_type IN ('ARCHIVE', 'ACT', 'DEFER'));

ALTER TABLE public.review_log
DROP CONSTRAINT IF EXISTS review_log_action_type_check;

ALTER TABLE public.review_log
ADD CONSTRAINT review_log_action_type_check
CHECK (action_type IS NULL OR action_type IN ('EXPERIMENT', 'SHARE', 'TODO'));

ALTER TABLE public.review_log
DROP CONSTRAINT IF EXISTS review_log_defer_reason_check;

ALTER TABLE public.review_log
ADD CONSTRAINT review_log_defer_reason_check
CHECK (defer_reason IS NULL OR defer_reason IN ('NEED_INFO', 'LOW_CONFIDENCE', 'NO_TIME'));
