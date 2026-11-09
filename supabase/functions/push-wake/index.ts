import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "로그인이 필요합니다." }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "인증 정보를 확인할 수 없습니다." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }

  if (body.action === "public-key") {
    if (!publicKey) return json({ error: "서버의 VAPID 공개 키가 설정되지 않았습니다." }, 503);
    return json({ publicKey });
  }

  if (!publicKey || !privateKey) return json({ error: "서버 푸시 키 설정이 필요합니다." }, 503);
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (body.action === "subscribe") {
    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return json({ error: "푸시 구독 정보가 올바르지 않습니다." }, 400);
    }
    const { error } = await admin.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return json({ error: "푸시 구독 저장 실패: " + error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === "send") {
    const friendId = body.friend_id;
    if (typeof friendId !== "string" || !friendId) return json({ error: "친구 정보가 없습니다." }, 400);
    const { data: friends, error: friendsError } = await userClient.rpc("get_my_friends");
    if (friendsError) return json({ error: "친구 관계를 확인하지 못했습니다." }, 500);
    const isFriend = (friends || []).some((friend: any) => String(friend.friend_id || friend.id) === friendId);
    if (!isFriend) return json({ error: "친구로 등록된 사용자에게만 보낼 수 있습니다." }, 403);

    const { data: target, error: targetError } = await admin
      .from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", friendId).maybeSingle();
    if (targetError) return json({ error: "친구의 알림 설정을 확인하지 못했습니다." }, 500);
    if (!target) return json({ error: "친구가 아직 푸시 알림을 켜지 않았습니다." }, 404);

    const payload = JSON.stringify({
      title: "My Vocabulary · 친구 깨우기",
      body: user.user_metadata?.nickname
        ? user.user_metadata.nickname + "님이 공부를 시작하라고 깨웠어요!"
        : "친구가 공부를 시작하라고 깨웠어요!",
      url: "./",
    });
    try {
      await webpush.sendNotification({
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      }, payload, { TTL: 60 });
      return json({ ok: true, message: "친구에게 깨우기 알림을 보냈습니다." });
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("user_id", friendId);
        return json({ error: "친구의 알림 구독이 만료되었습니다. 친구가 다시 알림을 켜야 합니다." }, 410);
      }
      return json({ error: "푸시 전송 실패: " + (error?.message || "unknown error") }, 502);
    }
  }
  return json({ error: "지원하지 않는 작업입니다." }, 400);
});
