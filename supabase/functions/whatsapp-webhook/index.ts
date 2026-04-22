import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const VAPI_ASSISTANT_ID = "feb81cc2-d5c6-43f7-9699-e5d13a332246"
const VAPI_PHONE_NUMBER_ID = "d329e69f-4b2a-4184-84e5-5a8eb267b66e"

function isWithinCallingHours(): boolean {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffset)
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return totalMinutes >= 8 * 60 && totalMinutes <= 21 * 60 + 30
}

function detectLanguageFromCity(city: string): string {
  const c = city.toLowerCase()
  if (["chennai","coimbatore","madurai","trichy","salem","tirunelveli","tenkasi","sivakasi","vellore","erode","tirupur","thanjavur","dindigul"].some(x => c.includes(x))) return "tamil"
  if (["hyderabad","visakhapatnam","vijayawada","warangal","tirupati","guntur","nellore","kurnool","rajahmundry","kakinada"].some(x => c.includes(x))) return "telugu"
  if (["bangalore","bengaluru","mysore","mysuru","hubli","mangalore","belgaum","bellary","davangere","shimoga","tumkur"].some(x => c.includes(x))) return "kannada"
  if (["kochi","thiruvananthapuram","kozhikode","thrissur","kollam","kannur","kerala","calicut","palakkad","malappuram"].some(x => c.includes(x))) return "malayalam"
  if (["delhi","mumbai","pune","lucknow","kanpur","agra","jaipur","indore","bhopal","nagpur","ahmedabad","surat","patna"].some(x => c.includes(x))) return "hindi"
  return "english"
}

function getBudgetQuestion(language: string, name: string): string {
  const q: any = {
    tamil: `நன்றி ${name}! 😊\n\n*உங்கள் budget என்ன?*`,
    telugu: `ధన్యవాదాలు ${name}! 😊\n\n*మీ budget ఎంత?*`,
    kannada: `ಧನ್ಯವಾದಗಳು ${name}! 😊\n\n*ನಿಮ್ಮ budget ಎಷ್ಟು?*`,
    malayalam: `നന്ദി ${name}! 😊\n\n*നിങ്ങളുടെ budget എത്രയാണ്?*`,
    hindi: `धन्यवाद ${name}! 😊\n\n*आपका budget क्या है?*`,
    english: `Thank you ${name}! 😊\n\n*What is your approximate budget?*`
  }
  return q[language] ?? q.english
}

function getUnitsQuestion(language: string, name: string): string {
  const q: any = {
    tamil: `${name}, எத்தனை units வேணும்? 🏋️`,
    telugu: `${name}, మీకు ఎన్ని units కావాలి? 🏋️`,
    kannada: `${name}, ನಿಮಗೆ ಎಷ್ಟು units ಬೇಕು? 🏋️`,
    malayalam: `${name}, എത്ര units വേണം? 🏋️`,
    hindi: `${name}, कितने units चाहिए? 🏋️`,
    english: `${name}, how many units are you looking for? 🏋️`
  }
  return q[language] ?? q.english
}

async function scheduleFollowUps(phone: string, category: string) {
  console.log("Scheduling follow-ups for:", phone, category)
  const now = new Date()
  const warmDays = [1, 3, 5, 7, 14]
  const coldDays = [3, 7, 14]
  const days = category === "warm" ? warmDays : coldDays

  const followUps = days.map(day => {
    const scheduledDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000)
    scheduledDate.setUTCHours(3, 30, 0, 0) // 9 AM IST
    if (scheduledDate.getTime() < now.getTime()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1)
    }
    return {
      lead_phone: phone,
      category,
      day_number: day,
      status: "pending",
      scheduled_at: scheduledDate.toISOString(),
      created_at: now.toISOString()
    }
  })

  const { error } = await supabase.from("follow_ups").insert(followUps)
  if (error) console.log("Error scheduling follow-ups:", error)
  else console.log("Scheduled", followUps.length, "follow-ups for", phone)
}

