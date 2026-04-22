#!/bin/bash
echo "🚀 Redeploying all edge functions..."
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy vapi-webhook --no-verify-jwt
supabase functions deploy send-message --no-verify-jwt
supabase functions deploy follow-up-sender --no-verify-jwt
supabase functions deploy trigger-kate-call --no-verify-jwt
echo "✅ All functions deployed!"
