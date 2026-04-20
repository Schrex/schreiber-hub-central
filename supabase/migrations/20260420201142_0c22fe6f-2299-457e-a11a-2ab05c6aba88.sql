
-- =========================================
-- PERFORMANCE REVIEWS
-- =========================================
CREATE TYPE public.performance_review_status AS ENUM ('draft', 'submitted', 'acknowledged');

CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_user_id UUID NOT NULL,
  employee_name TEXT,
  reviewer_user_id UUID,
  reviewer_name TEXT,
  review_period_start DATE,
  review_period_end DATE,
  review_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  quality_of_work INTEGER CHECK (quality_of_work BETWEEN 1 AND 5),
  productivity INTEGER CHECK (productivity BETWEEN 1 AND 5),
  safety INTEGER CHECK (safety BETWEEN 1 AND 5),
  teamwork INTEGER CHECK (teamwork BETWEEN 1 AND 5),
  attendance INTEGER CHECK (attendance BETWEEN 1 AND 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals TEXT,
  comments TEXT,
  employee_acknowledgment TEXT,
  acknowledged_at TIMESTAMPTZ,
  status public.performance_review_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own submitted reviews"
ON public.performance_reviews FOR SELECT TO authenticated
USING (auth.uid() = employee_user_id AND status IN ('submitted','acknowledged'));

CREATE POLICY "Office admin view all reviews"
ON public.performance_reviews FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin insert reviews"
ON public.performance_reviews FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update reviews"
ON public.performance_reviews FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees acknowledge own reviews"
ON public.performance_reviews FOR UPDATE TO authenticated
USING (auth.uid() = employee_user_id AND status = 'submitted');

CREATE POLICY "Office admin delete reviews"
ON public.performance_reviews FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_performance_reviews_updated_at
BEFORE UPDATE ON public.performance_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_perf_reviews_employee ON public.performance_reviews(employee_user_id);
CREATE INDEX idx_perf_reviews_date ON public.performance_reviews(review_date DESC);

-- =========================================
-- EMPLOYEE HANDBOOK
-- =========================================
CREATE TABLE public.handbook_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  version TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.handbook_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view handbook"
ON public.handbook_documents FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Office admin insert handbook"
ON public.handbook_documents FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update handbook"
ON public.handbook_documents FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete handbook"
ON public.handbook_documents FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_handbook_documents_updated_at
BEFORE UPDATE ON public.handbook_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- STORAGE BUCKET FOR HANDBOOK PDFs
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('handbook', 'handbook', false);

CREATE POLICY "Authenticated users can view handbook files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'handbook');

CREATE POLICY "Office admin can upload handbook files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'handbook'
  AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Office admin can update handbook files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'handbook'
  AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Office admin can delete handbook files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'handbook'
  AND (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);