async function triggerKateCall(fromNumber: string, customerName: string, lead: any) {
  try {
    const product = lead?.product_name ?? "fitness equipment"
    const variant = lead?.product_variant?.replace('q4_', '') ?? ""
    const city = lead?.customer_city ?? ""
    const category = lead?.category ?? "warm"
    const language = lead?.language ?? "english"

    const hotGreeting: any = {
      tamil: `வணக்கம் ${customerName}! நான் Kate, Excel Fit India-விலிருந்து பேசுகிறேன். இந்த call record ஆகலாம். நீங்கள் ${product}${variant ? ` — ${variant}` : ""} பத்தி interest காட்டினீங்க${city ? ` — ${city}க்கு delivery` : ""}. இன்னைக்கு special offer இருக்கு. ரெண்டு நிமிஷம் பேசலாமா?`,
      telugu: `నమస్కారం ${customerName}! నేను Kate, Excel Fit India నుండి మాట్లాడుతున్నాను. మీరు ${product} గురించి ఆసక్తి చూపించారు${city ? ` — ${city}కి delivery` : ""}. ఈరోజు special offer ఉంది. రెండు నిమిషాలు మాట్లాడగలరా?`,
      kannada: `ನಮಸ್ಕಾರ ${customerName}! ನಾನು Kate, Excel Fit India ನಿಂದ ಮಾತಾಡುತ್ತಿದ್ದೇನೆ. ನೀವು ${product} ಬಗ್ಗೆ ಆಸಕ್ತಿ ತೋರಿಸಿದ್ದೀರಿ${city ? ` — ${city}ಗೆ delivery` : ""}. ಇಂದು special offer ಇದೆ. ಎರಡು ನಿಮಿಷ ಮಾತಾಡಬಹುದಾ?`,
      malayalam: `നമസ്കാരം ${customerName}! ഞാൻ Kate, Excel Fit India-യിൽ നിന്ന് വിളിക്കുന്നു. നിങ്ങൾ ${product}-ൽ താൽപ്പര്യം കാണിച്ചു${city ? ` — ${city}-ലേക്ക് delivery` : ""}. ഇന്ന് special offer ഉണ്ട്. രണ്ട് മിനിറ്റ് സംസാരിക്കാമോ?`,
      hindi: `नमस्ते ${customerName}! मैं Kate, Excel Fit India से बोल रही हूँ। आपने ${product} में interest दिखाया${city ? ` — ${city} के लिए delivery` : ""}। आज special offer है। दो मिनट बात कर सकते हैं?`,
      english: `Hi ${customerName}! This is Kate from Excel Fit India. This call may be recorded. I can see you're interested in our ${product}${variant ? ` — ${variant} model` : ""}${city ? ` for delivery to ${city}` : ""}. I have a special offer available today. Do you have 2 minutes?`
    }

    const warmGreeting: any = {
      tamil: `வணக்கம் ${customerName}! நான் Kate, Excel Fit India-விலிருந்து பேசுகிறேன். இந்த call record ஆகலாம். நீங்கள் ${product} பாத்தீங்க — ஏதாவது doubt இருந்தா கேளுங்க. ரெண்டு நிமிஷம் பேசலாமா?`,
      telugu: `నమస్కారం ${customerName}! నేను Kate, Excel Fit India నుండి మాట్లాడుతున్నాను. మీరు ${product} చూసారు — ఏమైనా సందేహాలు ఉన్నాయా? రెండు నిమిషాలు మాట్లాడగలరా?`,
      kannada: `ನಮಸ್ಕಾರ ${customerName}! ನಾನు Kate, Excel Fit India ನಿಂದ ಮಾತಾಡುತ್ತಿದ್ದೇನೆ. ನೀವು ${product} ನೋಡಿದ್ದೀರಿ — ಏನಾದರೂ ಪ್ರಶ್ನೆ ಇದೆಯಾ? ಎರಡು ನಿಮಿಷ ಮಾತಾಡಬಹುದಾ?`,
      malayalam: `നമസ്കാരം ${customerName}! ഞാൻ Kate, Excel Fit India-യിൽ നിന്ന് വിളിക്കുന്നു. നിങ്ങൾ ${product} നോക്കിയിരുന്നു — എന്തെങ്കിലും സംശയം ഉണ്ടോ? രണ്ട് മിനിറ്റ് സംസാരിക്കാമോ?`,
      hindi: `नमस्ते ${customerName}! मैं Kate, Excel Fit India से बोल रही हूँ। आपने ${product} देखा था — कोई सवाल है? दो मिनट बात कर सकते हैं?`,
      english: `Hi ${customerName}! Kate from Excel Fit India here. This call may be recorded. I noticed you were interested in our ${product}. Was there anything stopping you from going ahead? Do you have 2 minutes?`
    }

    const firstMessage = category === "hot"
      ? (hotGreeting[language] ?? hotGreeting.english)
      : (warmGreeting[language] ?? warmGreeting.english)

    const systemPrompt = category === "hot"
      ? `You are Kate, a friendly sales executive at Excel Fit India.

IMPORTANT: This is a HOT lead. You already have their details from WhatsApp:
- Name: ${customerName}
- Product: ${product} ${variant}
- City: ${city}
- Budget: ${lead?.budget_range?.replace('budget_', '') ?? "unknown"}
- Units: ${lead?.units ?? "1"}

DO NOT ask qualification questions — they already answered on WhatsApp.
YOUR ONLY GOAL: Close the sale.

CLOSING STRATEGY:
1. Confirm their interest briefly
2. Offer something extra — EMI (₹2,500/month), free installation, extended warranty
3. Ask to confirm delivery details
4. If they agree — tell them our team will WhatsApp delivery details in 30 minutes

PRODUCTS & PRICES:
- i20 Treadmill: ₹29,500 (was ₹36,500) — top seller
- Exercise Bikes from ₹28,200
- Home Gym Armstrong Plus: ₹20,950
- Elliptical from ₹88,500
- All: 1 year warranty, free installation, pan India delivery
- EMI available from ₹999/month

LANGUAGE: Customer is from ${city}. Speak in ${language} throughout. Never switch language unless customer does.
Keep responses SHORT — max 2 sentences. This is a phone call.`

      : `You are Kate, a friendly sales executive at Excel Fit India.

This WARM lead showed interest in ${product} but didn't complete purchase.

YOUR GOAL: Find and remove their objection.

ASK ONE QUESTION: "Was it the price, the product, or did you need more time?"

Then handle their objection:
- Price → Mention EMI (₹2,500/month), compare to gym membership cost
- Product doubt → Offer showroom visit or video demo
- Need time → Send WhatsApp catalogue, follow up in 3 days
- Competitor → Mention direct importer advantage, better warranty

PRODUCTS & PRICES:
- Treadmills from ₹14,400, i20 at ₹29,500
- Exercise Bikes from ₹28,200
- Home Gym from ₹20,950
- EMI, 1 year warranty, free installation

LANGUAGE: Customer is from ${city}. Speak in ${language} throughout. Never switch language unless customer does.
Keep responses SHORT — max 2 sentences.`

    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("VAPI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customer: { number: `+${fromNumber}`, name: customerName, numberE164CheckEnabled: false },
        assistantOverrides: { firstMessage, model: { provider: "openai", model: "gpt-4o-mini", systemPrompt } }
      })
    })

    const data = await res.json()
    console.log("VAPI triggered:", JSON.stringify(data))

    await supabase.from("calls").insert({
      lead_phone: fromNumber, status: "initiated",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
  } catch (e) {
    console.log("VAPI error:", e)
  }
}

