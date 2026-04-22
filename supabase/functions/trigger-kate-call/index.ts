import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { phone, name, product, city, budget, language } = await req.json()

    const vapiKey = Deno.env.get("VAPI_API_KEY")!

    const langGreetings: any = {
      tamil: `வணக்கம் ${name}, நான் Kate, Excel Fit India லிருந்து பேசுகிறேன்`,
      telugu: `నమస్కారం ${name}, నేను Kate, Excel Fit India నుండి మాట్లాడుతున్నాను`,
      kannada: `ನಮಸ್ಕಾರ ${name}, ನಾನು Kate, Excel Fit India ನಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ`,
      malayalam: `നമസ്കാരം ${name}, ഞാൻ Kate, Excel Fit India യിൽ നിന്ന് വിളിക്കുന്നു`,
      hindi: `नमस्ते ${name}, मैं Kate हूँ, Excel Fit India से बोल रही हूँ`,
      english: `Hello ${name}, I'm Kate calling from Excel Fit India`,
    }

    const firstMessage = langGreetings[language?.toLowerCase()] || langGreetings.english

    // Check calling hours IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const ist = new Date(now.getTime() + istOffset)
    const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
    const withinHours = totalMinutes >= 8 * 60 && totalMinutes <= 21 * 60 + 30

    if (!withinHours) {
      return new Response(JSON.stringify({ 
        error: "Outside calling hours", 
        message: "Calls allowed only between 8AM - 9:30PM IST" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: "feb81cc2-d5c6-43f7-9699-e5d13a332246",
        phoneNumberId: "d329e69f-4b2a-4184-84e5-5a8eb267b66e",
        customer: { 
          number: phone.replace(/\D/g, ""), 
          name 
        },
        assistantOverrides: {
          firstMessage,
          variableValues: { 
            leadName: name, 
            product, 
            city, 
            budget, 
            language 
          }
        }
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "VAPI error")

    return new Response(JSON.stringify({ success: true, callId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
