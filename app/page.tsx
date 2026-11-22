"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Person = "emre" | "elif";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verifyPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-pin", pin }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Kod doğrulanamadı.");
        return;
      }
      setPerson(null);
      setStep(2);
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  async function enterSite() {
    if (!person) return;
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", pin, person }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Giriş yapılamadı.");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) {
        setError("Oturum başlatılamadı. Lütfen tekrar deneyin.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="glow glow-one" /><div className="glow glow-two" />
      <section className="login-card">
        <div className="tiny-label">SADECE İKİMİZE ÖZEL</div>
        <div className="heart-mark">♥</div>
        <h1>Elif <span>&</span> Emre</h1>
        <p className="subtitle">Bizim küçük dünyamıza hoş geldin.</p>
        {step === 1 ? (
          <form onSubmit={verifyPin}>
            <label className="field-label" htmlFor="pin">Giriş kodu</label>
            <div className="pin-entry">
              <input
                className="pin-input"
                id="pin"
                type={pinVisible ? "text" : "password"}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                required
              />
              <button
                type="button"
                className="pin-visibility"
                aria-label={pinVisible ? "Giriş kodunu gizle" : "Giriş kodunu göster"}
                aria-pressed={pinVisible}
                onClick={() => setPinVisible(visible => !visible)}
              >{pinVisible ? "Gizle" : "Göster"} <span aria-hidden="true">{pinVisible ? "◉" : "◎"}</span></button>
            </div>
            <button className="primary-button" disabled={busy || pin.length !== 4}>
              {busy ? "Kod kontrol ediliyor..." : "Devam et ♥"}
            </button>
          </form>
        ) : (
          <div>
            <p className="field-label">Kim giriş yapıyor?</p>
            <div className="person-switch" role="group" aria-label="Giriş yapacak kişiyi seçin">
              <button
                type="button"
                className={`person-profile person-profile-elif${person === "elif" ? " is-selected" : ""}`}
                aria-pressed={person === "elif"}
                onClick={() => setPerson("elif")}
              >
                <span className="person-avatar person-avatar-elif" aria-hidden="true">🌷</span>
                <span className="person-profile-copy"><strong>Elif</strong><small>Elif&apos;in hesabı</small></span>
                <span className="person-profile-mark" aria-hidden="true">{person === "elif" ? "✓" : "♡"}</span>
              </button>
              <button
                type="button"
                className={`person-profile person-profile-emre${person === "emre" ? " is-selected" : ""}`}
                aria-pressed={person === "emre"}
                onClick={() => setPerson("emre")}
              >
                <span className="person-avatar person-avatar-emre" aria-hidden="true">🌿</span>
                <span className="person-profile-copy"><strong>Emre</strong><small>Emre&apos;nin hesabı</small></span>
                <span className="person-profile-mark" aria-hidden="true">{person === "emre" ? "✓" : "♡"}</span>
              </button>
            </div>
            <button className="primary-button" disabled={busy || !person} onClick={enterSite}>
              {busy ? "Dünyamız açılıyor..." : "Dünyamıza gir ♥"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => { setStep(1); setPin(""); setPinVisible(false); setPerson(null); setError(""); }}
            >← Geri</button>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="login-foot">Her gün yeniden, birlikte. ✨</p>
      </section>
    </main>
  );
}