async function scheduleOrCallNow(fromNumber: string, customerName: string, lead: any, phoneNumberId: string, token: string) {
  if (isWithinCallingHours()) {
    console.log("Within hours — calling now")
    await triggerKateCall(fromNumber, customerName, lead)
  } else {
    console.log("Outside hours — scheduling tomorrow 9AM")
    await supabase.from("calls").insert({
      lead_phone: fromNumber, status: "scheduled",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
    await sendText(fromNumber,
      `✅ We've received your enquiry! Our AI sales executive Kate will call you tomorrow morning at 9 AM. Have a great evening! 🌙`,
      phoneNumberId, token
    )
  }
}

async function sendCatalogueAndCall(fromNumber: string, customerName: string, updatedLead: any, phoneNumberId: string, token: string) {
  const { category, hotWarmCold } = classifyLead(updatedLead)
  console.log("Classification:", category, hotWarmCold)

  await supabase.from("leads").update({
    units: updatedLead.units ?? "1",
    lead_cat: category,
    category: hotWarmCold,
    bot_step: 9,
    status: "qualified"
  }).eq("phone", fromNumber)

  const catalogueLink = getCatalogueLink(updatedLead.usage_type ?? "home", updatedLead.product_category ?? "cardio")
  const catLabels: any = { A: "Home User", B: "Gym Owner", C: "Corporate", D: "Dealer" }

  await sendText(fromNumber,
    `🎉 *Thank you ${updatedLead.name ?? customerName}!*\n\nYour personalised catalogue:\n👉 ${catalogueLink}\n\n*Summary:*\n📦 ${updatedLead.product_name ?? "Equipment"}\n📍 ${updatedLead.customer_city ?? "India"}\n📊 CAT ${category} (${catLabels[category]})\n\nOur team will contact you shortly! 🏋️`,
    phoneNumberId, token
  )

  if (hotWarmCold === "hot") {
    await scheduleOrCallNow(fromNumber, updatedLead.name ?? customerName, { ...updatedLead, category: hotWarmCold }, phoneNumberId, token)
    if (isWithinCallingHours()) {
      await sendText(fromNumber,
        "📞 *Kate from Excel Fit India will call you in the next 2 minutes with a special offer!* Please pick up! 🎁",
        phoneNumberId, token
      )
    }
  } else if (hotWarmCold === "warm") {
    await sendText(fromNumber,
      "✅ Our team will WhatsApp you with detailed pricing and EMI options shortly!\n\nBrowse: excelfitindia.com 🏋️",
      phoneNumberId, token
    )
    await scheduleFollowUps(fromNumber, "warm")
  } else {
    await sendText(fromNumber,
      "✅ Take your time to browse. Reply anytime!\n\nexcelfitindia.com 🏋️",
      phoneNumberId, token
    )
    await scheduleFollowUps(fromNumber, "cold")
  }
}

async function getClient(phoneNumberId: string) {
  const { data } = await supabase.from("clients").select("*").eq("phone_number_id", phoneNumberId).single()
  return data
}

async function sendText(to: string, body: string, phoneNumberId: string, token: string) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } })
  })
}

async function sendButtons(to: string, bodyText: string, buttons: {id: string, title: string}[], phoneNumberId: string, token: string) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "interactive",
      interactive: {
        type: "button", body: { text: bodyText },
        action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) }
      }
    })
  })
}

async function sendList(to: string, bodyText: string, sections: any[], phoneNumberId: string, token: string) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "interactive",
      interactive: { type: "list", body: { text: bodyText }, action: { button: "Select Option", sections } }
    })
  })
}

function getCatalogueLink(usageType: string, productCategory: string): string {
  if (usageType === "home") {
    if (productCategory === "cardio") return "https://excelfitindia.com/fitness-equipments/treadmill"
    if (productCategory === "strength") return "https://excelfitindia.com/fitness-equipments/home-gym"
    if (productCategory === "recovery") return "https://excelfitindia.com/fitness-equipments/massager"
    return "https://excelfitindia.com/fitness-equipments"
  }
  if (usageType === "gym" || usageType === "corporate") return "https://excelfitindia.com/fitness-equipments/commercial"
  if (usageType === "resell") return "https://excelfitindia.com/dealership"
  return "https://excelfitindia.com"
}

function classifyLead(lead: any): {category: string, hotWarmCold: string} {
  let category = "A"
  if (lead.usage_type === "home") category = "A"
  else if (lead.usage_type === "gym") category = "B"
  else if (lead.usage_type === "corporate") category = "C"
  else if (lead.usage_type === "resell") category = "D"

  if (lead.usage_type === "corporate" || lead.usage_type === "resell") return { category, hotWarmCold: "hot" }
  if (lead.usage_type === "gym") return { category, hotWarmCold: "hot" }

  const units = lead.units ?? "1"
  if (units === "6-20" || units === "20+") return { category, hotWarmCold: "hot" }
  if (units === "2-5") return { category, hotWarmCold: "hot" }

  const productPrices: any = {
    treadmill: 29500, bike: 28200, elliptical: 88500,
    homegym: 20950, dumbbells: 5000, bench: 8000,
    massager: 129000, accessories: 2000, yoga: 1500,
    multigym: 150000, dynamic: 200000, gracile: 250000
  }
  const productPrice = productPrices[lead.product_name ?? "treadmill"] ?? 29500
  const budgetValue = lead.budget_range === "budget_high" ? 75000
    : lead.budget_range === "budget_mid" ? 35000 : 12000

  console.log("Product price:", productPrice, "Budget value:", budgetValue)
  const hotWarmCold = budgetValue >= productPrice * 0.7 ? "hot" : "warm"
  return { category, hotWarmCold }
}

