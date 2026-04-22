import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!
const PHONE_NUMBER_ID = "1040908659116646"
const VAPI_ASSISTANT_ID = "feb81cc2-d5c6-43f7-9699-e5d13a332246"
const VAPI_PHONE_NUMBER_ID = "d329e69f-4b2a-4184-84e5-5a8eb267b66e"

async function sendWhatsApp(to: string, body: string) {
  const res = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } })
  })
  const data = await res.json()
  console.log("WhatsApp sent to:", to, "Response:", JSON.stringify(data))
  return data
}

async function triggerKateCall(phone: string, name: string, product: string, city: string, language: string) {
  const greetings: any = {
    tamil: `வணக்கம் ${name}! நான் Kate, Excel Fit India-விலிருந்து. நீங்கள் ${product} பத்தி interest காட்டினீங்க — இன்னும் interested-ஆ இருக்கீங்களா? Special offer இருக்கு!`,
    telugu: `నమస్కారం ${name}! Kate మాట్లాడుతున్నాను Excel Fit India నుండి. మీరు ${product} చూసారు — ఇంకా interested గా ఉన్నారా?`,
    kannada: `ನಮಸ್ಕಾರ ${name}! Kate ಮಾತಾಡುತ್ತಿದ್ದೇನೆ Excel Fit India ನಿಂದ. ${product} ಬಗ್ಗೆ ಇನ್ನೂ ಆಸಕ್ತಿ ಇದೆಯಾ?`,
    hindi: `नमस्ते ${name}! Kate बोल रही हूँ Excel Fit India से। ${product} में अभी भी interest है?`,
    english: `Hi ${name}! Kate from Excel Fit India. You showed interest in our ${product}. Are you still considering it? I have a special offer for you today!`
  }

  const firstMessage = greetings[language] ?? greetings.english

  await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("VAPI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: `+${phone}`, name, numberE164CheckEnabled: false },
      assistantOverrides: {
        firstMessage,
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          systemPrompt: `You are Kate from Excel Fit India calling a WARM lead for follow-up.
Customer: ${name}, interested in ${product}, city: ${city}.
Language: Speak in ${language} throughout.
Goal: Find their objection and remove it. Ask ONE question: was it price, product, or timing?
Keep responses SHORT — max 2 sentences.`
        }
      }
    })
  })
  console.log("Kate call triggered for follow-up:", phone)
}

function getWarmMessage(day: number, name: string, product: string, city: string, language: string): string {
  const messages: any = {
    tamil: {
      1: `வணக்கம் ${name}! Kate இங்கே, Excel Fit India-விலிருந்து 😊\n\nUngalukku ${product} catalogue send panninen — paathingala? Edhavadhu doubt irundha kelu! Reply pannunga 🏋️`,
      3: `Hi ${name}! Chennai-la 500+ families daily treadmill use pandranga 💪\n\nCustomer reviews parunga: excelfitindia.com/reviews\n\nUngaluku suit agura product select pannunga! 🏃`,
      5: `${name}, special offer! 🎁\n\n${product} — Free installation + 6 months extended warranty!\n\nOffer Sunday varaikku mattum. Interested-aa? Call pannunga: +919488005454`,
      14: `Hi ${name}! Last message from Excel Fit India 🙏\n\nFitness journey start pannanum-na, nanga irukom!\n\nReply YES — latest offers\nReply NO — unsubscribe\n\nexcelfitindia.com`
    },
    english: {
      1: `Hi ${name}! Kate here from Excel Fit India 😊\n\nDid you check the ${product} catalogue we sent? Any questions? Just reply here — happy to help! 🏋️`,
      3: `Hi ${name}! Did you know 500+ families use Excel Fit India treadmills daily? 💪\n\nCheck real customer reviews: excelfitindia.com/reviews\n\nFind your perfect fit! 🏃`,
      5: `${name}, special offer this week! 🎁\n\n${product} — Free installation + 6 months extended warranty!\n\nOffer valid till Sunday only. Interested? Call: +919488005454`,
      14: `Hi ${name}! Last message from Excel Fit India 🙏\n\nWhenever you're ready for your fitness journey, we're here!\n\nReply YES for latest offers\nReply NO to unsubscribe\n\nexcelfitindia.com`
    }
  }

  const langMessages = messages[language] ?? messages.english
  return langMessages[day] ?? langMessages[1]
}

function getColdMessage(day: number, name: string, product: string, city: string): string {
  const msgs: any = {
    3: `Hi ${name}! Quick fitness tip 💡\n\n20 mins on treadmill daily burns 200+ calories!\n\nOur ${product} fits perfectly at home — compact, quiet, easy to use.\n\nBrowse: excelfitindia.com 🏃`,
    7: `Hi ${name}! This week only 🎁\n\n${product} — special price + free delivery to ${city || "your city"}!\n\nInterested? Reply YES and we'll share details 😊`,
    14: `Hi ${name}! Final message from Excel Fit India 🙏\n\nWhenever you're ready for home fitness, we're here!\n\nexcelfitindia.com\n📞 +919488005454`
  }
  return msgs[day] ?? msgs[3]
}

serve(async (req) => {
  try {
    console.log("Follow-up sender triggered")

    const now = new Date()

    // Get all pending follow-ups due now or earlier
    const { data: pendingFollowUps, error } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50)

    if (error) {
      console.log("Error fetching follow-ups:", error)
      return new Response("Error", { status: 500 })
    }

    console.log("Pending follow-ups:", pendingFollowUps?.length ?? 0)

    for (const followUp of pendingFollowUps ?? []) {
      try {
        // Get lead details
        const { data: lead } = await supabase
          .from("leads")
          .select("*")
          .eq("phone", followUp.lead_phone)
          .single()

        if (!lead) {
          console.log("Lead not found:", followUp.lead_phone)
          continue
        }

        const name = lead.name ?? "Friend"
        const product = lead.product_name ?? "fitness equipment"
        const city = lead.customer_city ?? ""
        const language = lead.language ?? "english"
        const category = followUp.category

        console.log(`Sending day ${followUp.day_number} follow-up to ${name} (${category})`)

        if (category === "warm") {
          if (followUp.day_number === 7) {
            // Day 7 warm — Kate calls instead of WhatsApp
            await triggerKateCall(followUp.lead_phone, name, product, city, language)
          } else {
            const message = getWarmMessage(followUp.day_number, name, product, city, language)
            await sendWhatsApp(followUp.lead_phone, message)
          }
        } else if (category === "cold") {
          const message = getColdMessage(followUp.day_number, name, product, city)
          await sendWhatsApp(followUp.lead_phone, message)
        }

        // Mark as sent
        await supabase.from("follow_ups")
          .update({ status: "sent", sent_at: now.toISOString() })
          .eq("id", followUp.id)

        // Save to messages table
        await supabase.from("messages").insert({
          lead_phone: followUp.lead_phone,
          direction: "outbound",
          body: `[Follow-up Day ${followUp.day_number}]`,
          created_at: now.toISOString()
        })

      } catch (err) {
        console.log("Error processing follow-up:", followUp.id, err)
        await supabase.from("follow_ups")
          .update({ status: "failed" })
          .eq("id", followUp.id)
      }
    }

    return new Response(JSON.stringify({ processed: pendingFollowUps?.length ?? 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    console.log("Error:", error)
    return new Response("Error", { status: 500 })
  }
})