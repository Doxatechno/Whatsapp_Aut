import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const VOBIZ_ACCOUNT = Deno.env.get("VOBIZ_ACCOUNT")!
const VOBIZ_API_KEY = Deno.env.get("VOBIZ_API_KEY")!
const VOBIZ_NUMBER = Deno.env.get("VOBIZ_NUMBER")!

async function makeCall(toNumber: string) {
  console.log("Making Vobiz call to:", toNumber)

  const response = await fetch(
    `https://api.vobiz.ai/api/v1/Account/${VOBIZ_ACCOUNT}/Call/`,
    {
      method: "POST",
      headers: {
        "X-Auth-ID": VOBIZ_ACCOUNT,
        "X-Auth-Token": VOBIZ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: VOBIZ_NUMBER,
        to: toNumber,
        answer_url: "https://xpngazwavohqmhfyldct.supabase.co/functions/v1/call-handler",
        answer_method: "POST",
        hangup_url: "https://xpngazwavohqmhfyldct.supabase.co/functions/v1/call-handler",
        hangup_method: "POST",
        fallback_url: "https://xpngazwavohqmhfyldct.supabase.co/functions/v1/call-fallback",
        fallback_method: "POST",
        time_limit: 300
      })
    }
  )

  const text = await response.text()
  console.log("Vobiz response:", text)
  return { raw: text }
}

serve(async (req) => {
  if (req.method === "POST") {
    try {
      const { phone, name, lead_id } = await req.json()

      if (!phone) {
        return new Response(JSON.stringify({ error: "Phone required" }), { status: 400 })
      }

      let formattedPhone = phone
      if (phone.startsWith("91") && phone.length === 12) {
        formattedPhone = "+" + phone
      } else if (!phone.startsWith("+")) {
        formattedPhone = "+91" + phone
      }

      console.log("Calling:", formattedPhone, "Name:", name)

      await supabase.from("calls").insert({
        lead_phone: phone,
        lead_id: lead_id,
        status: "initiated",
        created_at: new Date().toISOString()
      })

      const result = await makeCall(formattedPhone)

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })

    } catch (error) {
      console.log("Error:", error)
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
    }
  }

  return new Response("Method not allowed", { status: 405 })
})