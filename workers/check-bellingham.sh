#!/bin/bash
SUPABASE_URL="https://iqcbuqmhqljuwzpvsqmr.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxY2J1cW1ocWxqdXd6cHZzcW1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk2NzQ2MCwiZXhwIjoyMDgwNTQzNDYwfQ.bwTgj0Xrvg8v4aFjS7eQIm0nwxXOarPEYdLqsejvHhk"

echo "=== Checking websites with status=generating ==="
curl -s "${SUPABASE_URL}/rest/v1/websites?status=eq.generating&select=id,slug,status" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq .

echo ""
echo "=== Checking all recent jobs ==="
curl -s "${SUPABASE_URL}/rest/v1/generation_jobs?select=id,website_id,job_type,status,current_step,created_at,error_details&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq .
