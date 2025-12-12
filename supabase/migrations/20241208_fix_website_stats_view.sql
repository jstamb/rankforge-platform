-- Fix website_stats view to accurately count services and locations
-- Priority: 1) Actual generated pages (location_pages, service_pages tables)
--           2) Business config arrays (target_cities, services) as fallback
-- This ensures counts reflect actual generated content after website generation

DROP VIEW IF EXISTS public.website_stats;

CREATE OR REPLACE VIEW public.website_stats AS
SELECT
  w.id,
  w.user_id,
  w.business_id,
  w.name,
  w.slug,
  w.domain,
  w.status,
  w.template,
  w.github_repo_url,
  w.cloud_run_service_url,
  w.last_deployed_at,
  w.created_at,
  -- Count locations: prefer actual generated pages, fallback to business config
  CASE
    WHEN COUNT(DISTINCT lp.id) > 0 THEN COUNT(DISTINCT lp.id)
    ELSE COALESCE(jsonb_array_length(b.target_cities), 0)
  END AS location_count,
  -- Count services: prefer actual generated pages, fallback to business config
  CASE
    WHEN COUNT(DISTINCT sp.id) > 0 THEN COUNT(DISTINCT sp.id)
    ELSE COALESCE(jsonb_array_length(b.services), 0)
  END AS service_count,
  b.business_name,
  b.business_type,
  b.services AS business_services,
  b.target_cities AS business_target_cities
FROM public.websites w
LEFT JOIN public.location_pages lp ON w.id = lp.website_id
LEFT JOIN public.service_pages sp ON w.id = sp.website_id
LEFT JOIN public.businesses b ON w.business_id = b.id
GROUP BY w.id, w.business_id, b.business_name, b.business_type, b.services, b.target_cities;

-- Grant access to authenticated users and service role
GRANT SELECT ON public.website_stats TO authenticated;
GRANT SELECT ON public.website_stats TO service_role;
