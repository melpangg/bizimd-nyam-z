import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const members = {
  emre: { email: "emreoglum2004@gmail.com" },
  elif: { email: "emreoglum2003@gmail.com" },
} as const;

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const failedAttempts = new Map<string, { count: number; expiresAt: number }>();

function getClientIp(request: Request) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  for (const [key, attempt] of failedAttempts) {
    if (attempt.expiresAt <= now) failedAttempts.delete(key);
  }
  const attempt = failedAttempts.get(ip);
  return Boolean(attempt && attempt.count >= MAX_FAILED_ATTEMPTS && attempt.expiresAt > now);
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const attempt = failedAttempts.get(ip);
  if (!attempt || attempt.expiresAt <= now) {
    failedAttempts.set(ip, { count: 1, expiresAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  attempt.count += 1;
}

function clearFailedAttempts(ip: string) {
  failedAttempts.delete(ip);
}

function pinIsValid(input: unknown, configuredPin: string) {
  if (typeof input !== "string" || !/^\d{4}$/.test(input)) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(configuredPin));
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { action?: unknown; pin?: unknown; person?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz istek." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const configuredPin = process.env.SITE_LOGIN_PIN;
  if (!configuredPin || !/^\d{4}$/.test(configuredPin)) {
    console.error("SITE_LOGIN_PIN must be configured as a four-digit server-only value.");
    return NextResponse.json(
      { error: "Giriş sistemi sunucuda yapılandırılmamış." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!pinIsValid(body.pin, configuredPin)) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Kod yanlış. Lütfen tekrar deneyin." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  clearFailedAttempts(ip);

  if (body.action === "verify-pin") {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action !== "login" || (body.person !== "emre" && body.person !== "elif")) {
    return NextResponse.json(
      { error: "Geçersiz seçim." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    console.error("Supabase URL, publishable key, and server-only service role key are required.");
    return NextResponse.json(
      { error: "Giriş sistemi sunucuda yapılandırılmamış." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const person = body.person;
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let existingUserId: string | null = null;
  let page = 1;
  while (true) {
    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (usersError) {
      console.error("Could not look up the selected Supabase account:", usersError);
      return NextResponse.json(
        { error: "Üye hesabı doğrulanamadı. Lütfen daha sonra tekrar deneyin." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    const existingUser = users.users.find(
      user => user.email?.toLowerCase() === members[person].email,
    );
    if (existingUser) {
      existingUserId = existingUser.id;
      break;
    }
    if (!users.nextPage) break;
    page = users.nextPage;
  }

  if (!existingUserId) {
    return NextResponse.json(
      { error: "Seçilen kişi için Supabase hesabı bulunamadı." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: members[person].email,
  });
  const tokenHash = link.properties?.hashed_token;
  if (linkError || !tokenHash || link.user.id !== existingUserId) {
    console.error("Could not create a Supabase sign-in token:", linkError ?? "Generated link did not match the selected member.");
    return NextResponse.json(
      { error: "Güvenli oturum oluşturulamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (sessionError || !sessionData.session || sessionData.user?.id !== existingUserId) {
    console.error("Could not verify the generated Supabase sign-in token:", sessionError ?? "Verified session did not match the selected member.");
    return NextResponse.json(
      { error: "Güvenli oturum başlatılamadı. Lütfen tekrar deneyin." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error: setSessionError } = await authClient.auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });
  if (setSessionError) {
    console.error("Could not establish the selected member's session:", setSessionError);
    return NextResponse.json(
      { error: "Güvenli oturum başlatılamadı. Lütfen tekrar deneyin." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: member, error: memberError } = await authClient
    .from("site_members")
    .select("display_name,role")
    .eq("user_id", existingUserId)
    .maybeSingle();

  if (memberError) {
    console.error("Could not verify selected site member through its RLS policy:", memberError);
    return NextResponse.json(
      { error: "Üye bilgisi doğrulanamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!member) {
    return NextResponse.json(
      { error: "Seçilen hesap site üyeleri arasında bulunamadı." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
