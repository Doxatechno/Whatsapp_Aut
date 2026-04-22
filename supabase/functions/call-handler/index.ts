import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml" }
  })
}

async function getAIReply(customerSpeech: string, customerName: string, phone: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `You are Priya, a friendly sales executive at Excel Fit India, a fitness equipment company.
You are on a phone call with ${customerName}.

Our products:
- Treadmills from ₹14,400 (i20 Treadmill top seller at ₹29,500)
- Exercise Bikes from ₹28,200
- Home Gym from ₹20,950
- Ellipticals from ₹88,500
- Accessories from ₹325

Rules:
- Keep replies SHORT — max 2 sentences. This is a phone call.
- Speak naturally like a human, not a robot
- If they show interest, ask for their city for delivery
- If they want to buy, tell them to WhatsApp +919488005454
- Reply in same language as customer (Tamil or English)
- Never make up prices

Customer just said: "${customerSpeech}"

Reply naturally in 1-2 sentences only:`
      }]
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}

serve(async (req) => {
  try {
    const formData = await req.formData()
    const callUUID = formData.get("CallUUID") as string
    const direction = formData.get("Direction") as string
    const from = formData.get("From") as string
    const digits = formData.get("Digits") as string
    const speech = formData.get("SpeechResult") as string
    const hangupCause = formData.get("HangupCause") as string

    console.log("Call event:", { callUUID, direction, from, digits, speech, hangupCause })

    // Handle hangup
    if (hangupCause) {
      console.log("Call ended:", hangupCause)
      await supabase.from("calls")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("lead_phone", from)
      return new Response("OK", { status: 200 })
    }

    // Get customer name from leads table
    const { data: lead } = await supabase
      .from("leads")
      .select("name")
      .eq("phone", from.replace("+", ""))
      .single()

    const customerName = lead?.name ?? "there"

    // If speech detected — AI responds
    if (speech) {
      console.log("Customer said:", speech)

      // Save to messages
      await supabase.from("messages").insert({
        lead_phone: from.replace("+", ""),
        direction: "inbound",
        body: `[Call] ${speech}`
      })

      const aiReply = await getAIReply(speech, customerName, from)
      console.log("AI reply:", aiReply)

      // Save AI reply
      await supabase.from("messages").insert({
        lead_phone: from.replace("+", ""),
        direction: "outbound",
        body: `[Call] ${aiReply}`
      })

      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="2" action="https://xpngazwavohqmhfyldct.supabase.co/functions/v1/call-handler" method="POST">
    <Speak voice="Polly.Aditi">${aiReply}</Speak>
  </Gather>
  <Speak voice="Polly.Aditi">I didn't catch that. Thank you for calling Excel Fit India. Have a great day!</Speak>
  <Hangup/>
</Response>`)
    }

    // Initial greeting when call connects
    const greeting = `Hello ${customerName}! This is Priya calling from Excel Fit India. We noticed your interest in our fitness equipment. I'm here to help you find the perfect product. Are you looking for a treadmill, exercise bike, or home gym setup?`

    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="8" speechTimeout="3" action="https://xpngazwavohqmhfyldct.supabase.co/functions/v1/call-handler" method="POST">
    <Speak voice="Polly.Aditi">${greeting}</Speak>
  </Gather>
  <Speak voice="Polly.Aditi">Thank you for your interest in Excel Fit India. Please WhatsApp us at 9 4 8 8 0 0 5 4 5 4 for more details. Have a great day!</Speak>
  <Hangup/>
</Response>`)

  } catch (error) {
    console.log("Error:", error)
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Thank you for calling Excel Fit India. Please call us back shortly.</Speak>
  <Hangup/>
</Response>`)
  }
})