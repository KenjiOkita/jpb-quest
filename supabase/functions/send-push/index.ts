import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import * as webpush from "https://esm.sh/web-push@3.6.6"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:example@example.com"

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

serve(async (req) => {
  try {
    const { subscription, title, body, url } = await req.json()

    if (!subscription) {
      return new Response(JSON.stringify({ error: "No subscription provided" }), { status: 400 })
    }

    const payload = JSON.stringify({
      title: title || "JPB Quest Update",
      body: body || "新しい通知があります",
      url: url || "/"
    })

    await webpush.sendNotification(subscription, payload)

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
