#!/bin/bash
SUPABASE_URL="https://iqcbuqmhqljuwzpvsqmr.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxY2J1cW1ocWxqdXd6cHZzcW1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk2NzQ2MCwiZXhwIjoyMDgwNTQzNDYwfQ.bwTgj0Xrvg8v4aFjS7eQIm0nwxXOarPEYdLqsejvHhk"

echo "Updating website status to 'deployed'..."
curl -s -X PATCH "${SUPABASE_URL}/rest/v1/websites?id=eq.72ccda21-44a5-43e9-a1d8-f41266a66b08" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status": "deployed"}'

echo ""
echo "Done. Verifying..."
curl -s "${SUPABASE_URL}/rest/v1/websites?id=eq.72ccda21-44a5-43e9-a1d8-f41266a66b08&select=id,slug,status" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq .
