 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { supabase, supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

type Member = { display_name: string; role: "admin" | "member" };
type Mood = { id: string; score: number; note: string | null; mood_date: string; user_id: string };
type Todo = { id: string; title: string; completed: boolean; completed_at: string | null };
type Coupon = {
  id: string;
  emoji: string;
  title: string;
  description: string | null;
  active: boolean;
  redeemed_at: string | null;
};
type Photo = {
  id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  signed_url?: string;
  uploader_name?: string;
};
type ChatMessage = { id: string; chat_date: string; sender_id: string; body: string; created_at: string };
type StrawberryMessage = { id: string; role: "user" | "model"; content: string };
type StrawberryMemoryRecord = {
  id: string;
  kind: "memory" | "settings";
  content: string | null;
  enabled: boolean;
  created_at: string;
};
type SupabaseErrorInfo = { message: string; code?: string };

const DAILY_SURPRISES = [
  "Kalbim, en sevdiği yerin senin yanın olduğunu her gün yeniden hatırlıyor. 💗",
  "Seninle sıradan bir gün bile en güzel anımıza dönüşüyor. 🌷",
  "Gülüşün, günümün bütün renklerini güzelleştiriyor. ✨",
  "İyi ki yollarımız kesişmiş, iyi ki hikâyemiz biz olmuş. 🍓",
  "Sana olan sevgim, her gün biraz daha açan bir çiçek gibi. 🌸",
  "En huzurlu yerim, seninle paylaştığım her an. 💞",
  "Bugün de kalbim seni, dünden daha çok seçiyor. 💖",
  "Birlikte biriktirdiğimiz küçücük anlar, en büyük mutluluğum. 🦋",
  "Bugün kendime yine şanslı olduğumu söyledim; sonra seni düşündüm. 🍓",
  "Aklımın en sevdiği yeri sorarlarsa, “senin yanın” derim. 💗",
  "Sana kocaman bir sarılma borcum var; faizi de öpücük. 😘",
  "Seninle gülmek, günün en güzel planı. ✨",
  "Çilekler tatlı, ama senden gelen bir mesaj daha tatlı. 🍓",
  "Her gün kalbime biraz daha “iyi ki” dedirtiyorsun. 🌸",
  "En sevdiğim bildirim, senden gelen her şey. 💌",
  "Sen yanımdayken pazartesi bile minik bir cuma gibi. 🌷",
  "Dünyanın en sevdiğim tesadüfü sensin. 💞",
  "Bugün de aklımdan geçtin; kalbim zaten senden çıkmıyor. ❤️",
  "Birlikteyken zaman uçuyor, sensizken de seni düşünüyorum. ✨",
  "Minik not: seni düşündüm, gülümsedim, tekrar düşündüm. 💖",
  "Kalbimin favori kişisi sensin; başka aday yok. 💗",
  "Seninle kurduğum hayaller, en sevdiğim gece ışıkları. ⭐",
  "Gözlerin görünce içimde bütün çiçekler açıyor. 🌼",
  "Güzel günümün kısa tarifi: sen, ben ve bol kahkaha. 🍓",
  "Seni özlemek bile tatlı; çünkü sonunda sana kavuşuyorum. 💌",
  "Kalbim sana her gün yeniden “evet” diyor. ❤️",
  "En güzel maceram, seninle aynı takımda olmak. 💚",
  "Yıldızlar bu gece yine bize göz kırpıyor olabilir. ✨",
  "Sen gülünce içimde minik bir festival başlıyor. 🎉",
  "Bu mesajı okurken gülümsediysen görev tamam. 🥰",
  "Bir ömürlük çilekli pasta olsa, ilk dilimi sana saklarım. 🍓",
  "Sana olan sevgim sınırsız; sarılma kotam da öyle. 💞",
  "Kalbimin ev adresi sorulursa, senin yanın derim. 🏡",
  "Seninle en sessiz an bile çok güzel bir sohbet. 🌙",
  "Bugünün küçük sırrı: sana hayranlığım hâlâ artıyor. 💖",
  "İyi ki varsın; dünya seninle daha renkli. 🌷",
];
const MOOD_DESCRIPTIONS = [
  "Özlemim hafif, içim huzurlu",
  "Aklımdasın, tatlı tatlı gülümsüyorum",
  "Özlemim hafif ama sesini duymak güzel olur",
  "Aklıma düştün yine",
  "Bugün kalbim seni arıyor",
  "Seni düşününce içim ısınıyor",
  "İçim kıpır kıpır",
  "Sana sımsıkı sarılmak istiyorum",
  "Yanımda olsan ne güzel olurdu",
  "Seni çok özledim",
];
const CHAT_TIME_ZONE = "Europe/Istanbul";
const TODO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const COUPON_EMOJI_OPTIONS = [
  ["💗", "Kalp"],
  ["🤗", "Sarılma"],
  ["☕", "Kahve"],
  ["🍰", "Tatlı"],
  ["💐", "Çiçek"],
  ["👑", "Prenses"],
  ["🍓", "Çilek"],
  ["🍿", "Film"],
  ["🎁", "Sürpriz"],
  ["💆‍♀️", "Masaj"],
  ["🚗", "Gezi"],
  ["💌", "Sevgi notu"],
] as const;

function isTodoVisible(todo: Todo, now = Date.now()) {
  if (!todo.completed || !todo.completed_at) return true;
  const completedAt = Date.parse(todo.completed_at);
  return !Number.isFinite(completedAt) || now - completedAt < TODO_RETENTION_MS;
}

function describeSupabaseError(action: string, error: SupabaseErrorInfo) {
  if (/permission denied for (table|sequence|schema)/i.test(error.message)) {
    return `${action}. Supabase tablo/sequence yetkisi (GRANT) eksik: ${error.message}`;
  }
  const denied = error.code === "42501" || /row-level security|not allowed/i.test(error.message);
  return denied
    ? `${action}. Site üyeliği ve RLS izinleri erişimi reddetti: ${error.message}`
    : `${action}: ${error.message}`;
}

function getChatDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const dateParts = { year: "", month: "", day: "" };
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      dateParts[part.type] = part.value;
    }
  }
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function getMillisecondsUntilNextChatDay(now = new Date()) {
  const currentDate = getChatDate(now);
  let low = now.getTime();
  let high = low + 36 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (getChatDate(new Date(middle)) === currentDate) low = middle;
    else high = middle;
  }
  return high - now.getTime();
}

function formatChatDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: CHAT_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatChatTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: CHAT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatPhotoRemaining(expiresAt: string, now = Date.now()) {
  const remaining = Date.parse(expiresAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Kalan süre: az önce";
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Kalan süre: ${hours}s ${minutes}dk`;
  return `Kalan süre: ${minutes}dk`;
}

function getFlowerStage(growthDays: number) {
  const day = Math.max(0, Math.min(10, Math.floor(growthDays)));
  if (day === 0) return "Tohumumuz toprağa emanet";
  if (day === 1) return "İlk filizimiz uyanıyor";
  if (day <= 3) return "İki minik yaprak";
  if (day <= 6) return "Gövdemiz güçleniyor";
  if (day <= 9) return "Tomurcuk açmaya hazırlanıyor";
  return "Sevgimiz çiçek açtı";
}

function FlowerIllustration({ growthDays, wilted }: { growthDays: number; wilted: boolean }) {
  const day = Math.max(0, Math.min(10, Math.floor(growthDays)));
  const stemProgress = [0, 0.16, 0.29, 0.38, 0.5, 0.59, 0.68, 0.78, 0.85, 0.92, 1][day];

  return (
    <figure className={`flower-art day-${day}${wilted ? " is-wilted" : ""}`} role="img" aria-label={getFlowerStage(day)}>
      <svg className="flower-illustration" viewBox="0 0 260 240" aria-hidden="true">
        <path className="flower-cloud" d="M17 61c10-13 30-10 34 3 12-6 25 3 24 15H20c-9 0-11-11-3-18Z" fill="#fff" opacity=".66" />
        <circle className="flower-sun" cx="218" cy="39" r="17" fill="#ffe5a7" opacity=".8" />
        <ellipse cx="130" cy="216" rx="83" ry="15" fill="#f4d8c1" />
        <path
          className="flower-stem"
          d="M130 211c-8-35 8-77 0-132"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - stemProgress * 100}
        />
        {day === 0 && <g className="flower-seed"><ellipse cx="130" cy="205" rx="8" ry="5" /><path d="M127 204q4-4 7 0" /></g>}
        {day === 1 && <LeafPair y={190} size={8} />}
        {day >= 2 && <LeafPair y={171} size={14} />}
        {day >= 4 && <LeafPair y={145} size={18} />}
        {day >= 7 && (
          <g className={`flower-bloom day-${day}`}>
            <path className="flower-calyx" d="M130 100c-13 1-17-7-18-15 9 2 14 5 18 11 4-6 9-9 18-11-1 8-5 16-18 15Z" />
            <ellipse className="flower-bud" cx="130" cy="82" rx="12" ry="20" />
            <g className="flower-petals">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                <ellipse key={angle} cx="130" cy="55" rx="10" ry="21" transform={`rotate(${angle} 130 82)`} />
              ))}
            </g>
            <circle className="flower-center" cx="130" cy="82" r="10" />
          </g>
        )}
      </svg>
    </figure>
  );
}

function CilekAvatar({ className }: { className: string }) {
  return (
    <span className={`cilek-avatar ${className}`} role="img" aria-label="Çilek Kız Yardımcı Asistanı">
      <Image
        className="cilek-avatar-image"
        src="/images/cilek-kiz.png"
        alt=""
        width={96}
        height={96}
        unoptimized
      />
    </span>
  );
}

function LeafPair({ y, size }: { y: number; size: number }) {
  return (
    <g className="flower-leaf-pair">
      <ellipse cx="116" cy={y} rx={size} ry={size * 0.56} transform={`rotate(28 116 ${y})`} />
      <ellipse cx="144" cy={y} rx={size} ry={size * 0.56} transform={`rotate(-28 144 ${y})`} />
      <path d={`M130 ${y + 6}q-7-7-13-9m13 9q7-7 13-9`} />
    </g>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [userId, setUserId] = useState("");
  const [moods, setMoods] = useState<Mood[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoError, setTodoError] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);
  const [updatingTodos, setUpdatingTodos] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponError, setCouponError] = useState("");
  const [couponPollEnabled, setCouponPollEnabled] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [newCoupon, setNewCoupon] = useState("");
  const [newCouponDescription, setNewCouponDescription] = useState("");
  const [newCouponEmoji, setNewCouponEmoji] = useState("💗");
  const [editCouponTitle, setEditCouponTitle] = useState("");
  const [editCouponDescription, setEditCouponDescription] = useState("");
  const [editCouponEmoji, setEditCouponEmoji] = useState("💗");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [photoPollEnabled, setPhotoPollEnabled] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [photoClock, setPhotoClock] = useState(Date.now());
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [currentChatDate, setCurrentChatDate] = useState(() => getChatDate());
  const [archiveDate, setArchiveDate] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(true);
  const [strawberryAssistantOpen, setStrawberryAssistantOpen] = useState(false);
  const [strawberryAssistantDraft, setStrawberryAssistantDraft] = useState("");
  const [strawberryAssistantMessages, setStrawberryAssistantMessages] = useState<StrawberryMessage[]>([]);
  const [strawberryAssistantError, setStrawberryAssistantError] = useState("");
  const [strawberryAssistantSending, setStrawberryAssistantSending] = useState(false);
  const [strawberryMemories, setStrawberryMemories] = useState<StrawberryMemoryRecord[]>([]);
  const [strawberryMemorySettingId, setStrawberryMemorySettingId] = useState<string | null>(null);
  const [strawberryMemoryEnabled, setStrawberryMemoryEnabled] = useState(true);
  const [strawberryMemoryDraft, setStrawberryMemoryDraft] = useState("");
  const [strawberryMemoryError, setStrawberryMemoryError] = useState("");
  const [strawberryMemoryLoading, setStrawberryMemoryLoading] = useState(true);
  const [strawberryMemoryReady, setStrawberryMemoryReady] = useState(false);
  const [strawberryMemoryBusy, setStrawberryMemoryBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatTableUnavailable, setChatTableUnavailable] = useState(false);
  const [chatNotice, setChatNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [chatSendAnimation, setChatSendAnimation] = useState(0);
  const [message, setMessage] = useState("");
  const [messageDate, setMessageDate] = useState<string | null>(null);
  const [flower, setFlower] = useState<{ growth_days: number; wilted: boolean; last_watered: string | null } | null>(null);
  const [wateringAnimation, setWateringAnimation] = useState(0);
  const [fertilizeAnimation, setFertilizeAnimation] = useState(0);
  const [moodScore, setMoodScore] = useState(7);
  const [moodNote, setMoodNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [relationshipSeconds, setRelationshipSeconds] = useState(0);
  const chatRequestId = useRef(0);
  const [todoPollEnabled, setTodoPollEnabled] = useState(false);
  const dailyMessageRequestId = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const strawberryAssistantEndRef = useRef<HTMLDivElement>(null);
  const previousLastChatMessageId = useRef<string | null>(null);
  const activeChatDate = archiveDate ?? currentChatDate;
  const isViewingChatArchive = activeChatDate !== currentChatDate;
  const canManageCoupons = member?.display_name === "Emre" && member.role === "admin";

  const loadChatMessages = useCallback(async (date: string, showLoading = false) => {
    const requestId = ++chatRequestId.current;
    if (showLoading) setChatLoading(true);
    const { data, error } = await supabase.from("daily_chat_messages")
      .select("id,chat_date,sender_id,body,created_at")
      .eq("chat_date", date)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (requestId !== chatRequestId.current) return;
    if (error) {
      const tableUnavailable = error.code === "42P01"
        || error.code === "PGRST205"
        || error.message.includes("Could not find the table");
      setChatTableUnavailable(tableUnavailable);
      setChatError(tableUnavailable
        ? `Sohbet tablosu henüz oluşturulmamış: ${error.message}`
        : `Sohbet mesajları alınamadı: ${error.message}`);
      setChatMessages([]);
    } else {
      setChatTableUnavailable(false);
      setChatError("");
      setChatMessages((data ?? []) as ChatMessage[]);
    }
    setChatLoading(false);
  }, []);

  const loadDailyMessage = useCallback(async (date: string) => {
    const requestId = ++dailyMessageRequestId.current;
    const { data, error } = await supabase.from("daily_messages")
      .select("message")
      .eq("message_date", date)
      .maybeSingle();
    if (requestId !== dailyMessageRequestId.current) return;
    if (error) {
      setMessage("");
      setMessageDate(null);
      setNotice(`Günün sürprizi alınamadı: ${error.message}`);
      return;
    }
    setMessage(data?.message ?? "");
    setMessageDate(data?.message ? date : null);
  }, []);

  const loadTodos = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("todos")
        .select("id,title,completed,completed_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setTodoError("");
      setTodoPollEnabled(true);
      setTodos(((data ?? []) as Todo[]).filter(isTodoVisible));
    } catch (error) {
      setTodoError(error instanceof Error ? error.message : String(error));
      setTodoPollEnabled(false);
    }
  }, []);

  useEffect(() => {
    const startedAt = new Date(2026, 0, 11, 0, 0, 0).getTime();
    const updateCounter = () => setRelationshipSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateCounter();
    const timer = window.setInterval(updateCounter, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer: number;
    const scheduleNextDay = () => {
      timer = window.setTimeout(() => {
        setCurrentChatDate(getChatDate());
        scheduleNextDay();
      }, getMillisecondsUntilNextChatDay() + 25);
    };
    scheduleNextDay();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadDailyMessage(currentChatDate);
  }, [currentChatDate, loadDailyMessage, userId]);

  useEffect(() => {
    if (!userId || chatTableUnavailable) return;
    void loadChatMessages(activeChatDate, true);
    if (isViewingChatArchive) return;
    const timer = window.setInterval(() => void loadChatMessages(activeChatDate), 5_000);
    return () => window.clearInterval(timer);
  }, [activeChatDate, chatTableUnavailable, isViewingChatArchive, loadChatMessages, userId]);

  useEffect(() => {
    if (!userId || !todoPollEnabled) return;
    const timer = window.setInterval(() => void loadTodos(), 5_000);
    return () => window.clearInterval(timer);
  }, [loadTodos, todoPollEnabled, userId]);

  useEffect(() => {
    const lastMessageId = chatMessages[chatMessages.length - 1]?.id ?? null;
    if (lastMessageId && lastMessageId !== previousLastChatMessageId.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    previousLastChatMessageId.current = lastMessageId;
  }, [chatMessages]);

  useEffect(() => {
    if (strawberryAssistantOpen) {
      strawberryAssistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [strawberryAssistantMessages, strawberryAssistantOpen, strawberryAssistantSending]);

  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhotoIndex(null);
      if (photos.length === 0) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedPhotoIndex(index => index === null ? null : (index + 1) % photos.length);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedPhotoIndex(index => index === null ? null : (index + photos.length - 1) % photos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photos.length, selectedPhotoIndex]);

  const relationshipDays = Math.floor(relationshipSeconds / 86400);
  const relationshipHours = Math.floor((relationshipSeconds % 86400) / 3600);
  const relationshipMinutes = Math.floor((relationshipSeconds % 3600) / 60);
  const relationshipSecs = relationshipSeconds % 60;

  const today = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const surpriseIndex = Math.floor(Date.parse(`${currentChatDate}T00:00:00Z`) / 86_400_000) % DAILY_SURPRISES.length;
  const todaySurprise = DAILY_SURPRISES[surpriseIndex];
  const welcomeMessage = messageDate === currentChatDate && message ? message : todaySurprise;
  const completedTodoCount = todos.filter(todo => todo.completed).length;
  const todoProgress = todos.length === 0 ? 0 : Math.round((completedTodoCount / todos.length) * 100);
  const moodDescription = MOOD_DESCRIPTIONS[moodScore - 1];
  const moodEmoji = moodScore <= 3 ? "🥺" : moodScore <= 7 ? "💞" : "💗";
  const selectedPhoto = selectedPhotoIndex === null ? null : photos[selectedPhotoIndex] ?? null;
  const selectedPhotoUrl = selectedPhoto
    ? selectedPhoto.signed_url ?? ""
    : "";

  function chooseChatDate(date: string) {
    if (date) setArchiveDate(date === currentChatDate ? null : date);
  }

  async function sendChatMessage() {
    const body = chatDraft.trim();
    if (!body || sendingChatMessage || isViewingChatArchive || chatError) return;
    setSendingChatMessage(true);
    setChatNotice(null);
    try {
      const { error } = await supabase.from("daily_chat_messages").insert({ body });
      if (error) {
        setChatNotice({ type: "error", text: `Mesaj gönderilemedi: ${error.message}` });
        return;
      }
      setChatDraft("");
      setChatSendAnimation(value => value + 1);
      setChatNotice({ type: "success", text: "Mesajın ulaştı! 💌" });
      await loadChatMessages(activeChatDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChatNotice({ type: "error", text: `Mesaj gönderilemedi: ${message}` });
    } finally {
      setSendingChatMessage(false);
    }
  }

  async function sendStrawberryAssistantMessage() {
    const content = strawberryAssistantDraft.trim();
    if (!content || strawberryAssistantSending) return;

    const userMessage: StrawberryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...strawberryAssistantMessages, userMessage];
    setStrawberryAssistantMessages(nextMessages);
    setStrawberryAssistantDraft("");
    setStrawberryAssistantError("");
    setStrawberryAssistantSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Oturumun doğrulanamadı. Lütfen yeniden giriş yap.");
      }

      let context = nextMessages.slice(-30);
      if (context[0]?.role === "model") context = context.slice(1);

      const response = await fetch("/api/strawberry-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: context.map(message => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const result = await response.json().catch(() => null) as { reply?: unknown; error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof result?.error === "string"
          ? result.error
          : "Çilek'e şu an ulaşılamıyor. Biraz sonra tekrar deneyelim 💗");
      }
      if (typeof result?.reply !== "string" || !result.reply.trim()) {
        throw new Error("Çilek bu kez yanıt oluşturamadı. Lütfen tekrar dene.");
      }

      const reply = result.reply.trim();
      setStrawberryAssistantMessages(current => [
        ...current,
        { id: crypto.randomUUID(), role: "model", content: reply },
      ]);
    } catch (error) {
      setStrawberryAssistantMessages(current => current.filter(message => message.id !== userMessage.id));
      setStrawberryAssistantDraft(content);
      setStrawberryAssistantError(error instanceof Error
        ? error.message
        : "Çilek'e şu an ulaşılamıyor. Biraz sonra tekrar deneyelim 💗");
    } finally {
      setStrawberryAssistantSending(false);
    }
  }

  async function saveStrawberryMemory() {
    const content = strawberryMemoryDraft.trim();
    if (
      member?.display_name !== "Elif"
      || !userId
      || !strawberryMemoryReady
      || !strawberryMemoryEnabled
      || !content
      || content.length > 500
      || strawberryMemoryBusy
    ) return;

    setStrawberryMemoryBusy(true);
    setStrawberryMemoryError("");
    try {
      const { error } = await supabase.from("strawberry_memories").insert({
        user_id: userId,
        kind: "memory",
        content,
      });
      if (error) {
        setStrawberryMemoryError(describeSupabaseError("Hafıza kaydedilemedi", error));
        return;
      }
      setStrawberryMemoryDraft("");
      await loadStrawberryMemories(userId);
    } catch (error) {
      setStrawberryMemoryError(`Hafıza kaydedilemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStrawberryMemoryBusy(false);
    }
  }

  async function toggleStrawberryMemory() {
    if (!userId || !strawberryMemoryReady || strawberryMemoryBusy) return;
    const enabled = !strawberryMemoryEnabled;
    setStrawberryMemoryBusy(true);
    setStrawberryMemoryError("");
    try {
      if (strawberryMemorySettingId) {
        const { error } = await supabase.from("strawberry_memories")
          .update({ enabled })
          .eq("id", strawberryMemorySettingId)
          .eq("user_id", userId)
          .eq("kind", "settings");
        if (error) {
          setStrawberryMemoryError(describeSupabaseError("Hafıza ayarı değiştirilemedi", error));
          return;
        }
      } else {
        const { data, error } = await supabase.from("strawberry_memories")
          .insert({ user_id: userId, kind: "settings", content: null, enabled })
          .select("id")
          .single();
        if (error) {
          setStrawberryMemoryError(describeSupabaseError("Hafıza ayarı değiştirilemedi", error));
          return;
        }
        setStrawberryMemorySettingId(data.id);
      }
      setStrawberryMemoryEnabled(enabled);
    } catch (error) {
      setStrawberryMemoryError(`Hafıza ayarı değiştirilemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStrawberryMemoryBusy(false);
    }
  }

  async function deleteStrawberryMemory(memoryId: string) {
    if (!userId || !strawberryMemoryReady || strawberryMemoryBusy) return;
    setStrawberryMemoryBusy(true);
    setStrawberryMemoryError("");
    try {
      const { error } = await supabase.from("strawberry_memories")
        .delete()
        .eq("id", memoryId)
        .eq("user_id", userId)
        .eq("kind", "memory");
      if (error) {
        setStrawberryMemoryError(describeSupabaseError("Hafıza silinemedi", error));
        return;
      }
      setStrawberryMemories(current => current.filter(memory => memory.id !== memoryId));
    } catch (error) {
      setStrawberryMemoryError(`Hafıza silinemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStrawberryMemoryBusy(false);
    }
  }

  async function deleteAllStrawberryMemories() {
    if (
      !userId
      || !strawberryMemoryReady
      || strawberryMemoryBusy
      || strawberryMemories.length === 0
      || !window.confirm("Çilek'in kaydettiği tüm notlar silinsin mi?")
    ) return;

    setStrawberryMemoryBusy(true);
    setStrawberryMemoryError("");
    try {
      const { error } = await supabase.from("strawberry_memories")
        .delete()
        .eq("user_id", userId)
        .eq("kind", "memory");
      if (error) {
        setStrawberryMemoryError(describeSupabaseError("Hafıza silinemedi", error));
        return;
      }
      setStrawberryMemories([]);
    } catch (error) {
      setStrawberryMemoryError(`Hafıza silinemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStrawberryMemoryBusy(false);
    }
  }

  async function loadFlower() {
    const { data, error } = await supabase.from("flower_state")
      .select("growth_days,wilted,last_watered").eq("id", 1).maybeSingle();
    if (error) {
      setNotice(`Çiçek durumu alınamadı: ${error.message}`);
      return;
    }
    setFlower(data);
  }

  const loadCoupons = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("coupons")
        .select("*").eq("active", true).order("created_at", { ascending: false });
      if (error) {
        setCouponError(describeSupabaseError("Kuponlar yüklenemedi", error));
        setCouponPollEnabled(false);
        return;
      }
      setCoupons((data ?? []) as Coupon[]);
      setCouponError("");
      setCouponPollEnabled(true);
    } catch (error) {
      setCouponError(`Kuponlar yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
      setCouponPollEnabled(false);
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("photos")
        .select("*").order("created_at", { ascending: false }).limit(30);
      if (error) {
        setPhotoError(describeSupabaseError("Fotoğraf albümü yüklenemedi", error));
        setPhotoPollEnabled(false);
        return;
      }
      const photoRows = (data ?? []) as Photo[];
      const { data: members } = await supabase
        .from("site_members")
        .select("user_id,display_name");
      const memberNames = new Map(
        (members ?? []).map(memberRow => [memberRow.user_id as string, memberRow.display_name as string])
      );
      const withUrls = await Promise.all(photoRows.map(async photo => {
        const { data: signed, error: signedError } = await supabase.storage
          .from("love-photos")
          .createSignedUrl(photo.storage_path, 3600);
        return {
          ...photo,
          uploader_name: memberNames.get(photo.uploaded_by) ?? "Bizim dünyamız",
          signed_url: signedError ? undefined : signed?.signedUrl,
        };
      }));
      setPhotos(withUrls);
      setPhotoError("");
      setPhotoPollEnabled(true);
    } catch (error) {
      setPhotoError(`Fotoğraf albümü yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
      setPhotoPollEnabled(false);
    }
  }, []);

  const loadStrawberryMemories = useCallback(async (uid: string) => {
    setStrawberryMemoryLoading(true);
    setStrawberryMemoryError("");
    try {
      const { data, error } = await supabase.from("strawberry_memories")
        .select("id,kind,content,enabled,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) {
        const tableUnavailable = error.code === "42P01"
          || error.code === "PGRST205"
          || error.message.includes("Could not find the table");
        setStrawberryMemories([]);
        setStrawberryMemorySettingId(null);
        setStrawberryMemoryReady(false);
        setStrawberryMemoryError(tableUnavailable
          ? "Hafıza tablosu henüz kurulmamış. Supabase migration dosyasını uyguladıktan sonra yeniden dene."
          : describeSupabaseError("Çilek'in hafızası yüklenemedi", error));
        return;
      }

      const records = (data ?? []) as StrawberryMemoryRecord[];
      const settings = records.find(record => record.kind === "settings");
      setStrawberryMemorySettingId(settings?.id ?? null);
      setStrawberryMemoryEnabled(settings?.enabled ?? true);
      setStrawberryMemories(records.filter(record => record.kind === "memory"));
      setStrawberryMemoryReady(true);
    } catch (error) {
      setStrawberryMemoryReady(false);
      setStrawberryMemoryError(`Çilek'in hafızası yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStrawberryMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (member?.display_name !== "Elif" || !userId) return;
    void loadStrawberryMemories(userId);
  }, [loadStrawberryMemories, member?.display_name, userId]);

  useEffect(() => {
    if (!userId) return;
    const timers: number[] = [];
    if (couponPollEnabled) timers.push(window.setInterval(() => void loadCoupons(), 10_000));
    if (photoPollEnabled) timers.push(window.setInterval(() => void loadPhotos(), 10_000));
    return () => timers.forEach(timer => window.clearInterval(timer));
  }, [couponPollEnabled, loadCoupons, loadPhotos, photoPollEnabled, userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setPhotoClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`coupons-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, () => {
        void loadCoupons();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "coupon_redemptions" }, () => {
        void loadCoupons();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCoupons, userId]);

  async function loadAll(uid: string) {
    const [m] = await Promise.all([
      supabase.from("daily_moods").select("*").order("mood_date", { ascending: false }).limit(14),
      loadCoupons(),
      loadPhotos(),
    ]);
    if (m.data) setMoods(m.data as Mood[]);
    await Promise.all([loadFlower(), loadTodos()]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace("/"); return; }
      setUserId(data.user.id);
      const { data: profile } = await supabase.from("site_members").select("display_name,role").eq("user_id", data.user.id).maybeSingle();
      if (!profile) { await supabase.auth.signOut(); router.replace("/"); return; }
      setMember(profile as Member);
      await loadAll(data.user.id);
    })();
    return () => { active = false; };
  }, [router, today]);

  async function submitMood() {
    const { error } = await supabase.from("daily_moods").upsert({
      user_id: userId, score: moodScore, note: moodNote, mood_date: today
    }, { onConflict: "user_id,mood_date" });
    setNotice(error ? `Duygu kaydı eklenemedi: ${error.message}` : "Bugünkü hislerin kaydedildi. ♥");
    if (!error) { setMoodNote(""); await loadAll(userId); }
  }

  async function waterFlower() {
    const { error } = await supabase.rpc("water_love_flower");
    if (error) {
      setNotice(error.message.includes("Bugün çiçek zaten sulandı.")
        ? "Bugün çiçeği zaten suladınız. 🌷"
        : `Çiçek sulanamadı: ${error.message}`);
      return;
    }
    setNotice("Çiçeğimiz biraz daha büyüdü! 🌷");
    setWateringAnimation(value => value + 1);
    await loadAll(userId);
  }

  async function fertilize() {
    if (member?.role !== "admin") return;
    const { error } = await supabase.from("flower_state").update({
      growth_days: 0, wilted: false, updated_at: new Date().toISOString()
    }).eq("id", 1);
    setNotice(error ? error.message : "Çiçek yeniden canlandı! 🌸");
    if (!error) setFertilizeAnimation(value => value + 1);
    await loadAll(userId);
  }

  async function addTodo() {
    const title = newTodo.trim();
    if (!title || addingTodo) return;
    setAddingTodo(true);
    try {
      const { error } = await supabase.from("todos").insert({ title, created_by: userId });
      if (error) {
        setNotice(`Görev eklenemedi: ${error.message}`);
        return;
      }
      setNewTodo("");
      setNotice("Görev birlikte yapılacaklar listesine eklendi. ♥");
      await loadTodos();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(`Görev eklenemedi: ${message}`);
    } finally {
      setAddingTodo(false);
    }
  }

  async function toggleTodo(todo: Todo) {
    if (updatingTodos) return;
    const completed = !todo.completed;
    setUpdatingTodos(true);
    try {
      const { error } = await supabase.from("todos").update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", todo.id);
      if (error) {
        setNotice(`Görev güncellenemedi: ${error.message}`);
        return;
      }
      setNotice(completed ? "Birlikte başardınız! 🌱" : "Görev yeniden açıldı. ♥");
      await loadTodos();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(`Görev güncellenemedi: ${message}`);
    } finally {
      setUpdatingTodos(false);
    }
  }

  async function addDailyMessage() {
    if (!newMessage.trim()) return;
    const { error } = await supabase.from("daily_messages").upsert({
      message_date: currentChatDate, message: newMessage.trim(), created_by: userId
    }, { onConflict: "message_date" });
    setNotice(error ? error.message : "Bugünün sevgi notu yayınlandı.");
    setNewMessage("");
    if (!error) await loadDailyMessage(currentChatDate);
    await loadAll(userId);
  }

  async function addCoupon() {
    const title = newCoupon.trim();
    if (!canManageCoupons || !title || couponBusy) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const { error } = await supabase.from("coupons").insert({
        emoji: newCouponEmoji,
        title,
        description: newCouponDescription.trim() || null,
        active: true,
      });
      if (error) {
        setCouponError(describeSupabaseError("Kupon eklenemedi", error));
        return;
      }
      setNewCoupon("");
      setNewCouponDescription("");
      setNewCouponEmoji("💗");
      setNotice("Kupon eklendi. 💗");
      await loadCoupons();
    } catch (error) {
      setCouponError(`Kupon eklenemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCouponBusy(false);
    }
  }

  async function saveCoupon(id: string) {
    const title = editCouponTitle.trim();
    if (!canManageCoupons || !title || couponBusy || editingCouponId !== id) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const { error } = await supabase.from("coupons").update({
        emoji: editCouponEmoji,
        title,
        description: editCouponDescription.trim() || null,
      }).eq("id", id);
      if (error) {
        setCouponError(describeSupabaseError("Kupon düzenlenemedi", error));
        return;
      }
      setEditingCouponId(null);
      setNotice("Kupon güncellendi. ✨");
      await loadCoupons();
    } catch (error) {
      setCouponError(`Kupon düzenlenemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon(coupon: Coupon) {
    if (!canManageCoupons || couponBusy || !window.confirm(`“${coupon.title}” kuponu listeden kaldırılsın mı? Kullanım geçmişi korunur.`)) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const { error } = await supabase.from("coupons").update({ active: false }).eq("id", coupon.id);
      if (error) {
        setCouponError(describeSupabaseError("Kupon kaldırılamadı", error));
        return;
      }
      if (editingCouponId === coupon.id) setEditingCouponId(null);
      setNotice("Kupon listeden kaldırıldı; kullanım geçmişi korundu.");
      await loadCoupons();
    } catch (error) {
      setCouponError(`Kupon kaldırılamadı: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCouponBusy(false);
    }
  }

  async function redeemCoupon(id: string) {
    const coupon = coupons.find(item => item.id === id);
    if (!coupon || coupon.redeemed_at || couponBusy) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const { data, error } = await supabase.rpc("redeem_love_coupon", { coupon_id_text: id });
      if (error) {
        if (error.message.includes("daha önce kullanıldı")) {
          setNotice("Bu kupon daha önce kullanıldı. ❤️");
          await loadCoupons();
        } else {
          setCouponError(describeSupabaseError("Kupon kullanılamadı", error));
        }
        return;
      }
      if (typeof data !== "string") {
        setCouponError("Kupon kullanım sonucu doğrulanamadı. Listeyi yenileyip tekrar kontrol edin.");
        await loadCoupons();
        return;
      }
      setCoupons(current => current.map(item => item.id === id
        ? { ...item, redeemed_at: data }
        : item));
      setNotice("Kupon kullanıldı! ❤️");
      await loadCoupons();
    } catch (error) {
      setCouponError(`Kupon kullanılamadı: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCouponBusy(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file || uploadingPhoto) return;
    if (!PHOTO_ALLOWED_TYPES.has(file.type)) {
      setPhotoError("Lütfen JPEG, PNG, WebP veya GIF formatında bir fotoğraf seçin.");
      return;
    }
    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      setPhotoError("Fotoğraf 10 MB boyut sınırını aşamaz.");
      return;
    }
    setPhotoError("");
    setUploadingPhoto(true);
    setPhotoUploadProgress(1);
    const safeName = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "-")}`;
    const bucket = supabase.storage.from("love-photos");
    let storageUploadCompleted = false;
    try {
      if (!supabaseUrl || !supabasePublishableKey) {
        throw new Error("Supabase yapılandırması eksik.");
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");

      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", `${supabaseUrl}/storage/v1/object/love-photos/${safeName.split("/").map(encodeURIComponent).join("/")}`);
        request.setRequestHeader("apikey", supabasePublishableKey);
        request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        request.setRequestHeader("x-upsert", "false");
        request.setRequestHeader("Cache-Control", "3600");
        request.setRequestHeader("Content-Type", file.type);
        request.upload.onprogress = event => {
          if (event.lengthComputable) {
            setPhotoUploadProgress(Math.max(1, Math.min(94, Math.round((event.loaded / event.total) * 94))));
          }
        };
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) resolve();
          else {
            let detail = request.responseText;
            try { detail = JSON.parse(request.responseText).message || detail; } catch {}
            reject(new Error(detail || `Storage yükleme hatası (${request.status})`));
          }
        };
        request.onerror = () => reject(new Error("Fotoğraf yüklenirken ağ bağlantısı kesildi."));
        request.send(file);
      });
      storageUploadCompleted = true;
      setPhotoUploadProgress(96);
      const { error: insertError } = await supabase.from("photos").insert({
        uploaded_by: userId,
        storage_path: safeName,
        caption: photoCaption.trim() || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (insertError) {
        let cleanupError: string | null = null;
        try {
          const { error } = await bucket.remove([safeName]);
          if (error) cleanupError = error.message;
        } catch (error) {
          cleanupError = error instanceof Error ? error.message : String(error);
        }
        const cleanupNote = cleanupError
          ? ` Yeni yüklenen dosya Storage'dan temizlenemedi: ${cleanupError}`
          : " Yeni yüklenen dosya Storage'dan temizlendi.";
        setPhotoError(`${describeSupabaseError("Fotoğraf albüme kaydedilemedi", insertError)} photos tablosunun INSERT RLS politikasını kontrol edin.${cleanupNote}`);
        return;
      }
      setPhotoCaption("");
      setPhotoUploadProgress(100);
      setNotice("Fotoğraf albüme eklendi. ♥");
      await loadPhotos();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPhotoError(storageUploadCompleted
        ? `Fotoğraf yüklemesi başladı ancak albüm kaydının sonucu netleşmedi. Albümü yenileyip kontrol edin; tekrar yüklemeden önce eşleşmeyi doğrulayın. (${message})`
        : `Fotoğraf yüklenemedi: ${message}. love-photos bucket'ı ve yükleme izinlerini kontrol edin.`);
    } finally {
      setUploadingPhoto(false);
      window.setTimeout(() => setPhotoUploadProgress(0), 700);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  function navigateGallery(direction: -1 | 1) {
    if (photos.length === 0) return;
    setSelectedPhotoIndex(index => index === null ? null : (index + direction + photos.length) % photos.length);
  }

  if (loading || !member) return <main className="loading">Bizim dünyamız hazırlanıyor… ♥</main>;

  return (
    <main className="dashboard-shell">
      <section className="relationship-counter" aria-label="Birlikte geçen zaman">
        <p className="eyebrow">BİRLİKTE BİRİKTİRDİĞİMİZ ANLAR</p>
        <h2>Her saniyesi bize ait <span>♥</span></h2>
        <div className="counter-grid">
          <div className="counter-unit"><strong>{relationshipDays.toLocaleString("tr-TR")}</strong><span>GÜN</span></div>
          <div className="counter-unit"><strong>{String(relationshipHours).padStart(2, "0")}</strong><span>SAAT</span></div>
          <div className="counter-unit"><strong>{String(relationshipMinutes).padStart(2, "0")}</strong><span>DAKİKA</span></div>
          <div className="counter-unit"><strong>{String(relationshipSecs).padStart(2, "0")}</strong><span>SANİYE</span></div>
        </div>
        <p className="counter-footer">Daha nice güzel anılara ✨</p>
      </section>
      <header className="topbar">
        <div>
          <div className="tiny-label">BİZİM KÜÇÜK DÜNYAMIZ</div>
          <h1>{member.display_name === "Elif" ? "Aşkım hoş geldin, nasılsın? ❤️" : <>Merhaba, {member.display_name} <span>♥</span></>}</h1>
        </div>
        <div className="top-actions">{member.role === "admin" && <span className="admin-pill">Yönetici</span>}<button className="ghost-button" onClick={signOut}>Çıkış</button></div>
      </header>
      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}　×</button>}
      <section className="welcome-card">
        <div><p className="eyebrow">GÜNÜN SÜRPRİZİ</p><h2 key={welcomeMessage} aria-live="polite">{welcomeMessage}</h2><p>Bugün de birbirimizi seçtiğimiz için. ✨</p></div>
        <div className="big-heart">♥</div>
      </section>
      <div className="dashboard-grid">
        <section className="panel mood-panel">
          <div className="panel-heading"><div><p className="eyebrow">HER GÜN BİRAZ DAHA</p><h3>Özlem günlüğü</h3></div><span className="panel-icon"><span className="panel-emoji">💗</span></span></div>
          <p className="muted">Bugün birbirinizi ne kadar özlediniz?</p>
          <div className="mood-slider">
            <div className="mood-slider-head">
              <span className="mood-slider-description">{moodDescription}</span>
              <output className="mood-score-value" aria-live="polite">
                <strong>{moodScore}</strong><span>/10</span><span aria-hidden="true">{moodEmoji}</span>
              </output>
            </div>
            <input
              className="mood-range"
              type="range"
              min={1}
              max={10}
              step={1}
              value={moodScore}
              onChange={event => setMoodScore(Number(event.target.value))}
              aria-label="Bugünkü özlem puanı"
              aria-valuetext={`${moodScore}/10, ${moodDescription}`}
            />
            <div className="mood-range-labels"><span>🥺 Daha az</span><span>Çok özledim 💗</span></div>
          </div>
          <textarea value={moodNote} onChange={e=>setMoodNote(e.target.value)} placeholder="İstersen bugünden küçük bir not bırak…" />
          <button className="primary-button" onClick={submitMood}>Bugünü kaydet</button>
          <div className="history">{moods.slice(0,5).map(x=><div className="history-row" key={x.id}><span>{new Date(x.mood_date+"T12:00:00").toLocaleDateString("tr-TR")}</span><b>{x.score}/10</b><small>{x.note || "♡"}</small></div>)}</div>
        </section>
        <section className="panel flower-panel">
          <div className="panel-heading"><div><p className="eyebrow">BİRLİKTE BÜYÜYORUZ</p><h3>Sevgi çiçeğimiz</h3></div><span className="panel-icon"><span className="panel-emoji">🌷</span></span></div>
          {flower ? (
            <>
              <div className="flower-scene">
                <FlowerIllustration growthDays={flower.growth_days} wilted={flower.wilted} />
                {wateringAnimation > 0 && (
                  <div key={wateringAnimation} className="watering-effects" aria-hidden="true">
                    <span className="water-effect drop-one">💧</span>
                    <span className="water-effect drop-two">💦</span>
                    <span className="water-effect sparkle-one">✨</span>
                    <span className="water-effect sparkle-two">🌸</span>
                    <span className="water-cheer">Yaşasın! 💕</span>
                  </div>
                )}
                {fertilizeAnimation > 0 && (
                  <div key={fertilizeAnimation} className="fertilizing-effects" aria-hidden="true">
                    <span className="fertilize-particle fertilize-sprout">🌱</span>
                    <span className="fertilize-particle fertilize-sparkle-one">✨</span>
                    <span className="fertilize-particle fertilize-sparkle-two">🌼</span>
                    <span className="fertilize-cheer">Canlandık! 💚</span>
                  </div>
                )}
              </div>
              <p className="flower-stage-caption">
                {flower.wilted ? "Biraz ilgiye ihtiyacı var" : getFlowerStage(flower.growth_days)}
              </p>
            </>
          ) : (
            <p className="flower-unavailable">Çiçek bilgisi alınamadı.</p>
          )}
          <h2>{flower ? flower.wilted ? "Biraz ilgiye ihtiyacı var" : flower.growth_days >= 10 ? "Çiçeğimiz açtı!" : `${flower.growth_days}/10 gün` : "Çiçek durumu bekleniyor"}</h2>
          <p className="muted">Her gün bir kez sulayın. Onuncu günde çiçeğimiz açacak.</p>
          {flower && <div className="progress"><span style={{width:`${Math.min(100,(flower.growth_days/10)*100)}%`}} /></div>}
          <button className="primary-button" onClick={waterFlower}>Bugün sula 💧</button>
          {member.role === "admin" && <button className="text-button" onClick={fertilize}>Gübre ver · çiçeği canlandır</button>}
        </section>
        <section className="panel todo-panel">
          <div className="todo-title-row">
            <div><p className="eyebrow">BİRLİKTE YAPALIM</p><h3>Birlikte Yapacaklarımız <span className="todo-heading-emoji">💗</span></h3></div>
            <div className="todo-count" aria-live="polite">
              <strong>{completedTodoCount}<span>/{todos.length}</span></strong>
              <small>tamamlandı</small>
            </div>
          </div>
          <div className="todo-progress-track" role="progressbar" aria-label="Tamamlanan görev oranı" aria-valuemin={0} aria-valuemax={Math.max(todos.length, 1)} aria-valuenow={completedTodoCount}>
            <span style={{ width: `${todoProgress}%` }} />
          </div>
          <form className="todo-form" onSubmit={event => { event.preventDefault(); void addTodo(); }}>
            <input
              value={newTodo}
              onChange={event => setNewTodo(event.target.value)}
              placeholder="Birlikte ne yapalım?"
              aria-label="Yeni ortak görev"
              disabled={addingTodo}
            />
            <button type="submit" disabled={addingTodo || !newTodo.trim()}>{addingTodo ? "Ekleniyor…" : "Ekle"}</button>
          </form>
          {todoError && (
            <div className="todo-error" role="alert">
              <span>Görevler alınamadı: {todoError}</span>
              <button type="button" onClick={() => void loadTodos()}>Yeniden dene</button>
            </div>
          )}
          <div className="todo-list">
            {todos.map(todo => (
              <label className={todo.completed ? "todo done" : "todo"} key={todo.id}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => void toggleTodo(todo)}
                  disabled={updatingTodos}
                  aria-label={`${todo.title} tamamlandı`}
                />
                <span className="todo-content">
                  <span className="todo-title">{todo.title}</span>
                  {todo.completed && todo.completed_at && (
                    <time dateTime={todo.completed_at}>
                      Tamamlandı {new Date(todo.completed_at).toLocaleDateString("tr-TR", {
                        timeZone: CHAT_TIME_ZONE,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  )}
                </span>
              </label>
            ))}
            {!todoError && todos.length === 0 && <p className="todo-empty">İlk ortak planınızı ekleyin ✨</p>}
          </div>
        </section>
        <section className="panel coupon-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">KÜÇÜK MUTLULUKLAR</p>
              <h3>Elif&apos;in Özel Aşk Kuponları</h3>
            </div>
            <span className="panel-icon"><span className="panel-emoji">🎁</span></span>
          </div>
          <p className="coupon-panel-description">İstediğin an kullanabileceğin süresiz sevgi hakların 💌💗</p>
          {couponError && <div className="shared-data-error" role="alert"><span>{couponError}</span><button type="button" onClick={() => void loadCoupons()}>Yeniden dene</button></div>}
          {canManageCoupons ? (
            <form className="coupon-add-form" onSubmit={event => { event.preventDefault(); void addCoupon(); }}>
              <label className="coupon-emoji-field">
                <span>Emoji</span>
                <select
                  value={newCouponEmoji}
                  onChange={event => setNewCouponEmoji(event.target.value)}
                  aria-label="Yeni kupon emojisi"
                  disabled={couponBusy}
                >
                  {COUPON_EMOJI_OPTIONS.map(([emoji, label]) => (
                    <option key={emoji} value={emoji}>{emoji} {label}</option>
                  ))}
                </select>
              </label>
              <input
                value={newCoupon}
                onChange={event => setNewCoupon(event.target.value)}
                placeholder="Yeni kupon başlığı"
                aria-label="Yeni kupon başlığı"
                disabled={couponBusy}
              />
              <input
                value={newCouponDescription}
                onChange={event => setNewCouponDescription(event.target.value)}
                placeholder="Kısa, tatlı açıklama"
                aria-label="Kupon açıklaması"
                disabled={couponBusy}
              />
              <button type="submit" disabled={couponBusy || !newCoupon.trim()}>{couponBusy ? "Kaydediliyor…" : "Kupon ekle ✨"}</button>
            </form>
          ) : null}
          <div className="coupon-list">
            {coupons.map(c => editingCouponId === c.id && canManageCoupons && !c.redeemed_at ? (
              <form className="coupon-editor love-coupon-editor" key={c.id} onSubmit={event => { event.preventDefault(); void saveCoupon(c.id); }}>
                <select value={editCouponEmoji} onChange={event => setEditCouponEmoji(event.target.value)} aria-label="Kupon emojisi">
                  {COUPON_EMOJI_OPTIONS.map(([emoji, label]) => (
                    <option key={emoji} value={emoji}>{emoji} {label}</option>
                  ))}
                </select>
                <input value={editCouponTitle} onChange={event => setEditCouponTitle(event.target.value)} aria-label="Kupon başlığı" required />
                <textarea value={editCouponDescription} onChange={event => setEditCouponDescription(event.target.value)} placeholder="Kısa, tatlı açıklama" aria-label="Kupon açıklaması" rows={2} />
                <div className="coupon-actions">
                  <button type="submit" disabled={couponBusy || !editCouponTitle.trim()}>{couponBusy ? "Kaydediliyor…" : "Kaydet"}</button>
                  <button type="button" className="coupon-secondary-action" disabled={couponBusy} onClick={() => setEditingCouponId(null)}>Vazgeç</button>
                </div>
              </form>
            ) : (
              <article className={`coupon love-coupon-card${c.redeemed_at ? " is-redeemed" : ""}`} key={c.id}>
                <div className="love-coupon-top">
                  <span className="love-coupon-emoji" aria-hidden="true">{c.emoji || "🎟️"}</span>
                  <div className="coupon-copy love-coupon-copy">
                    <b className="love-coupon-title">{c.title}</b>
                    <small>{c.description || "Sana özel küçük bir sevgi sözü."}</small>
                  </div>
                  {canManageCoupons && !c.redeemed_at && (
                    <div className="love-coupon-manage">
                      <button
                        type="button"
                        aria-label={`${c.title} kuponunu düzenle`}
                        title="Düzenle"
                        disabled={couponBusy}
                        onClick={() => {
                          setEditingCouponId(c.id);
                          setEditCouponEmoji(c.emoji || "💗");
                          setEditCouponTitle(c.title);
                          setEditCouponDescription(c.description ?? "");
                        }}
                      >✎</button>
                      <button
                        type="button"
                        aria-label={`${c.title} kuponunu kaldır`}
                        title="Kaldır"
                        disabled={couponBusy}
                        onClick={() => void removeCoupon(c)}
                      >×</button>
                    </div>
                  )}
                </div>
                <div className="love-coupon-footer">
                  <span className={`love-coupon-status${c.redeemed_at ? " is-used" : ""}`}>
                    {c.redeemed_at ? "Kullanıldı ❤️" : "✨ Kullanıma hazır"}
                  </span>
                  <button
                    type="button"
                    className="love-coupon-use"
                    onClick={() => void redeemCoupon(c.id)}
                    disabled={couponBusy || Boolean(c.redeemed_at)}
                  >
                    {c.redeemed_at ? "Kullanıldı ❤️" : "Kuponu Kullan"}
                  </button>
                </div>
              </article>
            ))}
            {!couponError && coupons.length === 0 && <p className="coupon-empty">İlk küçük mutluluğunuzu ekleyin ✨</p>}
          </div>
        </section>
        {member.display_name === "Elif" && <section className="panel strawberry-assistant-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">KÜÇÜK YARDIMCIN</p><h3>Çilek Kız Yardımcı Asistanı</h3></div>
            <CilekAvatar className="strawberry-avatar-header" />
          </div>
          <div className="strawberry-assistant-intro">
            <CilekAvatar className="strawberry-assistant-avatar" />
            <div className="strawberry-assistant-greeting-wrap">
              <p className="strawberry-assistant-greeting">Merhaba Elif! Ben Çilek Kız Yardımcı Asistanı. Bugün nasıl hissediyorsun? 💗</p>
              <span className="strawberry-assistant-caption">Tatlı bir sohbete hazırım · Sohbet geçmişin bu sayfada tutulur ✨</span>
            </div>
          </div>
          <button
            type="button"
            className="strawberry-assistant-toggle"
            aria-expanded={strawberryAssistantOpen}
            aria-controls="strawberry-assistant-chat"
            onClick={() => setStrawberryAssistantOpen(open => !open)}
          >
            {strawberryAssistantOpen ? "Sohbeti kapat" : "Sohbeti başlat"}
            <span aria-hidden="true">{strawberryAssistantOpen ? "×" : "💬"}</span>
          </button>
          <div id="strawberry-assistant-chat" className="strawberry-assistant-chat" hidden={!strawberryAssistantOpen}>
            <div className="strawberry-assistant-messages" role="log" aria-label="Çilek Kız Yardımcı Asistanı sohbet geçmişi" aria-live="polite">
              {strawberryAssistantMessages.length === 0 && (
                <p className="strawberry-assistant-empty">İstersen gününden, hayallerinden ya da aklına takılanlardan bahsedebilirsin 🍓</p>
              )}
              {strawberryAssistantMessages.map(message => (
                <article className={`strawberry-assistant-message is-${message.role}`} key={message.id}>
                  {message.role === "model" && <CilekAvatar className="strawberry-message-avatar" />}
                  <div className="strawberry-assistant-bubble">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </article>
              ))}
              {strawberryAssistantSending && (
                <article className="strawberry-assistant-message is-model is-typing">
                  <CilekAvatar className="strawberry-message-avatar" />
                  <p className="strawberry-typing-bubble" aria-label="Çilek yazıyor">
                    <span /><span /><span />
                  </p>
                </article>
              )}
              <div ref={strawberryAssistantEndRef} />
            </div>
            {strawberryAssistantError && <p className="strawberry-assistant-error" role="alert">{strawberryAssistantError}</p>}
            <form
              className="strawberry-assistant-form"
              onSubmit={event => { event.preventDefault(); void sendStrawberryAssistantMessage(); }}
            >
              <label className="strawberry-assistant-input-label" htmlFor="strawberry-assistant-message">Mesajın</label>
              <textarea
                id="strawberry-assistant-message"
                className="strawberry-assistant-input"
                value={strawberryAssistantDraft}
                onChange={event => setStrawberryAssistantDraft(event.target.value.slice(0, 2000))}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendStrawberryAssistantMessage();
                  }
                }}
                maxLength={2000}
                rows={2}
                placeholder="Aklından geçenleri buraya yaz…"
                aria-label="Çilek'e mesaj yaz"
                disabled={strawberryAssistantSending}
              />
              <div className="strawberry-assistant-compose-footer">
                <span>{strawberryAssistantDraft.length}/2000 · Enter ile gönder, Shift+Enter ile yeni satır</span>
                <div className="strawberry-assistant-actions">
                  {strawberryAssistantMessages.length > 0 && (
                    <button
                      type="button"
                      className="strawberry-assistant-reset"
                      onClick={() => {
                        setStrawberryAssistantMessages([]);
                        setStrawberryAssistantDraft("");
                        setStrawberryAssistantError("");
                      }}
                      disabled={strawberryAssistantSending}
                    >Yeni sohbet</button>
                  )}
                  <button
                    type="submit"
                    className="strawberry-assistant-send"
                    disabled={strawberryAssistantSending || !strawberryAssistantDraft.trim()}
                  >{strawberryAssistantSending ? "Düşünüyor…" : "Gönder 💌"}</button>
                </div>
              </div>
            </form>
            <section className="strawberry-memory-panel" aria-label="Çilek'in kalıcı hafızası">
              <div className="strawberry-memory-heading">
                <div>
                  <h4>Çilek&apos;in hafızası</h4>
                  <p>Yalnızca senin açıkça eklediğin notlar saklanır.</p>
                </div>
                <button
                  type="button"
                  className={`strawberry-memory-toggle${strawberryMemoryEnabled ? " is-enabled" : ""}`}
                  aria-pressed={strawberryMemoryEnabled}
                  onClick={() => void toggleStrawberryMemory()}
                  disabled={!strawberryMemoryReady || strawberryMemoryLoading || strawberryMemoryBusy}
                >{strawberryMemoryEnabled ? "Hafızayı kapat" : "Hafızayı aç"}</button>
              </div>
              {strawberryMemoryError && <p className="strawberry-assistant-error" role="alert">{strawberryMemoryError}</p>}
              {strawberryMemoryLoading
                ? <p className="strawberry-memory-status">Hafıza kontrol ediliyor…</p>
                : strawberryMemoryReady && (
                  <>
                    <p className="strawberry-memory-status">
                      {strawberryMemoryEnabled
                        ? "Hafıza açık. Hassas bilgileri ekleme; kaydettiğin notlar sonraki sohbetlerde kullanılabilir."
                        : "Hafıza kapalı. Kayıtlı notlar saklanır ama sohbetlerde kullanılmaz."}
                    </p>
                    {strawberryMemoryEnabled && (
                      <form
                        className="strawberry-memory-form"
                        onSubmit={event => { event.preventDefault(); void saveStrawberryMemory(); }}
                      >
                        <label htmlFor="strawberry-memory-draft">Hatırlamasını istediğin bir bilgi</label>
                        <textarea
                          id="strawberry-memory-draft"
                          value={strawberryMemoryDraft}
                          onChange={event => setStrawberryMemoryDraft(event.target.value.slice(0, 500))}
                          maxLength={500}
                          rows={2}
                          placeholder="Örneğin: En sevdiğim çiçek papatya."
                          disabled={strawberryMemoryBusy}
                        />
                        <div className="strawberry-memory-form-footer">
                          <span>{strawberryMemoryDraft.length}/500 · Kaydet düğmesine basmadan saklanmaz</span>
                          <button
                            type="submit"
                            disabled={strawberryMemoryBusy || !strawberryMemoryDraft.trim()}
                          >{strawberryMemoryBusy ? "Kaydediliyor…" : "Hafızaya ekle"}</button>
                        </div>
                      </form>
                    )}
                    {strawberryMemories.length > 0 ? (
                      <ul className="strawberry-memory-list">
                        {strawberryMemories.map(memory => (
                          <li key={memory.id}>
                            <span>{memory.content}</span>
                            <button
                              type="button"
                              aria-label="Bu hafıza notunu sil"
                              onClick={() => void deleteStrawberryMemory(memory.id)}
                              disabled={strawberryMemoryBusy}
                            >×</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="strawberry-memory-empty">Henüz kaydedilmiş bir not yok.</p>
                    )}
                    {strawberryMemories.length > 0 && (
                      <button
                        type="button"
                        className="strawberry-memory-clear"
                        onClick={() => void deleteAllStrawberryMemories()}
                        disabled={strawberryMemoryBusy}
                      >Tüm notları sil</button>
                    )}
                  </>
                )}
            </section>
          </div>
        </section>}
        <section className="panel chat-panel">
          <div className="chat-header">
            <div className="panel-heading">
              <div><p className="eyebrow">HER GÜN YENİ BİR SAYFA</p><h3>İkimizin sohbeti 💌</h3></div>
              <span className="panel-icon"><span className="panel-emoji">💌</span></span>
            </div>
            <div className="chat-date-picker">
              <label htmlFor="chat-date">Sohbet günü</label>
              <input
                id="chat-date"
                className="chat-date-input"
                type="date"
                value={activeChatDate}
                max={currentChatDate}
                onChange={event => chooseChatDate(event.target.value)}
                aria-label="Sohbet geçmişinde gün seç"
              />
              {isViewingChatArchive
                ? <button type="button" className="chat-today-button" onClick={() => setArchiveDate(null)}>Bugüne dön</button>
                : <span className="chat-day-badge">Bugün birlikteyiz ✨</span>}
            </div>
          </div>
          <p className="chat-date-title">{formatChatDate(activeChatDate)}</p>
          <div className="chat-messages" role="log" aria-label={`${formatChatDate(activeChatDate)} sohbet mesajları`} aria-live="polite">
            {chatLoading && <p className="chat-empty">Sohbetimiz hazırlanıyor… 💗</p>}
            {!chatLoading && chatError && <p className="chat-error" role="alert">{chatError}</p>}
            {!chatLoading && chatTableUnavailable && (
              <button type="button" className="chat-retry-button" onClick={() => setChatTableUnavailable(false)}>Sohbet bağlantısını dene</button>
            )}
            {!chatLoading && !chatError && chatMessages.length === 0 && (
              <p className="chat-empty">Bu gün için henüz mesaj yok. İlk küçük notu sen bırak 💕</p>
            )}
            {!chatError && chatMessages.map(chatMessage => {
              const isOwnMessage = chatMessage.sender_id === userId;
              const senderName = isOwnMessage
                ? member.display_name
                : member.display_name === "Elif" ? "Emre" : "Elif";
              const senderClass = senderName === "Elif" ? "chat-message-elif" : "chat-message-emre";
              return (
                <article
                  className={`chat-message ${isOwnMessage ? "chat-message-own" : "chat-message-partner"} ${senderClass}`}
                  key={chatMessage.id}
                >
                  <p className="chat-message-sender">{senderName}</p>
                  <p className="chat-message-body">{chatMessage.body}</p>
                  <time className="chat-message-time" dateTime={chatMessage.created_at}>{formatChatTime(chatMessage.created_at)}</time>
                </article>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          {chatNotice && <p className={`chat-notice chat-notice-${chatNotice.type}`} role={chatNotice.type === "error" ? "alert" : "status"}>{chatNotice.text}</p>}
          {isViewingChatArchive && <p className="chat-archive-note">Bu gün arşivlendi; burada yalnızca okuyabilirsin. 🌷</p>}
          <form className="chat-compose" onSubmit={event => { event.preventDefault(); void sendChatMessage(); }}>
            <textarea
              value={chatDraft}
              onChange={event => setChatDraft(event.target.value.slice(0, 2000))}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendChatMessage();
                }
              }}
              maxLength={2000}
              rows={2}
              placeholder={isViewingChatArchive ? "Arşiv günlerine mesaj gönderilemez" : "Ona küçük bir sevgi notu yaz…"}
              aria-label="Sohbet mesajı"
              disabled={isViewingChatArchive || !!chatError || chatLoading}
            />
            <button type="submit" className="chat-send-button" disabled={
              isViewingChatArchive || !!chatError || chatLoading || sendingChatMessage || !chatDraft.trim()
            }>
              {sendingChatMessage ? "Gönderiliyor…" : "Gönder 💌"}
            </button>
          </form>
          <div className="chat-compose-footer">
            <span>Mesajlar 00.00’da yeni güne geçer · saatler Türkiye saatidir</span>
            <span>{chatDraft.length}/2000</span>
          </div>
          {chatSendAnimation > 0 && <span key={chatSendAnimation} className="chat-send-sparkle" aria-hidden="true">💌</span>}
        </section>
        <section className="panel photo-panel">
          <div className="panel-heading"><div><p className="eyebrow">BİRİKTİRDİĞİMİZ ANLAR</p><h3>Fotoğraf albümü</h3></div><span className="panel-icon"><span className="panel-emoji">📸</span></span></div>
          {photoError && <div className="shared-data-error" role="alert"><span>{photoError}</span><button type="button" onClick={() => void loadPhotos()}>Yeniden dene</button></div>}
          <input value={photoCaption} onChange={e=>setPhotoCaption(e.target.value)} placeholder="Fotoğrafa bir not…" aria-label="Fotoğraf açıklaması" disabled={uploadingPhoto} />
          <label className={`upload-button${uploadingPhoto ? " is-uploading" : ""}`}>
            {uploadingPhoto ? `Yükleniyor · %${photoUploadProgress}` : "＋ Fotoğraf seç"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploadingPhoto}
              onChange={event => {
                void uploadPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {uploadingPhoto && (
            <div className="photo-upload-progress" role="progressbar" aria-label="Fotoğraf yükleme ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={photoUploadProgress}>
              <span style={{ width: `${photoUploadProgress}%` }} />
            </div>
          )}
          <div className="photo-list">{photos.map((photo, index) => {
            return (
              <button
                type="button"
                className="polaroid"
                key={photo.id}
                onClick={() => setSelectedPhotoIndex(index)}
                aria-label={`${photo.caption || "Anımız"} fotoğrafını büyüt`}
              >
                <span className="polaroid-photo">
                  {photo.signed_url
                    ? <img src={photo.signed_url} alt={photo.caption || "Anımız"} />
                    : <span className="photo-unavailable">Fotoğraf yüklenemedi</span>}
                  <span className="polaroid-date">{formatPhotoRemaining(photo.expires_at, photoClock)}</span>
                </span>
                <span className="polaroid-caption">{photo.caption || "♥"}</span>
                <span className="polaroid-meta">
                  <strong>{photo.uploader_name}</strong>
                  <time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </span>
              </button>
            );
          })}</div>
        </section>
        {member.role === "admin" && <section className="panel admin-panel">
          <div className="panel-heading"><div><p className="eyebrow">SADECE EMRE GÖRÜR</p><h3>Gizli yönetici alanı</h3></div><span className="panel-icon"><span className="panel-emoji">⚙️</span></span></div>
          <p className="muted">Elif&apos;e gösterilecek günlük sevgi notunu buradan yönet.</p>
          <textarea value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Elif'e bugünün özel notu…" />
          <button className="primary-button" onClick={addDailyMessage}>Günlük notu yayınla</button>
        </section>}
      </div>
      {selectedPhoto && (
        <div className="photo-lightbox" onClick={event => {
          if (event.target === event.currentTarget) setSelectedPhotoIndex(null);
        }}>
          <section className="photo-lightbox-content" role="dialog" aria-modal="true" aria-label="Fotoğraf galerisi">
            <button type="button" className="photo-lightbox-close" onClick={() => setSelectedPhotoIndex(null)} aria-label="Galeriyi kapat">×</button>
            {photos.length > 1 && (
              <>
                <button type="button" className="photo-lightbox-nav photo-lightbox-prev" onClick={() => navigateGallery(-1)} aria-label="Önceki fotoğraf">‹</button>
                <button type="button" className="photo-lightbox-nav photo-lightbox-next" onClick={() => navigateGallery(1)} aria-label="Sonraki fotoğraf">›</button>
              </>
            )}
            <img src={selectedPhotoUrl} alt={selectedPhoto.caption || "Anımız"} />
            <div className="photo-lightbox-meta">
              <span>{selectedPhoto.caption || "♥"}</span>
              <span>{selectedPhoto.uploader_name} · {new Date(selectedPhoto.created_at).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
              <span>{formatPhotoRemaining(selectedPhoto.expires_at, photoClock)}</span>
              <a href={selectedPhotoUrl} target="_blank" rel="noreferrer">Orijinali aç</a>
            </div>
          </section>
        </div>
      )}
      <footer>Elif & Emre · Sevgiyle, her gün yeniden ♥</footer>
    </main>
  );
}