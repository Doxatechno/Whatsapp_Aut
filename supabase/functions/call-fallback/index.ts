import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (_req) => {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Thank you for calling Excel Fit India. We are currently unavailable. Please WhatsApp us at 9 4 8 8 0 0 5 4 5 4. Have a great day!</Speak>
  <Hangup/>
</Response>`, {
    headers: { "Content-Type": "text/xml" }
  })
})