function getQ2Options(usageType: string) {
  if (usageType === "home") return {
    text: "Great! 🏠 Which type of equipment are you looking for?",
    sections: [{ title: "Equipment Categories", rows: [
      { id: "q2_cardio", title: "🏃 Cardio", description: "Treadmill, Bike, Elliptical" },
      { id: "q2_strength", title: "💪 Strength & Gym", description: "Home Gym, Dumbbells, Benches" },
      { id: "q2_recovery", title: "💆 Recovery", description: "Massager, Accessories" }
    ]}]
  }
  if (usageType === "gym") return {
    text: "Perfect! 🏢 What type of commercial equipment do you need?",
    sections: [{ title: "Commercial Categories", rows: [
      { id: "q2_commercial_cardio", title: "🏃 Commercial Cardio", description: "Treadmill, Bike, Elliptical" },
      { id: "q2_commercial_strength", title: "💪 Strength Machines", description: "Multi Gym, Dynamic Series" },
      { id: "q2_crossfit", title: "⚡ Crossfit & Functional", description: "Battle Ropes, Plyo Boxes" },
      { id: "q2_infrastructure", title: "🏗️ Infrastructure", description: "Racks, Flooring" }
    ]}]
  }
  if (usageType === "corporate") return {
    text: "Excellent! 🏬 What type of corporate wellness setup?",
    sections: [{ title: "Corporate Categories", rows: [
      { id: "q2_corp_cardio", title: "🏃 Cardio Zone", description: "Treadmill, Bike, Elliptical" },
      { id: "q2_corp_strength", title: "💪 Strength Zone", description: "Multi Gym, Free Weights" },
      { id: "q2_corp_recovery", title: "💆 Recovery Zone", description: "Massager, Stretching" },
      { id: "q2_corp_full", title: "🏋️ Full Gym Setup", description: "Complete corporate gym" }
    ]}]
  }
  return {
    text: "Great! 🤝 Which product range to deal?",
    sections: [{ title: "Dealer Categories", rows: [
      { id: "q2_deal_cardio", title: "🏃 Cardio Equipment", description: "High margin" },
      { id: "q2_deal_strength", title: "💪 Strength Equipment", description: "Gym setups" },
      { id: "q2_deal_full", title: "🏋️ Full Range", description: "Complete line" }
    ]}]
  }
}

function getQ3Options(productCategory: string) {
  const options: any = {
    cardio: { text: "Which cardio equipment?", buttons: [
      { id: "q3_treadmill", title: "🏃 Treadmill" },
      { id: "q3_bike", title: "🚴 Exercise Bike" },
      { id: "q3_elliptical", title: "🔄 Elliptical" }
    ]},
    strength: { text: "Which strength equipment?", buttons: [
      { id: "q3_homegym", title: "🏋️ Home Gym Set" },
      { id: "q3_dumbbells", title: "💪 Dumbbells" },
      { id: "q3_bench", title: "🪑 Bench" }
    ]},
    recovery: { text: "Which recovery product?", buttons: [
      { id: "q3_massager", title: "💆 Massager Chair" },
      { id: "q3_accessories", title: "🎯 Accessories" },
      { id: "q3_yoga", title: "🧘 Yoga & Stretch" }
    ]},
    commercial_cardio: { text: "Which commercial cardio?", buttons: [
      { id: "q3_comm_treadmill", title: "🏃 C-Treadmill" },
      { id: "q3_comm_bike", title: "🚴 C-Bike" },
      { id: "q3_comm_elliptical", title: "🔄 C-Elliptical" }
    ]},
    commercial_strength: { text: "Which commercial strength?", buttons: [
      { id: "q3_multigym", title: "🏋️ Multi Gym" },
      { id: "q3_dynamic", title: "⚡ Dynamic Series" },
      { id: "q3_gracile", title: "💪 Gracile/HAM" }
    ]}
  }
  return options[productCategory] ?? { text: "Which product?", buttons: [
    { id: "q3_cardio", title: "🏃 Cardio" },
    { id: "q3_strength", title: "💪 Strength" },
    { id: "q3_other", title: "🎯 Other" }
  ]}
}

