import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  try {
    const body = await req.json()
    console.log("VAPI webhook type:", body?.message?.type)

    const { message } = body

    if (message?.type === "end-of-call-report") {
      const recordingUrl = message.artifact?.recordingUrl
      const transcript = message.artifact?.transcript
      const startedAt = message.call?.startedAt
      const endedAt = message.call?.endedAt
      const duration = startedAt && endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : 0

      // Get phone — try multiple fields
      const rawPhone = message.call?.customer?.number
        ?? message.customer?.number
        ?? message.call?.to
        ?? ""

      // Normalize — remove + and spaces
      const customerPhone = rawPhone.replace(/\+|\s/g, "")

      console.log("Call ended — Phone:", customerPhone, "Duration:", duration, "Recording:", recordingUrl)

      if (customerPhone) {
        // Try to update existing initiated call
        const { data: updated } = await supabase.from("calls")
          .update({
            status: "completed",
            duration,
            recording_url: recordingUrl ?? null,
            transcript: transcript ?? null,
            updated_at: new Date().toISOString()
          })
          .eq("lead_phone", customerPhone)
          .select()

        console.log("Updated calls:", updated?.length)

        // Always insert a new completed record with recording
        await supabase.from("calls").insert({
          lead_phone: customerPhone,
          status: "completed",
          duration,
          recording_url: recordingUrl ?? null,
          transcript: transcript ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        // Save transcript to messages
        if (transcript) {
          await supabase.from("messages").insert({
            lead_phone: customerPhone,
            direction: "outbound",
            body: `[Kate Call Transcript]\n${transcript.substring(0, 1000)}`,
            created_at: new Date().toISOString()
          })
        }

        // Update lead status
        await supabase.from("leads")
          .update({ status: "called", updated_at: new Date().toISOString() })
          .eq("phone", customerPhone)
      }
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    console.log("Error:", error)
    return new Response("OK", { status: 200 })
  }
})