function getQ4Options(productName: string) {
  const options: any = {
    treadmill: { text: "Which treadmill variant?", sections: [{ title: "Treadmill Models", rows: [
      { id: "q4_manual", title: "Manual Treadmill", description: "From ₹14,400" },
      { id: "q4_motorised", title: "Motorised", description: "From ₹18,000" },
      { id: "q4_auto_elev", title: "Auto Elevation", description: "From ₹35,000" },
      { id: "q4_i20", title: "i20 Model ⭐", description: "₹29,500 (Top Seller)" },
      { id: "q4_foldable", title: "Foldable", description: "Space saving" },
      { id: "q4_kids", title: "Kids Treadmill", description: "Safe for children" }
    ]}]},
    bike: { text: "Which exercise bike?", sections: [{ title: "Bike Models", rows: [
      { id: "q4_upright", title: "Upright Bike", description: "Gamma ₹28,200" },
      { id: "q4_recumbent", title: "Recumbent Bike", description: "Back support" },
      { id: "q4_spin", title: "Spin Bike", description: "Intense workout" },
      { id: "q4_air_bike", title: "Air Bike", description: "Full body" },
      { id: "q4_folding_bike", title: "Folding Bike", description: "Compact" }
    ]}]},
    homegym: { text: "Which home gym?", sections: [{ title: "Home Gym Models", rows: [
      { id: "q4_armstrong", title: "Armstrong Plus ⭐", description: "₹20,950" },
      { id: "q4_single", title: "Single Station", description: "Compact" },
      { id: "q4_double", title: "Double Station", description: "Two users" },
      { id: "q4_cable", title: "Cable Pulley Gym", description: "Full range" }
    ]}]},
    massager: { text: "Which massager?", sections: [{ title: "Massager Models", rows: [
      { id: "q4_chair", title: "Massager Chair ⭐", description: "₹1,29,000 (40% OFF)" },
      { id: "q4_handheld", title: "Handheld Massager", description: "Portable" },
      { id: "q4_foot", title: "Foot Massager", description: "Relaxation" },
      { id: "q4_percussion", title: "Percussion Gun", description: "Deep tissue" }
    ]}]}
  }
  return options[productName] ?? { text: "Which variant?", sections: [{ title: "Options", rows: [
    { id: "q4_entry", title: "Entry Level", description: "Budget friendly" },
    { id: "q4_mid", title: "Mid Range", description: "Best value" },
    { id: "q4_premium", title: "Premium", description: "Top quality" }
  ]}]}
}

serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url)
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    if (mode === "subscribe" && token === Deno.env.get("WEBHOOK_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 })
    }
    return new Response("Forbidden", { status: 403 })
  }

  if (req.method === "POST") {
    try {
      const body = await req.json()
      const value = body?.entry?.[0]?.changes?.[0]?.value
      const message = value?.messages?.[0]
      const contact = value?.contacts?.[0]
      const phoneNumberId = value?.metadata?.phone_number_id

      if (!message || !phoneNumberId) return new Response("OK", { status: 200 })

      const client = await getClient(phoneNumberId)
      const token = client?.whatsapp_token ?? Deno.env.get("WHATSAPP_TOKEN")!
      const clientId = client?.id ?? null
      const businessName = client?.business_name ?? "Excel Fit India"
      const fromNumber = message.from
      const customerName = contact?.profile?.name ?? "Friend"

      const { data: existingLead } = await supabase
        .from("leads").select("*").eq("phone", fromNumber).single()

      const currentStep = existingLead?.bot_step ?? 0

      const messageBody = message.type === "text" ? message.text?.body :
        message.type === "interactive" ?
          (message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "") : ""

      await supabase.from("messages").insert({
        lead_phone: fromNumber, client_id: clientId, direction: "inbound", body: messageBody
      })

      await supabase.from("leads").upsert({
        phone: fromNumber, name: customerName, client_id: clientId,
        status: "active", updated_at: new Date().toISOString(), last_message: messageBody
      }, { onConflict: "phone" })

      const buttonId = message.type === "interactive" ?
        (message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? "") : ""
      const textBody = message.type === "text" ? (message.text?.body ?? "").toLowerCase() : ""

      console.log("Step:", currentStep, "ButtonId:", buttonId, "Text:", textBody.substring(0, 50))

      const isGreeting = textBody && ["hi","hello","hai","hey","vanakkam","namaste","helo","start","restart","menu"].some(g => textBody.includes(g))

      if (currentStep === 0 || isGreeting || !existingLead) {
        await supabase.from("leads").update({ bot_step: 1 }).eq("phone", fromNumber)
        await sendList(fromNumber,
          `👋 *Welcome to ${businessName}!*\n\nIndia's leading fitness equipment brand 🏋️\n\n*Q1: Who are you buying for?*`,
          [{ title: "Select Your Category", rows: [
            { id: "q1_home", title: "🏠 Home Use", description: "Personal fitness at home" },
            { id: "q1_gym", title: "🏢 Gym / Fitness Centre", description: "Commercial gym setup" },
            { id: "q1_corporate", title: "🏬 Corporate", description: "Office wellness setup" },
            { id: "q1_resell", title: "🤝 Reseller / Dealer", description: "Become our dealer" }
          ]}],
          phoneNumberId, token
        )
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 1 && buttonId.startsWith("q1_")) {
        const usageMap: any = { q1_home: "home", q1_gym: "gym", q1_corporate: "corporate", q1_resell: "resell" }
        const usageType = usageMap[buttonId] ?? "home"
        await supabase.from("leads").update({ usage_type: usageType, bot_step: 2 }).eq("phone", fromNumber)
        const q2 = getQ2Options(usageType)
        await sendList(fromNumber, `*Q2: ${q2.text}*`, q2.sections, phoneNumberId, token)
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 2 && buttonId.startsWith("q2_")) {
        const catMap: any = {
          q2_cardio: "cardio", q2_strength: "strength", q2_recovery: "recovery",
          q2_commercial_cardio: "commercial_cardio", q2_commercial_strength: "commercial_strength",
          q2_crossfit: "crossfit", q2_infrastructure: "infrastructure",
          q2_corp_cardio: "cardio", q2_corp_strength: "strength",
          q2_corp_recovery: "recovery", q2_corp_full: "full",
          q2_deal_cardio: "cardio", q2_deal_strength: "strength", q2_deal_full: "full"
        }
        const productCategory = catMap[buttonId] ?? "cardio"
        await supabase.from("leads").update({ product_category: productCategory, bot_step: 3 }).eq("phone", fromNumber)
        const q3 = getQ3Options(productCategory)
        await sendButtons(fromNumber, `*Q3: ${q3.text}*`, q3.buttons, phoneNumberId, token)
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 3 && buttonId.startsWith("q3_")) {
        const productMap: any = {
          q3_treadmill: "treadmill", q3_bike: "bike", q3_elliptical: "elliptical",
          q3_homegym: "homegym", q3_dumbbells: "dumbbells", q3_bench: "bench",
          q3_massager: "massager", q3_accessories: "accessories", q3_yoga: "yoga",
          q3_comm_treadmill: "treadmill", q3_comm_bike: "bike", q3_comm_elliptical: "elliptical",
          q3_multigym: "multigym", q3_dynamic: "dynamic", q3_gracile: "gracile",
          q3_cardio: "treadmill", q3_strength: "homegym", q3_other: "accessories"
        }
        const productName = productMap[buttonId] ?? "treadmill"
        await supabase.from("leads").update({ product_name: productName, bot_step: 4 }).eq("phone", fromNumber)
        const q4 = getQ4Options(productName)
        await sendList(fromNumber, `*Q4: ${q4.text}*`, q4.sections, phoneNumberId, token)
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 4 && buttonId.startsWith("q4_")) {
        await supabase.from("leads").update({ product_variant: buttonId, bot_step: 5 }).eq("phone", fromNumber)
        await sendText(fromNumber,
          `Almost there! 😊\n\n*What is your name?*\n\nJust type your name and send.`,
          phoneNumberId, token
        )
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 5 && message.type === "text") {
        const parsedName = messageBody.trim() || customerName
        await supabase.from("leads").update({ name: parsedName, bot_step: 6 }).eq("phone", fromNumber)
        await sendText(fromNumber,
          `Nice to meet you ${parsedName}! 👋\n\n*Which city are you from?*\n\nType your city name.`,
          phoneNumberId, token
        )
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 6 && message.type === "text") {
        const parsedCity = messageBody.trim() || "India"
        const detectedLanguage = detectLanguageFromCity(parsedCity)
        console.log("City:", parsedCity, "Language:", detectedLanguage)

        await supabase.from("leads").update({
          customer_city: parsedCity, language: detectedLanguage, bot_step: 7
        }).eq("phone", fromNumber)

        const { data: leadData } = await supabase.from("leads").select("name").eq("phone", fromNumber).single()
        const leadName = leadData?.name ?? customerName
        const budgetQ = getBudgetQuestion(detectedLanguage, leadName)

        await sendButtons(fromNumber, budgetQ,
          [
            { id: "budget_low", title: "Under ₹20,000" },
            { id: "budget_mid", title: "₹20,000 - ₹50,000" },
            { id: "budget_high", title: "Above ₹50,000" }
          ],
          phoneNumberId, token
        )
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 7 && buttonId.startsWith("budget_")) {
        await supabase.from("leads").update({ budget_range: buttonId, bot_step: 8 }).eq("phone", fromNumber)

        const { data: leadData } = await supabase.from("leads").select("*").eq("phone", fromNumber).single()
        const leadName = leadData?.name ?? customerName
        const lang = leadData?.language ?? "english"
        const usageType = leadData?.usage_type ?? "home"

        if (usageType === "home") {
          const updatedLead = { ...leadData, units: "1", budget_range: buttonId }
          await sendCatalogueAndCall(fromNumber, leadName, updatedLead, phoneNumberId, token)
        } else {
          const unitsQ = getUnitsQuestion(lang, leadName)
          await sendButtons(fromNumber, unitsQ,
            [
              { id: "q6_1", title: "1 Unit" },
              { id: "q6_2_5", title: "2-5 Units" },
              { id: "q6_6_20", title: "6-20 Units" }
            ],
            phoneNumberId, token
          )
        }
        return new Response("OK", { status: 200 })
      }

      if (currentStep === 8 && buttonId.startsWith("q6_")) {
        console.log("Q6 button ID received:", buttonId)
        const unitsMap: any = { q6_1: "1", q6_2_5: "2-5", q6_6_20: "6-20", q6_20_plus: "20+" }
        const units = unitsMap[buttonId] ?? "1"
        console.log("Units mapped to:", units)

        const { data: fullLead } = await supabase.from("leads").select("*").eq("phone", fromNumber).single()
        const updatedLead = { ...fullLead, units }
        await sendCatalogueAndCall(fromNumber, updatedLead.name ?? customerName, updatedLead, phoneNumberId, token)
        return new Response("OK", { status: 200 })
      }

      if (currentStep >= 9) {
        const { data: leadData } = await supabase.from("leads").select("language").eq("phone", fromNumber).single()
        const lang = leadData?.language ?? "english"

        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: `You are a helpful sales assistant for Excel Fit India fitness equipment.
Products: Treadmills from ₹14,400, Exercise Bikes from ₹28,200, Home Gym from ₹20,950, Ellipticals from ₹88,500.
Customer language: ${lang}. Reply in ${lang} only.
Customer asks: "${messageBody}"
Reply helpfully in 2-3 sentences. For ordering: tell them to call +919488005454 or visit excelfitindia.com`
            }]
          })
        })
        const aiData = await aiResponse.json()
        const reply = aiData.choices?.[0]?.message?.content ?? "Our team will contact you shortly! 📞 +919488005454"
        await sendText(fromNumber, reply, phoneNumberId, token)
        await supabase.from("messages").insert({
          lead_phone: fromNumber, client_id: clientId, direction: "outbound", body: reply
        })
        return new Response("OK", { status: 200 })
      }

      await supabase.from("leads").update({ bot_step: 0 }).eq("phone", fromNumber)
      await sendList(fromNumber,
        `👋 *Welcome to ${businessName}!*\n\n*Q1: Who are you buying for?*`,
        [{ title: "Select Your Category", rows: [
          { id: "q1_home", title: "🏠 Home Use", description: "Personal fitness at home" },
          { id: "q1_gym", title: "🏢 Gym / Fitness Centre", description: "Commercial gym setup" },
          { id: "q1_corporate", title: "🏬 Corporate", description: "Office wellness setup" },
          { id: "q1_resell", title: "🤝 Reseller / Dealer", description: "Become our dealer" }
        ]}],
        phoneNumberId, token
      )
      return new Response("OK", { status: 200 })

    } catch (error) {
      console.log("Error:", error)
      return new Response("OK", { status: 200 })
    }
  }

  return new Response("Method not allowed", { status: 405 })
})