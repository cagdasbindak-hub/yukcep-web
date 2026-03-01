import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { MessageSquare, MapPin, Truck, RefreshCw, Calendar, Package, ArrowLeft, AlertCircle, CheckCircle, LogOut, User, Bell } from 'lucide-react';
import { supabase, SUPABASE_URL } from './lib/supabase';
import {
  createAbuseReportApi,
  createBidApi,
  createBidViaRestApi,
  createFeedbackItemApi,
  createLoadApi,
  createLoadViaRestApi,
  createNotificationApi,
  ensureProfileApi,
  fetchDriverFeedApi,
  fetchDriverFeedViaRestApi,
  fetchFeedbackItemsApi,
  fetchBidsForLoadApi,
  fetchBidsForLoadViaRestApi,
  fetchEmployerFeedApi,
  fetchEmployerFeedViaRestApi,
  fetchLoadDetailsApi,
  fetchLoadDetailsViaRestApi,
  fetchLoadsApi,
  fetchLoadsViaRestApi,
  fetchMyBidForLoadApi,
  fetchNotificationsApi,
  fetchPublicStatsApi,
  fetchPublicStatsViaRestApi,
  fetchProfileById,
  insertRuntimeLogsApi,
  markNotificationReadApi,
  updateProfileRoleApi,
  updateLoadStatusApi,
  updateLoadStatusViaRestApi,
  updateBidStatusApi,
  updateBidStatusViaRestApi,
} from './lib/api';
import { mapDbToUi } from './lib/loadMapper';
import SplashScreen from './components/SplashScreen';
import SkeletonLoadCard from './components/SkeletonLoadCard';
import { TURKEY_CITY_NAMES, normalizeCityKey } from './lib/turkeyGeoData';
import './App.css';

const AuthScreen = lazy(() => import('./components/AuthScreen'));
const Confetti = lazy(() => import('./components/Confetti'));
const TurkeyHeatmap = lazy(() => import('./components/TurkeyHeatmap'));

// ─── DATA ───
const cities = [...TURKEY_CITY_NAMES].sort((a, b) => a.localeCompare(b, "tr-TR"));
const dorseTypes = [{ k: "Kapalı", icon: "📦", color: "#3b82f6" }, { k: "Açık", icon: "🚛", color: "#f59e0b" }, { k: "Frigorifik", icon: "❄️", color: "#06b6d4" }];
const fmt = n => n.toLocaleString("tr-TR");

const deliveryPoints = {
  "Ankara": { name: "Sincan OSB Depo", avgHours: 3, rating: 4.2, reviews: [{ driver: "Veli K.", stars: 4, text: "Boşaltma 3 saat sürdü, fena değil.", date: "2g önce" }, { driver: "Ahmet R.", stars: 3, text: "Rampada 1 saat bekledik.", date: "5g önce" }] },
  "Trabzon": { name: "Trabzon Liman Antrepo", avgHours: 6, rating: 3.0, reviews: [{ driver: "Murat S.", stars: 2, text: "Bu fabrika boşaltma için 2 gün bekletiyor, dikkat!", date: "1g önce" }, { driver: "Kemal D.", stars: 4, text: "Son zamanlarda hızlandılar.", date: "1h önce" }] },
  "Antalya": { name: "Antalya Serbest Bölge", avgHours: 4, rating: 3.8, reviews: [{ driver: "İsa T.", stars: 4, text: "Düzenli çalışıyorlar, rampalar müsait.", date: "3g önce" }] },
  "Gaziantep": { name: "G.Antep OIZ Fabrika", avgHours: 8, rating: 2.5, reviews: [{ driver: "Osman Y.", stars: 2, text: "8 saat bekledim, demoraj istedim vermediler.", date: "1g önce" }, { driver: "Hüseyin B.", stars: 3, text: "Hafta içi giderseniz 4 saatte biter.", date: "4g önce" }] },
  "Bursa": { name: "BOSB Otomotiv Tesisi", avgHours: 2, rating: 4.5, reviews: [{ driver: "Ali V.", stars: 5, text: "En düzgün boşaltma noktası. 1.5 saatte bitti.", date: "2g önce" }] },
  "Mersin": { name: "Mersin Limanı CFS", avgHours: 5, rating: 3.5, reviews: [{ driver: "Recep G.", stars: 3, text: "Liman yoğun, sabah erken gidin.", date: "3g önce" }] },
  "Konya": { name: "Konya 2. OSB", avgHours: 3, rating: 4.0, reviews: [{ driver: "Mustafa E.", stars: 4, text: "Hızlı boşaltma, sıra yok.", date: "2g önce" }] },
  "İstanbul": { name: "Hadımköy Lojistik Merkez", avgHours: 5, rating: 3.3, reviews: [{ driver: "Emre P.", stars: 3, text: "Trafik dahil 6 saat gitti.", date: "1g önce" }] },
  "İzmir": { name: "Aliağa Liman Deposu", avgHours: 3.5, rating: 4.0, reviews: [{ driver: "Serkan M.", stars: 4, text: "İyi organize.", date: "2g önce" }] },
  "default": { name: "Depo/Fabrika", avgHours: 4, rating: 3.5, reviews: [{ driver: "Şoför", stars: 3, text: "Normal sürede boşaltıldı.", date: "1h önce" }] }
};
const getDP = city => deliveryPoints[city] || deliveryPoints["default"];

const empReviews = {
  "Aras Tekstil Ltd.": { ratings: { speed: 4.2, payment: 4.8, comm: 4.5 }, reviews: [{ driver: "Mehmet K.", stars: 5, text: "Ödemeyi aynı gün yaptı.", date: "3g", resp: "Teşekkürler Mehmet Bey!" }, { driver: "Ali D.", stars: 4, text: "Yükleme gecikti ama ödeme sorunsuz.", date: "1h", resp: "Özür dileriz, rampa yoğundu." }] },
  "TeknoPlus A.Ş.": { ratings: { speed: 5, payment: 5, comm: 4.8 }, reviews: [{ driver: "Hasan Y.", stars: 5, text: "3 yıldır çalışıyoruz, mükemmel.", date: "2g", resp: null }, { driver: "Osman B.", stars: 5, text: "Çok nazik, iletişimi harika.", date: "5g", resp: "Sağ olun!" }] },
  "Güney Gıda Paz.": { ratings: { speed: 3, payment: 3.5, comm: 4 }, reviews: [{ driver: "Yusuf T.", stars: 3, text: "Ödemeyi 3 gün geç yaptı.", date: "4g", resp: "Artık EFT ile aynı gün yapıyoruz." }] },
  "Mega İnşaat A.Ş.": { ratings: { speed: 4, payment: 4.2, comm: 3.8 }, reviews: [{ driver: "Recep A.", stars: 4, text: "Ağır yük ama fiyat iyi.", date: "1g", resp: null }] },
  "default": { ratings: { speed: 3.5, payment: 3.5, comm: 3.5 }, reviews: [{ driver: "Şoför", stars: 4, text: "Memnunum.", date: "1h", resp: null }] }
};
const getER = name => empReviews[name] || empReviews["default"];

const getRoleSwitchPopupContent = (role) => {
  if (role === "employer") {
    return {
      title: "🏢 İşveren Modu Aktif",
      summary: "Artık yük ilanı yayınlama ve teklif değerlendirme akışı önceliklidir.",
      points: [
        "Ana akışta İşveren Feed ve Yeni İlan Ver aksiyonları görünür.",
        "Yüklere gelen teklifleri kabul/red ederek süreci yönetirsin.",
      ],
      action: "Anladım, İşveren modunda devam et",
    };
  }
  return {
    title: "🚛 İş Arıyorum Modu Aktif",
    summary: "Artık yük arama, teklif gönderme ve benim işlerim takibi önceliklidir.",
    points: [
      "Ana akışta Benim Yapacak İşlerim ve Yeni İş Ara aksiyonları görünür.",
      "Verdiğin tekliflerin durumunu ve kabul edilen işleri feed'den izlersin.",
    ],
    action: "Anladım, İş Arıyorum modunda devam et",
  };
};

const RELEASE_UPDATES_SEED = [
  { date: "2026-03-01", title: "Feedback panosunda eski otomatik yorum/tag sonuçları sıfırdan yeniden değerlendiriliyor; yanlış filtrelenen öneriler tekrar etiketleniyor." },
  { date: "2026-03-01", title: "Yük listeleri/istatistik/feed akışlarında pickup_date filtresi eklendi: yalnızca bugün ve gelecek tarihli yükler gösteriliyor." },
  { date: "2026-03-01", title: "Feedback listesi girişte timeout olursa otomatik ikinci deneme eklendi; geçici gecikmelerde kullanıcıya kırmızı hata gösterimi kaldırıldı." },
  { date: "2026-03-01", title: "Ops check otomasyonu eklendi: canlıda feedback panosu + hata/çalışma logları taranıp backlog raporu üretiliyor." },
  { date: "2026-03-01", title: "Feedback listesinde teknik DB hata metinleri gizlendi; tablo eksikse kullanıcıya güvenli fallback mesajı gösteriliyor." },
  { date: "2026-03-01", title: "Feedback gönderiminde schema cache/table missing hatası için yerel + runtime çift fallback sertleştirildi; kritik hata yerine güvenli kayıt akışı aktif." },
  { date: "2026-03-01", title: "Son 10 Güncelleme üstüne herkese açık Feedback Panosu eklendi: kullanıcı önerisi + otomatik Codex yorumu + durum tag." },
  { date: "2026-03-01", title: "Feedback moderasyonu otomatikleştirildi; geri bildirim dışı yorumlar filtrelenip Kötü Fikir etiketiyle işaretleniyor." },
  { date: "2026-03-01", title: "Launch hardening: CI (lint/build/smoke/a11y), post-deploy smoke ve health-check otomasyonu eklendi." },
  { date: "2026-03-01", title: "İlanı Raporla akışı eklendi; aynı kullanıcı/ilan için 5 dakika anti-spam cooldown aktif." },
  { date: "2026-03-01", title: "İşveren Feed'e kanban hızlı bakış kartları (bekleyen/kabul/red) eklendi." },
  { date: "2026-03-01", title: "Ayarlar paneline telefon doğrulama zorunluluğu eklendi; teklif/ilan aksiyonlarında policy gate aktif." },
  { date: "2026-03-01", title: "Ana sayfada sürücü için Benim Yapacak İşlerim + Yeni İş Ara aksiyonu eklendi; rol değişimlerinde açıklama popupı getirildi." },
  { date: "2026-03-01", title: "Oturum açılışında profil rolü timeout’a dayanıklı hale getirildi; rol çözülemezse ana sayfada rol seçimi ile bloktan çıkış sağlandı." },
  { date: "2026-03-01", title: "Yük listesi sorgusu tekilleştirildi; REST fallback başarılı olduğunda çift WARN/INFO log tekrarları azaltıldı." },
  { date: "2026-03-01", title: "Canlı sayaçlarda public stats sorgusu tekilleştirildi; fallback başarılıysa gereksiz timeout WARN logları azaltıldı." },
  { date: "2026-02-28", title: "Şoför ve işveren için ayrı Feed ekranları eklendi." },
  { date: "2026-02-28", title: "10 adımlı E2E senaryo checklist ekranı feed içine eklendi." },
  { date: "2026-02-28", title: "Profil menüsüne açılır Ayarlar paneli (hazır/placeholder) eklendi." },
  { date: "2026-02-28", title: "Çıkış Yap akışı timeout + local fallback ile güvenilir hale getirildi." },
  { date: "2026-02-28", title: "Profil kartında rol etiketi netleştirildi: İşverenim / İş Arıyorum." },
  { date: "2026-02-28", title: "İlan yayınlama sırasında formu kilitleyen temalı bekleme animasyonu eklendi." },
  { date: "2026-02-28", title: "Runtime logları için Supabase runtime_logs kuyruğu ve otomatik flush eklendi." },
  { date: "2026-02-28", title: "Yük listeleme akışına Supabase timeout sonrası REST fallback eklendi." },
  { date: "2026-02-28", title: "Sayaç fallback mantığında eski yüksek değerin kilitlenme bug'ı düzeltildi." },
  { date: "2026-02-28", title: "İlan listesi canlı güncelleme (insert/update/delete) ile senkronlandı." },
  { date: "2026-02-28", title: "Şehir filtrelerinde Türkçe karakter/case normalizasyonu eklendi." },
  { date: "2026-02-28", title: "Detaylı Türkiye haritası ve il bazlı nokta gösterimi eklendi." },
  { date: "2026-02-28", title: "Neredesiniz ekranına 81 il arama + harf gruplama eklendi." },
  { date: "2026-02-28", title: "İlan verdikten sonra liste otomatik yenileme iyileştirildi." },
  { date: "2026-02-28", title: "Yük detay ekranında teklif akışı iyileştirildi." },
  { date: "2026-02-28", title: "Bildirimler gerçek zamanlı dinleme ile anlık hale getirildi." },
];
const LOG_STORAGE_KEY = "yukcep_runtime_logs_v1";
const PUBLIC_STATS_CACHE_KEY = "yukcep_public_stats_cache_v1";
const RELEASE_UPDATES_KEY = "yukcep_release_updates_v1";
const FEEDBACK_STORAGE_KEY = "yukcep_feedback_items_v1";
const ROLE_HINT_KEY = "yukcep_profile_role_hint_v1";
const SETTINGS_KEY = "yukcep_user_settings_v1";
const REMOTE_LOG_FLUSH_SIZE = 6;
const REMOTE_LOG_FLUSH_DELAY_MS = 2200;
const PUBLIC_STATS_FETCH_COOLDOWN_MS = 2500;
const LOADS_FETCH_COOLDOWN_MS = 1800;
const FEEDBACK_FETCH_COOLDOWN_MS = 2400;
const REPORT_RATE_LIMIT_MS = 5 * 60 * 1000;
const FEEDBACK_RATE_LIMIT_MS = 45 * 1000;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "2026.03.01";
const FEEDBACK_REVIEW_VERSION = 2;

const DEFAULT_USER_SETTINGS = {
  notificationsEnabled: true,
  language: "tr",
  hidePhoneOnCards: false,
  requireEmailVerified: false,
  requirePhoneOnActions: false,
};

const normalizeRoleHint = (role) => {
  if (role === "employer") return "employer";
  if (role === "driver") return "driver";
  return null;
};

const readRoleHint = (userId) => {
  try {
    const raw = localStorage.getItem(ROLE_HINT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (userId && parsed.userId && parsed.userId !== userId) return null;
        return normalizeRoleHint(parsed.role);
      }
    } catch {
      // legacy plain-string cache
    }
    return normalizeRoleHint(raw);
  } catch {
    return null;
  }
};

const writeRoleHint = (role, userId) => {
  const normalized = normalizeRoleHint(role);
  if (!normalized) return;
  try {
    localStorage.setItem(
      ROLE_HINT_KEY,
      JSON.stringify({
        role: normalized,
        userId: userId || null,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failures
  }
};

const sanitizeRemoteLogDetails = (value = "") =>
  String(value || "")
    .slice(0, 320)
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone]")
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b/g, "[token]");

const getRuntimeSessionId = () => {
  try {
    const key = "yukcep_runtime_session_id_v1";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const sanitizeReleaseUpdates = (items = []) => {
  const normalized = [];
  const seen = new Set();
  items.forEach((item) => {
    const title = String(item?.title || "").trim();
    if (!title || seen.has(title)) return;
    seen.add(title);
    normalized.push({
      date: String(item?.date || "2026-02-28"),
      title,
    });
  });
  return normalized.slice(0, 10);
};

const sanitizeFeedbackText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone]")
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b/g, "[token]")
    .trim()
    .slice(0, 280);

const sanitizeFeedbackItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const rawId = item?.id;
      const normalizedId =
        rawId !== undefined && rawId !== null && String(rawId).trim().length > 0
          ? rawId
          : `fb-${Date.now()}-${Math.floor(Math.random() * 999)}`;
      return {
        id: normalizedId,
        user_id: item?.user_id || null,
        author_name: String(item?.author_name || "Kullanıcı").trim() || "Kullanıcı",
        content: sanitizeFeedbackText(item?.content || ""),
        codex_comment: sanitizeFeedbackText(item?.codex_comment || ""),
        status_tag: ["yapildi", "yapilacak", "yapim_asamasinda", "kotu_fikir"].includes(item?.status_tag)
          ? item.status_tag
          : "yapilacak",
        moderation_status: item?.moderation_status === "filtered" ? "filtered" : "published",
        review_version: Number(item?.review_version) || 1,
        created_at: item?.created_at || new Date().toISOString(),
        updated_at: item?.updated_at || item?.created_at || new Date().toISOString(),
      };
    })
    .filter((item) => item.content.length >= 6)
    .slice(0, 80);

const evaluateFeedbackSubmission = ({ content, releaseUpdates = [] }) => {
  const text = sanitizeFeedbackText(content);
  const lower = text.toLocaleLowerCase("tr-TR");
  const riskyPattern = /(sifre|password|token|admin yetkisi|dogrulamayi kaldir|guvenlik.*kapat|hack|sql inject|ddos)/i;
  const offTopicPattern = /(bahis|casino|kumar|kripto sinyal|reklam verelim|telegram grubu|takip et kazan)/i;
  const spamPattern = /(http[s]?:\/\/.*http[s]?:\/\/|bedava takip|hemen para kazan)/i;

  if (!lower) {
    return {
      moderationStatus: "filtered",
      statusTag: "kotu_fikir",
      codexComment: "Bu içerik boş görünüyor. Daha net bir geri bildirim yazabilirsin.",
    };
  }

  if (riskyPattern.test(lower) || offTopicPattern.test(lower) || spamPattern.test(lower)) {
    return {
      moderationStatus: "filtered",
      statusTag: "kotu_fikir",
      codexComment: "Bu içerik ürün geri bildirimi kapsamında değerlendirilemedi.",
    };
  }

  const releaseText = sanitizeReleaseUpdates(releaseUpdates)
    .map((row) => String(row?.title || "").toLocaleLowerCase("tr-TR"))
    .join(" ");

  const words = lower.split(/\s+/).filter((word) => word.length > 4);
  const overlapCount = words.filter((word, idx) => words.indexOf(word) === idx && releaseText.includes(word)).length;
  const donePattern = /(duzeldi|düzeldi|cozuldu|çözüldü|uygulandi|uygulandı|tamamlandi|tamamlandı|eklendi|yayinda|yayında)/i;

  if (overlapCount >= 2 || donePattern.test(lower)) {
    return {
      moderationStatus: "published",
      statusTag: "yapildi",
      codexComment: "Yaptım, teşekkür ederim. Bu konu son güncellemelerde uygulandı.",
    };
  }

  const actionablePattern =
    /(hata|bug|calismiyor|çalışmıyor|duzelt|düzelt|iyilestir|iyileştir|ekle|eksik|performans|yavas|yavaş|ui|ux|tasarim|tasarım|bildirim|rol|feed|ilan|teklif|harita|filtre|kayit|kayıt|giris|giriş|buton|konum|lokasyon|sehir|şehir|eşleş|esles|sırala|sirala|önce|once|arama)/i;

  if (actionablePattern.test(lower)) {
    return {
      moderationStatus: "published",
      statusTag: "yapilacak",
      codexComment: "Güzel fikir. Yeni kuralla yeniden değerlendirildi ve yapılacaklar listesine alındı.",
    };
  }

  return {
    moderationStatus: "published",
    statusTag: "yapilacak",
    codexComment: "Güzel fikir. Biraz daha detay eklersen daha hızlı uygulayabilirim.",
  };
};

const retagFeedbackItemsFromScratch = ({ items, releaseUpdates = [] }) =>
  sanitizeFeedbackItems(items).map((item) => {
    const triage = evaluateFeedbackSubmission({
      content: item.content,
      releaseUpdates,
    });

    return {
      ...item,
      codex_comment: triage.codexComment,
      status_tag: triage.statusTag,
      moderation_status: triage.moderationStatus,
      review_version: FEEDBACK_REVIEW_VERSION,
    };
  });

const getFeedbackStatusUi = (statusTag) => {
  if (statusTag === "yapildi") {
    return {
      label: "Yaptım, teşekkürler",
      className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
    };
  }
  if (statusTag === "yapim_asamasinda") {
    return {
      label: "Yapım Aşamasında",
      className: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
    };
  }
  if (statusTag === "kotu_fikir") {
    return {
      label: "Kötü Fikir",
      className: "bg-red-500/15 text-red-300 border border-red-500/40",
    };
  }
  return {
    label: "Güzel Fikir",
    className: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40",
  };
};

const resolveFeedbackDisplayState = ({ item, releaseUpdates }) => {
  if (!item) return item;
  const triage = evaluateFeedbackSubmission({
    content: item.content,
    releaseUpdates,
  });

  return {
    ...item,
    moderation_status: triage.moderationStatus,
    status_tag: triage.statusTag,
    codex_comment: triage.codexComment,
    review_version: FEEDBACK_REVIEW_VERSION,
  };
};

const buildFeedbackErrorText = (errorOrMessage = "") => {
  if (typeof errorOrMessage === "string") return errorOrMessage;
  if (!errorOrMessage || typeof errorOrMessage !== "object") return String(errorOrMessage || "");
  const parts = [
    errorOrMessage?.message,
    errorOrMessage?.details,
    errorOrMessage?.hint,
    errorOrMessage?.code,
    errorOrMessage?.cause?.message,
    errorOrMessage?.cause?.details,
    errorOrMessage?.cause?.hint,
    errorOrMessage?.cause?.code,
  ].filter(Boolean);
  return parts.join(" | ");
};

const isFeedbackTableMissingError = (errorOrMessage = "") => {
  const message = buildFeedbackErrorText(errorOrMessage);
  return /(feedback_items|public\.feedback_items|schema\s*cache|pgrst205|42p01|relation .*feedback_items|does not exist|bulunamadi|not found|could not find the table)/i.test(
    String(message || "")
  );
};

const parseFeedbackRuntimeDetails = (details = "") => {
  try {
    const parsed = JSON.parse(String(details || "{}"));
    if (parsed?.type !== "feedback_item") return null;
    return parsed;
  } catch {
    return null;
  }
};

const getSupabaseStorageKey = () => {
  try {
    const projectRef = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
};

const decodeJwtExpiry = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized));
    return typeof parsed?.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
};

const readCachedAccessToken = () => {
  const key = getSupabaseStorageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const candidates = [
      parsed?.access_token,
      parsed?.currentSession?.access_token,
      parsed?.session?.access_token,
      Array.isArray(parsed) ? parsed?.[0]?.access_token : null,
      Array.isArray(parsed) ? parsed?.[0]?.currentSession?.access_token : null,
    ].filter(Boolean);

    const nowEpoch = Math.floor(Date.now() / 1000);
    const valid = candidates.find((token) => {
      const exp = decodeJwtExpiry(token);
      return exp && exp > nowEpoch + 30;
    });
    return valid || candidates[0] || null;
  } catch {
    return null;
  }
};

const deriveStatsFromUiLoads = (uiLoads = []) => {
  const citySet = new Set();
  uiLoads.forEach((load) => {
    if (load?.from) citySet.add(String(load.from).trim());
    if (load?.to) citySet.add(String(load.to).trim());
  });
  return {
    activeLoads: uiLoads.length,
    activeCities: citySet.size,
  };
};

// ─── SMALL COMPONENTS ───
const TrailerBadge = ({ type, big }) => {
  const d = dorseTypes.find(d => d.k === type) || dorseTypes[0];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-bold ${big ? "text-sm" : "text-xs"}`} style={{ background: d.color }}>{d.icon} {type}</span>;
};

const Stars = ({ n, size = "sm" }) => {
  const full = Math.floor(n);
  return <div className="flex items-center gap-0.5">
    {[...Array(5)].map((_, i) => <span key={i} className={`${size === "lg" ? "text-xl" : "text-sm"} ${i < full ? "text-amber-400" : "text-gray-600"}`}>★</span>)}
    <span className={`${size === "lg" ? "text-base" : "text-xs"} text-white font-bold ml-1`}>{n}</span>
  </div>;
};

const KdvBadge = ({ included, big }) => included
  ? <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold ${big ? "text-sm" : "text-[10px]"}`}>+KDV Dahil</span>
  : <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-bold ${big ? "text-sm" : "text-[10px]"}`}>KDV Hariç</span>;

const FreshTag = ({ d }) => {
  const [l, c] = d === 0 ? ["Bugün", "text-green-400"] : d <= 2 ? [`${d}g`, "text-yellow-400"] : [`${d}g`, "text-orange-400"];
  return <span className={`${c} text-xs font-bold`}>{l}</span>;
};

const estimateEtaLabel = (distanceValue) => {
  const km = Number(String(distanceValue || "").replace(/[^\d.]/g, ""));
  if (!km || Number.isNaN(km)) return "ETA hesaplanamadı";
  const totalHours = (km / 65) + 1.5; // ortalama yol + yükleme/boşaltma tamponu
  if (totalHours < 24) return `ETA ~${Math.ceil(totalHours)} saat`;
  const days = Math.floor(totalHours / 24);
  const hours = Math.ceil(totalHours % 24);
  return `ETA ~${days}g ${hours}s`;
};

const DemorajBar = ({ hours }) => {
  const pct = Math.min((hours / 10) * 100, 100);
  const clr = hours <= 3 ? "#059669" : hours <= 5 ? "#f59e0b" : "#ef4444";
  return <div className="flex items-center gap-2 w-full">
    <span className="text-slate-400 text-xs w-16 shrink-0">Boşaltma:</span>
    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: clr }} /></div>
    <span className="text-white text-xs font-bold w-14 text-right">{hours} saat</span>
  </div>;
};

const RatingBars = ({ ratings }) => {
  const items = [{ k: "speed", l: "⚡ Hız", v: ratings.speed }, { k: "payment", l: "💰 Ödeme", v: ratings.payment }, { k: "comm", l: "💬 İletişim", v: ratings.comm }];
  return <div className="space-y-2">{items.map(i => <div key={i.k} className="flex items-center gap-2">
    <span className="text-xs text-slate-300 w-20 shrink-0">{i.l}</span>
    <div className="flex-1 h-2.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(i.v / 5) * 100}%`, background: i.v >= 4 ? "#22c55e" : i.v >= 3 ? "#f59e0b" : "#ef4444" }} /></div>
    <span className="text-white text-xs font-bold w-6 text-right">{i.v}</span>
  </div>)}</div>;
};

// ─── LIVE STATS ───
const useAnimatedCount = (target, duration = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

const TrustScoreRing = ({ score }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="24" cy="24" r={radius} stroke="#334155" strokeWidth="3" fill="transparent" />
        <circle 
          cx="24" cy="24" r={radius} 
          stroke={score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"} 
          strokeWidth="3" 
          fill="transparent" 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{score}</span>
    </div>
  );
};

// ─── MAIN APP ───
export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [realLoads, setRealLoads] = useState([]);
  const [prevScreen, setPrevScreen] = useState(null);
  const [city, setCity] = useState(null);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [detailTab, setDetailTab] = useState("detail");
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success"); // success, error
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatMessages, setChatMessages] = useState([{ from: "bot", text: "Merhaba! YükCep destek hattına hoş geldiniz. Size nasıl yardımcı olabilirim?" }]);
  const [empForm, setEmpForm] = useState({ from: "", to: "", type: "", trailer: "Kapalı", price: "", kdv: true, fleet: false, trucks: 1, date: "Pazartesi" });
  const [formErrors, setFormErrors] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [publicStats, setPublicStats] = useState({ activeLoads: 0, activeDrivers: 0, activeCities: 0 });
  const chatEndRef = useRef(null);

  // Splash & effects
  const [showSplash, setShowSplash] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [screenKey, setScreenKey] = useState(0); // for page transitions

  // Auth state
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [selectedLoadDetail, setSelectedLoadDetail] = useState(null);
  const [driverFeedItems, setDriverFeedItems] = useState([]);
  const [employerFeedItems, setEmployerFeedItems] = useState([]);
  const [driverFeedTab, setDriverFeedTab] = useState("all");
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");

  // NOTIFICATIONS
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // BIDDING
  const [bidPrice, setBidPrice] = useState("");
  const [hasBid, setHasBid] = useState(false);
  const [loadBids, setLoadBids] = useState([]);
  const [isProcessingBid, setIsProcessingBid] = useState(false);
  const [isReportingLoad, setIsReportingLoad] = useState(false);
  const [isPostingLoad, setIsPostingLoad] = useState(false);
  const [postLoadError, setPostLoadError] = useState("");
  const [persistentError, setPersistentError] = useState(null);
  const [runtimeLogs, setRuntimeLogs] = useState([]);
  const [showRuntimeLogs, setShowRuntimeLogs] = useState(false);
  const [releaseUpdates, setReleaseUpdates] = useState(RELEASE_UPDATES_SEED);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isPostingFeedback, setIsPostingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [roleSwitchPopup, setRoleSwitchPopup] = useState(null);
  const [userSettings, setUserSettings] = useState(DEFAULT_USER_SETTINGS);
  const remoteLogQueueRef = useRef([]);
  const remoteLogTimerRef = useRef(null);
  const remoteLogFlushRef = useRef(null);
  const remoteLogInFlightRef = useRef(false);
  const remoteLogDisabledRef = useRef(false);
  const runtimeSessionIdRef = useRef(getRuntimeSessionId());
  const latestRealLoadsRef = useRef([]);
  const publicStatsFetchPromiseRef = useRef(null);
  const publicStatsLastFetchAtRef = useRef(0);
  const loadsFetchPromiseRef = useRef(null);
  const loadsLastFetchAtRef = useRef(0);
  const loadsFetchKeyRef = useRef("");
  const feedbackFetchPromiseRef = useRef(null);
  const feedbackLastFetchAtRef = useRef(0);

  useEffect(() => {
    latestRealLoadsRef.current = realLoads;
  }, [realLoads]);

  const flushRemoteRuntimeLogs = useCallback(async () => {
    if (remoteLogDisabledRef.current || remoteLogInFlightRef.current) return;
    if (!remoteLogQueueRef.current.length) return;
    if (remoteLogTimerRef.current) {
      clearTimeout(remoteLogTimerRef.current);
      remoteLogTimerRef.current = null;
    }

    const batch = remoteLogQueueRef.current.splice(0, 25);
    remoteLogInFlightRef.current = true;
    try {
      await insertRuntimeLogsApi({ logs: batch });
    } catch (error) {
      const message = String(error?.message || "");
      const lower = message.toLowerCase();
      const isConfigError =
        lower.includes("runtime_logs") ||
        lower.includes("does not exist") ||
        lower.includes("permission") ||
        lower.includes("policy");

      if (isConfigError) {
        if (!remoteLogDisabledRef.current) {
          const localWarn = {
            id: `${Date.now()}-remotelog`,
            at: new Date().toISOString(),
            level: "warn",
            event: "REMOTE_LOG_SYNC_DISABLED",
            details: "runtime_logs tablosu/policy eksik. schema.sql uygulanana kadar sadece local log tutulacak.",
          };
          setRuntimeLogs((prev) => {
            const merged = [localWarn, ...prev].slice(0, 100);
            try {
              localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // noop
            }
            return merged;
          });
        }
        remoteLogDisabledRef.current = true;
        console.warn("runtime_logs sync disabled:", message);
      } else {
        remoteLogQueueRef.current = [...batch, ...remoteLogQueueRef.current].slice(0, 120);
      }
    } finally {
      remoteLogInFlightRef.current = false;
      if (remoteLogQueueRef.current.length && !remoteLogDisabledRef.current) {
        if (remoteLogTimerRef.current) {
          clearTimeout(remoteLogTimerRef.current);
          remoteLogTimerRef.current = null;
        }
        remoteLogTimerRef.current = setTimeout(() => {
          remoteLogTimerRef.current = null;
          remoteLogFlushRef.current?.();
        }, REMOTE_LOG_FLUSH_DELAY_MS);
      }
    }
  }, []);

  useEffect(() => {
    remoteLogFlushRef.current = flushRemoteRuntimeLogs;
  }, [flushRemoteRuntimeLogs]);

  const enqueueRemoteRuntimeLog = useCallback((logRow) => {
    if (remoteLogDisabledRef.current) return;
    remoteLogQueueRef.current.push(logRow);
    if (remoteLogQueueRef.current.length >= REMOTE_LOG_FLUSH_SIZE) {
      if (remoteLogTimerRef.current) {
        clearTimeout(remoteLogTimerRef.current);
        remoteLogTimerRef.current = null;
      }
      remoteLogFlushRef.current?.();
      return;
    }
    if (!remoteLogTimerRef.current) {
      remoteLogTimerRef.current = setTimeout(() => {
        remoteLogTimerRef.current = null;
        remoteLogFlushRef.current?.();
      }, REMOTE_LOG_FLUSH_DELAY_MS);
    }
  }, []);

  const appendRuntimeLog = useCallback((level, event, details = "", options = {}) => {
    const detailText = String(details || "").slice(0, 320);
    const nowIso = new Date().toISOString();
    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: nowIso,
      level,
      event,
      details: detailText,
    };
    setRuntimeLogs((prev) => {
      const merged = [next, ...prev].slice(0, 100);
      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore storage quota errors.
      }
      return merged;
    });

    if (!options?.skipRemote) {
      enqueueRemoteRuntimeLog({
        client_event_at: nowIso,
        level: String(level || "info").toLowerCase(),
        event_code: String(event || "UNKNOWN"),
        details: sanitizeRemoteLogDetails(detailText),
        session_id: runtimeSessionIdRef.current,
        user_id: user?.id || null,
        screen: screen || null,
        app_version: APP_VERSION,
      });
    }
  }, [enqueueRemoteRuntimeLog, screen, user?.id]);

  const clearRuntimeLogs = useCallback(() => {
    setRuntimeLogs([]);
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch {
      // noop
    }
  }, []);

  const persistPublicStats = useCallback((nextStats) => {
    const sanitized = {
      activeLoads: Number(nextStats?.activeLoads) || 0,
      activeDrivers: Number(nextStats?.activeDrivers) || 0,
      activeCities: Number(nextStats?.activeCities) || 0,
    };
    setPublicStats(sanitized);
    try {
      localStorage.setItem(PUBLIC_STATS_CACHE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore cache write failures
    }
    return sanitized;
  }, []);

  const persistReleaseUpdates = useCallback((nextItems) => {
    const sanitized = sanitizeReleaseUpdates(nextItems);
    setReleaseUpdates(sanitized);
    try {
      localStorage.setItem(RELEASE_UPDATES_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore cache write failures
    }
    return sanitized;
  }, []);

  const persistFeedbackItems = useCallback((nextItems, options = {}) => {
    const reviewed = retagFeedbackItemsFromScratch({
      items: nextItems,
      releaseUpdates: Array.isArray(options?.releaseUpdates) ? options.releaseUpdates : releaseUpdates,
    });
    setFeedbackItems(reviewed);
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(reviewed));
    } catch {
      // ignore cache write failures
    }
    return reviewed;
  }, [releaseUpdates]);

  const applyLocalStatsFallback = useCallback((candidateLoads, options = {}) => {
    const localDerived = deriveStatsFromUiLoads(candidateLoads);
    setPublicStats((prev) => {
      const prevLoads = Number(prev?.activeLoads) || 0;
      const prevDrivers = Number(prev?.activeDrivers) || 0;
      const prevCities = Number(prev?.activeCities) || 0;
      const derivedLoads = Number(localDerived?.activeLoads) || 0;
      const derivedCities = Number(localDerived?.activeCities) || 0;
      const nextLoads = options.incrementLoads
        ? Math.max(derivedLoads, prevLoads + 1)
        : derivedLoads;
      const nextCities = options.incrementLoads
        ? Math.max(derivedCities, prevCities)
        : derivedCities;
      const next = {
        activeLoads: nextLoads,
        activeDrivers: prevDrivers,
        activeCities: nextCities,
      };

      if (
        next.activeLoads === prevLoads &&
        next.activeDrivers === prevDrivers &&
        next.activeCities === prevCities
      ) {
        return prev;
      }

      try {
        localStorage.setItem(PUBLIC_STATS_CACHE_KEY, JSON.stringify(next));
      } catch {
        // ignore cache write failures
      }
      return next;
    });
  }, []);

  const copyRuntimeLogs = useCallback(async () => {
    if (!runtimeLogs.length) {
      showToast("Kopyalanacak log yok.", "error");
      return;
    }
    const payload = runtimeLogs
      .slice(0, 30)
      .map((log) => `[${new Date(log.at).toLocaleString("tr-TR")}] ${log.level.toUpperCase()} ${log.event} :: ${log.details}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      showToast("📋 Loglar panoya kopyalandı.");
    } catch {
      showToast("Loglar kopyalanamadı.", "error");
    }
  }, [runtimeLogs]);

  const withTimeout = useCallback(async (promise, timeoutMs, timeoutMessage) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRuntimeLogs(parsed.slice(0, 100));
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PUBLIC_STATS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.activeLoads === "number" &&
        typeof parsed.activeDrivers === "number" &&
        typeof parsed.activeCities === "number"
      ) {
        setPublicStats(parsed);
      }
    } catch {
      // ignore malformed stats cache
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RELEASE_UPDATES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const merged = sanitizeReleaseUpdates([...RELEASE_UPDATES_SEED, ...(Array.isArray(parsed) ? parsed : [])]);
      persistReleaseUpdates(merged);
    } catch {
      persistReleaseUpdates(RELEASE_UPDATES_SEED);
    }
  }, [persistReleaseUpdates]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        persistFeedbackItems(parsed);
      }
    } catch {
      // ignore malformed feedback cache
    }
  }, [persistFeedbackItems]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setUserSettings({
          ...DEFAULT_USER_SETTINGS,
          ...parsed,
        });
      }
    } catch {
      // ignore malformed settings
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
    } catch {
      // ignore settings write failures
    }
  }, [userSettings]);

  useEffect(() => {
    const hasOverlay = showSettingsPanel || showProfileCard || showNotifications || Boolean(roleSwitchPopup);
    if (!hasOverlay) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [roleSwitchPopup, showNotifications, showProfileCard, showSettingsPanel]);

  useEffect(() => {
    const flushNow = () => {
      remoteLogFlushRef.current?.();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushNow();
      }
    };

    window.addEventListener("beforeunload", flushNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (remoteLogTimerRef.current) {
        clearTimeout(remoteLogTimerRef.current);
        remoteLogTimerRef.current = null;
      }
      flushNow();
    };
  }, []);

  useEffect(() => {
    const onWindowError = (event) => {
      appendRuntimeLog("error", "JS_ERROR", event?.message || "Unknown window error");
    };
    const onUnhandled = (event) => {
      const reason = event?.reason?.message || String(event?.reason || "Unhandled promise rejection");
      appendRuntimeLog("error", "UNHANDLED_PROMISE", reason);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, [appendRuntimeLog]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchNotificationsApi(user.id);
      setNotifications(data);
      const unread = data.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user]);

  // NOTIFICATION & BIDDING HOOKS
  useEffect(() => {
    if (user) {
      // 1. Initial Fetch
      fetchNotifications();

      // 2. Realtime Subscription
      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newNotif = payload.new;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            if (userSettings.notificationsEnabled) {
              showToast(`🔔 ${newNotif.message}`);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [fetchNotifications, user, userSettings.notificationsEnabled]);

  const markNotificationRead = async (id) => {
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false;
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await markNotificationReadApi(id);
    } catch (error) {
      console.error("Error marking notification read:", error);
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      showToast("Bildirim güncellenemedi", "error");
    }
  };

  const fetchBidsForLoad = async (loadId) => {
    if (!loadId) return;
    try {
      const accessToken = readCachedAccessToken();
      let data = null;
      try {
        data = await withTimeout(
          fetchBidsForLoadApi(loadId),
          10000,
          "Teklif listesi sorgusu zaman aşımına uğradı (10sn)."
        );
      } catch (primaryError) {
        appendRuntimeLog("warn", "BIDS_SUPABASE_FAIL", primaryError?.message || "Bids supabase failed");
        data = await withTimeout(
          fetchBidsForLoadViaRestApi({ loadId, accessToken, timeoutMs: 12000 }),
          13000,
          "Teklif listesi fallback zaman aşımına uğradı (13sn)."
        );
        appendRuntimeLog("info", "BIDS_REST_OK", `load=${loadId} rows=${(data || []).length}`);
      }
      setLoadBids(data || []);
    } catch (error) {
      console.error("Error fetching bids:", error);
      appendRuntimeLog("error", "BIDS_FETCH_FAIL", error?.message || "Bids fetch failed");
    }
  };

  const handleToggleNotification = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      // Mark all as read when opening? Or individually?
      // Let's keep it manual for now, or auto-mark on click
    }
  };

  // Notifications moved up

  const nav = useCallback((s) => {
    setPrevScreen(screen);
    setScreen(s);
    if (s !== "loadDetail") {
      setSelectedLoad(null);
    }
    setDetailTab("detail");
    setScreenKey(k => k + 1); // trigger page transition
  }, [screen]);

  const resolveBackScreen = useCallback(() => {
    if (screen === "map") return "location";
    if (screen === "location") return "welcome";
    if (screen === "employer") return "welcome";
    if (screen === "legal" || screen === "support") return "welcome";
    if (screen === "fleet" || screen === "calendar") return "map";
    if (screen === "driverFeed" || screen === "employerFeed") return "welcome";
    return prevScreen === "employer" ? "employer" : "welcome";
  }, [prevScreen, screen]);

  const handleLocationSelect = useCallback((selectedCity) => {
    if (!selectedCity) return;
    setFilterFrom(selectedCity);
    setFilterTo("");
    setFilterTrailer("");
    setCity(selectedCity);
    setLocationQuery("");
    nav("map");
  }, [nav]);

  const loadDriverFeed = useCallback(async () => {
    if (!user) return;
    setIsFeedLoading(true);
    setFeedError("");
    try {
      let feed = [];
      try {
        feed = await withTimeout(
          fetchDriverFeedApi({ userId: user.id }),
          12000,
          "Şoför feed sorgusu zaman aşımına uğradı (12sn)."
        );
      } catch (primaryError) {
        appendRuntimeLog("warn", "DRIVER_FEED_SUPABASE_FAIL", primaryError?.message || "Driver feed timeout");
        const accessToken = readCachedAccessToken();
        feed = await withTimeout(
          fetchDriverFeedViaRestApi({
            userId: user.id,
            accessToken,
            timeoutMs: 13000,
          }),
          14000,
          "Şoför feed fallback zaman aşımına uğradı (14sn)."
        );
        appendRuntimeLog("info", "DRIVER_FEED_REST_OK", `rows=${(feed || []).length}`);
      }
      setDriverFeedItems(feed || []);
      appendRuntimeLog("info", "DRIVER_FEED_OK", `rows=${(feed || []).length}`);
    } catch (error) {
      setFeedError(error?.message || "Şoför feed alınamadı.");
      appendRuntimeLog("error", "DRIVER_FEED_FAIL", error?.message || "Driver feed failed");
    } finally {
      setIsFeedLoading(false);
    }
  }, [appendRuntimeLog, user, withTimeout]);

  const loadEmployerFeed = useCallback(async () => {
    if (!user) return;
    setIsFeedLoading(true);
    setFeedError("");
    try {
      let feed = [];
      try {
        feed = await withTimeout(
          fetchEmployerFeedApi({ userId: user.id }),
          12000,
          "İşveren feed sorgusu zaman aşımına uğradı (12sn)."
        );
      } catch (primaryError) {
        appendRuntimeLog("warn", "EMPLOYER_FEED_SUPABASE_FAIL", primaryError?.message || "Employer feed timeout");
        const accessToken = readCachedAccessToken();
        feed = await withTimeout(
          fetchEmployerFeedViaRestApi({
            userId: user.id,
            accessToken,
            timeoutMs: 13000,
          }),
          14000,
          "İşveren feed fallback zaman aşımına uğradı (14sn)."
        );
        appendRuntimeLog("info", "EMPLOYER_FEED_REST_OK", `rows=${(feed || []).length}`);
      }
      setEmployerFeedItems(feed || []);
      appendRuntimeLog("info", "EMPLOYER_FEED_OK", `rows=${(feed || []).length}`);
    } catch (error) {
      setFeedError(error?.message || "İşveren feed alınamadı.");
      appendRuntimeLog("error", "EMPLOYER_FEED_FAIL", error?.message || "Employer feed failed");
    } finally {
      setIsFeedLoading(false);
    }
  }, [appendRuntimeLog, user, withTimeout]);

  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const latestMessage = String(notifications[0]?.message || "").toLocaleLowerCase("tr-TR");
    if (screen === "driverFeed" && /(kabul edildi|reddedildi|başka teklif kabul edildi)/i.test(latestMessage)) {
      loadDriverFeed();
      return;
    }
    if (screen === "employerFeed" && /yeni teklif/i.test(latestMessage)) {
      loadEmployerFeed();
    }
  }, [loadDriverFeed, loadEmployerFeed, notifications, screen, user]);

  const handleLoadClick = async (loadId) => {
    // 1. Find basic load info from local state for immediate feedback
    const normalizedLoadId = Number(loadId);
    const basicLoad = realLoads.find(l => Number(l.id) === normalizedLoadId);
    if (basicLoad) {
      setSelectedLoadDetail({
        ...basicLoad,
        employerName: basicLoad.employer || "İşveren",
        employerPhone: null,
        employerAvatar: basicLoad.employerAvatar || null,
        employerRole: "employer",
        raw: {
          id: basicLoad.id,
          employer_id: null,
        },
      });
    }
    
    // 2. Navigate to screen
    nav("loadDetail");
    
    // Reset Bidding State
    setLoadBids([]);
    setHasBid(false);
    setBidPrice("");
    
    // 3. Fetch full details including employer profile
    try {
      let data = null;
      try {
        data = await withTimeout(
          fetchLoadDetailsApi(normalizedLoadId || loadId),
          10000,
          "Yük detay sorgusu zaman aşımına uğradı (10sn)."
        );
      } catch (primaryError) {
        appendRuntimeLog("warn", "LOAD_DETAIL_SUPABASE_FAIL", primaryError?.message || "Supabase detail failed");
        data = await withTimeout(
          fetchLoadDetailsViaRestApi({ loadId: normalizedLoadId || loadId, timeoutMs: 12000 }),
          13000,
          "Yük detay fallback zaman aşımına uğradı (13sn)."
        );
        appendRuntimeLog("info", "LOAD_DETAIL_REST_OK", `load_id=${normalizedLoadId || loadId}`);
      }
        
      if (data) {
        // Merge Supabase data with UI mapping logic
        const detailedLoad = {
          ...mapDbToUi(data),
          // Add extra details from profiles join
          employerProfile: data.profiles || null,
          employerName: data.profiles?.full_name || "Anonim",
          employerPhone: data.profiles?.phone || null,
          employerAvatar: data.profiles?.avatar_url || null,
          employerRole: data.profiles?.role || "user",
          // Keep raw data if needed
          raw: data
        };
        setSelectedLoadDetail(detailedLoad);

        // 4. Fetch Bids
        if (user) {
          // Check if I am the owner
          if (data.employer_id === user.id) {
            fetchBidsForLoad(normalizedLoadId || loadId);
          } else {
            // Check if I already bid
            const myBid = await fetchMyBidForLoadApi(normalizedLoadId || loadId, user.id);
            
            if (myBid) {
              setHasBid(true);
              setBidPrice(myBid.price.toString());
            }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching load details:", e);
      appendRuntimeLog("error", "LOAD_DETAIL_FAIL", e?.message || "Load detail fetch failed");
      showToast("Yük detayı yüklenemedi.", "error");
    }
  };

  const submitBid = async () => {
    if (!user || !selectedLoadDetail || !bidPrice) return;
    if (userSettings.requireEmailVerified && !isEmailVerified) {
      showToast("Teklif için e-posta doğrulaması gerekli.", "error");
      pushPersistentError("EMAIL_VERIFY", "E-posta doğrulanmadan teklif gönderilemez.");
      return;
    }
    if (userSettings.requirePhoneOnActions && !hasVerifiedPhone) {
      showToast("Teklif için geçerli telefon bilgisi gerekli.", "error");
      pushPersistentError("PHONE_VERIFY", "Telefon doğrulaması olmadan teklif gönderilemez.");
      return;
    }
    setIsProcessingBid(true);

    const price = parseFloat(bidPrice);
    if (isNaN(price)) {
      showToast("Geçersiz fiyat", "error");
      setIsProcessingBid(false);
      return;
    }

    try {
      const accessToken = readCachedAccessToken();
      let createdBid = null;
      const createBidWithBestRoute = async (timeoutMs) => {
        if (accessToken) {
          return createBidViaRestApi({
            loadId: selectedLoadDetail.id,
            driverId: user.id,
            price,
            accessToken,
            timeoutMs: Math.max(5000, timeoutMs - 1000),
          });
        }
        return withTimeout(
          createBidApi({
            loadId: selectedLoadDetail.id,
            driverId: user.id,
            price,
          }),
          timeoutMs,
          `Teklif gönderme zaman aşımına uğradı (${Math.ceil(timeoutMs / 1000)}sn).`
        );
      };

      // 1. Insert Bid (timeout + retry to avoid sticky "Gönderiliyor..." state)
      try {
        createdBid = await createBidWithBestRoute(15000);
      } catch (firstBidError) {
        appendRuntimeLog("warn", "BID_SUBMIT_RETRY", firstBidError?.message || "Bid timeout, retrying");
        try {
          createdBid = await createBidWithBestRoute(25000);
        } catch (secondBidError) {
          const message = String(secondBidError?.message || "").toLocaleLowerCase("tr-TR");
          const isDuplicate =
            message.includes("duplicate key") ||
            message.includes("unique constraint") ||
            message.includes("already") ||
            message.includes("zaten");
          let existingBid = null;
          try {
            existingBid = await withTimeout(
              fetchMyBidForLoadApi(selectedLoadDetail.id, user.id),
              12000,
              "Teklif doğrulama zaman aşımına uğradı (12sn)."
            );
          } catch (verifyError) {
            appendRuntimeLog("warn", "BID_VERIFY_WARN", verifyError?.message || "Bid verify failed");
          }

          if (isDuplicate || existingBid) {
            createdBid = existingBid || createdBid;
            appendRuntimeLog(
              "warn",
              "BID_SUBMIT_RECOVERED",
              isDuplicate ? "Retry duplicate'a dustu, mevcut teklif kullanildi." : "Timeout sonrasi mevcut teklif bulundu."
            );
          } else {
            throw secondBidError;
          }
        }
      }

      // 2. Notify Employer (non-blocking for bidder UX)
      try {
        const bidIdTag = createdBid?.id ? `[BID:${createdBid.id}] ` : "";
        const notifyMessage = `Yeni Teklif ${bidIdTag}${selectedLoadDetail.from} -> ${selectedLoadDetail.to} ${price}₺`;
        await withTimeout(
          createNotificationApi({
            userId: selectedLoadDetail.raw.employer_id,
            actorId: user.id,
            message: notifyMessage,
          }),
          10000,
          "Teklif bildirimi zaman aşımına uğradı (10sn)."
        );
      } catch (notifyError) {
        appendRuntimeLog("warn", "BID_NOTIFY_WARN", notifyError?.message || "Notification timeout");
      }

      setHasBid(true);
      appendRuntimeLog("info", "BID_SUBMIT_OK", `load=${selectedLoadDetail.id} price=${price}`);
      showToast(`✅ Teklifiniz İletildi: ${price}₺`);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      if (screen === "driverFeed") {
        loadDriverFeed();
      }

    } catch (e) {
      console.error("Error submitting bid:", e);
      appendRuntimeLog("error", "BID_SUBMIT_FAIL", e?.message || "Bid submit failed");
      showToast("Teklif gönderilemedi", "error");
      pushPersistentError("BID_SUBMIT", e?.message || "Teklif gönderilemedi.");
    } finally {
      setIsProcessingBid(false);
    }
  };

  const respondToBid = async (bidId, driverId, action) => { // action: 'ACCEPTED' | 'REJECTED'
    if (!user) {
      showToast("Oturum bulunamadı", "error");
      return;
    }
    try {
      appendRuntimeLog("info", "BID_DECISION_STARTED", `bid=${bidId} action=${action}`);
      const accessToken = readCachedAccessToken();
      const pickupDateText = selectedLoadDetail?.raw?.pickup_date
        ? formatDateOnly(selectedLoadDetail.raw.pickup_date)
        : "Belirlenecek";
      const updateBidStatusReliable = async (targetBidId, targetStatus, timeoutMs) => {
        if (accessToken) {
          try {
            const restResult = await withTimeout(
              updateBidStatusViaRestApi({
                bidId: targetBidId,
                status: targetStatus,
                accessToken,
                timeoutMs: Math.max(5000, timeoutMs - 1000),
              }),
              timeoutMs + 1500,
              `Teklif durumu REST güncellenemedi (${Math.ceil((timeoutMs + 1500) / 1000)}sn).`
            );
            if (restResult?.id) return restResult;
            throw new Error("REST update boş döndü.");
          } catch (restError) {
            appendRuntimeLog("warn", "BID_DECISION_BID_REST_FAIL", restError?.message || "Bid REST failed");
          }
        }
        const primaryResult = await withTimeout(
          updateBidStatusApi({ bidId: targetBidId, status: targetStatus }),
          timeoutMs,
          `Teklif durumu güncellenemedi (${Math.ceil(timeoutMs / 1000)}sn).`
        );
        if (!primaryResult?.id) {
          throw new Error("Teklif durumu güncellendi ama satır dönmedi.");
        }
        return primaryResult;
      };
      const updateLoadStatusReliable = async (targetLoadId, targetStatus, timeoutMs) => {
        if (accessToken) {
          try {
            const restResult = await withTimeout(
              updateLoadStatusViaRestApi({
                loadId: targetLoadId,
                status: targetStatus,
                accessToken,
                timeoutMs: Math.max(5000, timeoutMs - 1000),
              }),
              timeoutMs + 1500,
              `İlan durumu REST güncellenemedi (${Math.ceil((timeoutMs + 1500) / 1000)}sn).`
            );
            if (restResult?.id) return restResult;
            throw new Error("REST load update boş döndü.");
          } catch (restError) {
            appendRuntimeLog("warn", "BID_DECISION_LOAD_REST_FAIL", restError?.message || "Load REST failed");
          }
        }
        const primaryResult = await withTimeout(
          updateLoadStatusApi({ loadId: targetLoadId, status: targetStatus }),
          timeoutMs,
          `İlan durumu güncellenemedi (${Math.ceil(timeoutMs / 1000)}sn).`
        );
        if (!primaryResult?.id) {
          throw new Error("İlan durumu güncellendi ama satır dönmedi.");
        }
        return primaryResult;
      };

      // 1. Update Bid
      await updateBidStatusReliable(bidId, action, 15000);

      // 2. Notify Driver (non-blocking)
      const statusText = action === 'ACCEPTED' ? 'KABUL EDİLDİ ✅' : 'REDDEDİLDİ ❌';
      try {
        await withTimeout(
          createNotificationApi({
            userId: driverId,
            actorId: user.id,
            message: `Teklifiniz ${statusText}: ${selectedLoadDetail.from} -> ${selectedLoadDetail.to}. Yükleme: ${pickupDateText}.`,
          }),
          10000,
          "Teklif karar bildirimi zaman aşımına uğradı (10sn)."
        );
      } catch (notifyDriverError) {
        appendRuntimeLog("warn", "BID_NOTIFY_DECISION_WARN", notifyDriverError?.message || "Decision notify failed");
      }

      if (action === "ACCEPTED") {
        // Keep marketplace consistent: accepted offer closes load and rejects pending alternatives.
        await updateLoadStatusReliable(selectedLoadDetail.id, "assigned", 15000);
        const pendingOthers = loadBids.filter((bid) => bid.id !== bidId && bid.status === "PENDING");
        for (const otherBid of pendingOthers) {
          await updateBidStatusReliable(otherBid.id, "REJECTED", 12000);
          try {
            await withTimeout(
              createNotificationApi({
                userId: otherBid.driver_id,
                actorId: user.id,
                message: `Bilgi: ${selectedLoadDetail.from} -> ${selectedLoadDetail.to} ilanında başka teklif kabul edildi.`,
              }),
              10000,
              "Alternatif teklif bildirimi zaman aşımına uğradı (10sn)."
            );
          } catch (notifyOtherError) {
            appendRuntimeLog("warn", "BID_NOTIFY_OTHER_WARN", notifyOtherError?.message || "Other notify failed");
          }
        }
      }

      // Update local state
      setLoadBids((prev) =>
        prev.map((bid) => {
          if (bid.id === bidId) return { ...bid, status: action };
          if (action === "ACCEPTED" && bid.status === "PENDING") return { ...bid, status: "REJECTED" };
          return bid;
        })
      );
      appendRuntimeLog("info", "BID_DECISION_OK", `bid=${bidId} action=${action}`);
      showToast(`Teklif ${action === 'ACCEPTED' ? 'kabul' : 'red'} edildi.`);
      fetchLoads({ force: true });
      fetchPublicStats();
      if (screen === "employerFeed") {
        loadEmployerFeed();
      }

    } catch (e) {
      console.error("Error responding to bid:", e);
      appendRuntimeLog("error", "BID_DECISION_FAIL", e?.message || "Bid decision failed");
      showToast("İşlem başarısız", "error");
      pushPersistentError("BID_DECISION", e?.message || "Teklif yanıt işlemi başarısız.");
    }
  };

  const handleSwitchRole = async (nextRole) => {
    if (!user || !nextRole) return;
    const normalizedRole = String(nextRole).toLowerCase() === "employer" ? "employer" : "driver";
    if (activeRole === normalizedRole) {
      showToast("Rol zaten aktif.");
      return;
    }
    setIsUpdatingRole(true);
    try {
      const updated = await withTimeout(
        updateProfileRoleApi({ userId: user.id, role: normalizedRole }),
        12000,
        "Rol güncelleme zaman aşımına uğradı (12sn)."
      );
      setProfile(updated);
      writeRoleHint(updated?.role || normalizedRole, user.id);
      setShowProfileCard(false);
      setShowSettingsPanel(false);
      setScreen("welcome");
      setRoleSwitchPopup(getRoleSwitchPopupContent(normalizedRole));
      appendRuntimeLog("info", "ROLE_SWITCH_OK", `role=${normalizedRole}`);
      showToast(normalizedRole === "employer" ? "🏢 İşveren rolüne geçildi." : "🚛 İş Arıyorum rolüne geçildi.");
    } catch (error) {
      appendRuntimeLog("error", "ROLE_SWITCH_FAIL", error?.message || "Role switch failed");
      showToast(`Rol değişmedi: ${error?.message || "Bilinmeyen hata"}`, "error");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const showToast = (msg, type = "success", durationMs) => {
    setToast(msg);
    setToastType(type);
    const ttl = typeof durationMs === "number" ? durationMs : (type === "error" ? 9000 : 3000);
    setTimeout(() => setToast(null), ttl);
  };

  const pushPersistentError = useCallback((source, message) => {
    const detail = String(message || "Beklenmeyen hata").trim();
    setPersistentError({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: String(source || "SYSTEM"),
      message: detail,
      at: new Date().toISOString(),
    });
  }, []);

  const updateUserSetting = useCallback((key, value) => {
    setUserSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleReportLoad = useCallback(async () => {
    if (!selectedLoadDetail?.id) return;
    if (!user?.id) {
      showToast("İlan raporlamak için giriş yapmalısın.", "error");
      nav("auth");
      return;
    }
    if (isReportingLoad) return;

    const rateKey = `yukcep_report_rate_v1:${user.id}:${selectedLoadDetail.id}`;
    const nowTs = Date.now();
    try {
      const previousTs = Number(localStorage.getItem(rateKey) || "0");
      if (previousTs && nowTs - previousTs < REPORT_RATE_LIMIT_MS) {
        const waitMin = Math.max(1, Math.ceil((REPORT_RATE_LIMIT_MS - (nowTs - previousTs)) / 60000));
        showToast(`Aynı ilan için tekrar rapor öncesi ${waitMin} dk bekleyin.`, "error");
        return;
      }
    } catch {
      // ignore cache parse/storage issues
    }

    const reason = window.prompt(
      "Rapor nedeni (en az 6 karakter):",
      "Şüpheli ilan / yanlış bilgi"
    );
    if (!reason) return;

    setIsReportingLoad(true);
    try {
      await withTimeout(
        createAbuseReportApi({
          loadId: selectedLoadDetail.id,
          reporterId: user.id,
          reason,
          details: `${selectedLoadDetail.from} -> ${selectedLoadDetail.to}`,
        }),
        10000,
        "Rapor gönderimi zaman aşımına uğradı (10sn)."
      );
      try {
        localStorage.setItem(rateKey, String(nowTs));
      } catch {
        // ignore cache write failures
      }
      appendRuntimeLog("warn", "ABUSE_REPORT_CREATED", `load_id=${selectedLoadDetail.id}`);
      showToast("Rapor alındı. Güvenlik ekibi inceleyecek.");
    } catch (error) {
      appendRuntimeLog("error", "ABUSE_REPORT_FAILED", error?.message || "Abuse report failed");
      pushPersistentError("ABUSE_REPORT", error?.message || "İlan raporu gönderilemedi.");
      showToast("Rapor gönderilemedi.", "error");
    } finally {
      setIsReportingLoad(false);
    }
  }, [
    appendRuntimeLog,
    isReportingLoad,
    nav,
    pushPersistentError,
    selectedLoadDetail,
    user?.id,
    withTimeout,
  ]);

  const handleSubmitFeedback = useCallback(async () => {
    const normalizedInput = sanitizeFeedbackText(feedbackInput);
    if (!normalizedInput) {
      showToast("Lütfen bir feedback yaz.", "error");
      return;
    }
    if (!user?.id) {
      showToast("Feedback bırakmak için giriş yapmalısın.", "error");
      nav("auth");
      return;
    }
    if (isPostingFeedback) return;

    const rateKey = `yukcep_feedback_rate_v1:${user.id}`;
    const nowTs = Date.now();
    try {
      const previousTs = Number(localStorage.getItem(rateKey) || "0");
      if (previousTs && nowTs - previousTs < FEEDBACK_RATE_LIMIT_MS) {
        const waitSec = Math.max(1, Math.ceil((FEEDBACK_RATE_LIMIT_MS - (nowTs - previousTs)) / 1000));
        showToast(`Yeni feedback için ${waitSec} sn bekleyin.`, "error");
        return;
      }
    } catch {
      // ignore local rate read failures
    }

    const triage = evaluateFeedbackSubmission({
      content: normalizedInput,
      releaseUpdates,
    });

    setIsPostingFeedback(true);
    try {
      const created = await withTimeout(
        createFeedbackItemApi({
          userId: user.id,
          authorName: profile?.full_name || user?.email?.split("@")[0] || "Kullanıcı",
          content: normalizedInput,
          codexComment: triage.codexComment,
          statusTag: triage.statusTag,
          moderationStatus: triage.moderationStatus,
        }),
        10000,
        "Feedback gönderimi zaman aşımına uğradı (10sn)."
      );

      setFeedbackItems((prev) => {
        const merged = sanitizeFeedbackItems([created, ...prev]);
        try {
          localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore storage failures
        }
        return merged;
      });
      setFeedbackInput("");
      setFeedbackError("");
      try {
        localStorage.setItem(rateKey, String(nowTs));
      } catch {
        // ignore storage write failures
      }

      appendRuntimeLog(
        "info",
        "FEEDBACK_CREATE_OK",
        `tag=${triage.statusTag} moderation=${triage.moderationStatus}`
      );
      if (triage.statusTag === "kotu_fikir") {
        showToast("Feedback kaydedildi ve filtrelendi.");
      } else if (triage.statusTag === "yapildi") {
        showToast("Feedback için durum: Yaptım ✅");
      } else {
        showToast("Feedback alındı. Durum: Yapacağım 🛠️");
      }
    } catch (error) {
      const message = error?.message || "Feedback gönderilemedi.";
      if (isFeedbackTableMissingError(error)) {
        const fallbackPayload = {
          type: "feedback_item",
          user_id: user.id,
          author_name: profile?.full_name || user?.email?.split("@")[0] || "Kullanıcı",
          content: normalizedInput,
          codex_comment: triage.codexComment,
          status_tag: triage.statusTag,
          moderation_status: triage.moderationStatus,
          review_version: FEEDBACK_REVIEW_VERSION,
        };
        let runtimeFallbackSaved = false;
        try {
          await withTimeout(
            insertRuntimeLogsApi({
              logs: [
                {
                  client_event_at: new Date().toISOString(),
                  level: "info",
                  event_code: "FEEDBACK_ITEM",
                  details: JSON.stringify(fallbackPayload),
                  session_id: runtimeSessionIdRef.current,
                  user_id: user.id,
                  screen: screen || null,
                  app_version: APP_VERSION,
                },
              ],
            }),
            9000,
            "Feedback fallback insert zaman aşımına uğradı (9sn)."
          );
          runtimeFallbackSaved = true;
        } catch (fallbackError) {
          appendRuntimeLog("error", "FEEDBACK_CREATE_FALLBACK_FAIL", fallbackError?.message || "Feedback fallback failed");
        }

        setFeedbackItems((prev) => {
              const fallbackRow = {
                id: `rt-local-${Date.now()}`,
                ...fallbackPayload,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
          const merged = sanitizeFeedbackItems([fallbackRow, ...prev]);
          try {
            localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore storage failures
          }
          return merged;
        });
        setFeedbackInput("");
        try {
          localStorage.setItem(rateKey, String(nowTs));
        } catch {
          // ignore storage write failures
        }

        if (runtimeFallbackSaved) {
          setFeedbackError("Feedback tablosu henüz yok. Geçici log fallback ile kaydedildi.");
          appendRuntimeLog("warn", "FEEDBACK_CREATE_FALLBACK", "feedback_items eksik, runtime_logs fallback kullanıldı.");
          showToast("Feedback alındı (geçici fallback).");
        } else {
          setFeedbackError("Feedback tablosu henüz yok. Yerel fallback ile kaydedildi.");
          appendRuntimeLog("warn", "FEEDBACK_CREATE_LOCAL_ONLY", "feedback_items/runtime_logs yok; local fallback kullanıldı.");
          showToast("Feedback alındı (yerel fallback).");
        }
        return;
      }

      appendRuntimeLog("error", "FEEDBACK_CREATE_FAIL", message);
      const feedbackCreateUiError = /timeout|zaman aşım/i.test(String(message || ""))
        ? "Feedback gönderimi gecikti. Lütfen tekrar dene."
        : "Feedback gönderilemedi. Lütfen tekrar dene.";
      setFeedbackError(feedbackCreateUiError);
      showToast("Feedback gönderilemedi.", "error");
      pushPersistentError("FEEDBACK", message);
    } finally {
      setIsPostingFeedback(false);
    }
  }, [
    appendRuntimeLog,
    feedbackInput,
    isPostingFeedback,
    nav,
    profile?.full_name,
    pushPersistentError,
    releaseUpdates,
    screen,
    user?.email,
    user?.id,
    withTimeout,
  ]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auth state change listener
  useEffect(() => {
    const applySessionUser = async (sessionUser) => {
      setUser(sessionUser);
      let fetchedProfile = null;
      try {
        fetchedProfile = await withTimeout(
          fetchProfileById(sessionUser.id),
          9000,
          "Profil sorgusu zaman aşımına uğradı (9sn)."
        );
      } catch (error) {
        console.error("Profile fetch failed:", error);
      }

      const resolvedRole =
        normalizeRoleHint(fetchedProfile?.role) ||
        readRoleHint(sessionUser.id) ||
        normalizeRoleHint(sessionUser?.user_metadata?.role) ||
        null;

      if (resolvedRole) {
        writeRoleHint(resolvedRole, sessionUser.id);
      }

      setProfile((prev) => ({
        ...(fetchedProfile || {}),
        id: sessionUser.id,
        full_name:
          fetchedProfile?.full_name ||
          prev?.full_name ||
          sessionUser?.user_metadata?.full_name ||
          sessionUser?.email ||
          "Kullanıcı",
        email: fetchedProfile?.email || prev?.email || sessionUser?.email || "",
        phone: fetchedProfile?.phone || prev?.phone || sessionUser?.user_metadata?.phone || "",
        role: resolvedRole,
      }));
    };

    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        applySessionUser(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await applySessionUser(session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [withTimeout]);

  const handleLogout = async () => {
    appendRuntimeLog("info", "LOGOUT_STARTED", "Kullanici cikis istegi gonderdi.");
    setShowProfileCard(false);
    setShowSettingsPanel(false);

    const forceLocalLogout = () => {
      const authStorageKey = getSupabaseStorageKey();
      if (authStorageKey) {
        try {
          localStorage.removeItem(authStorageKey);
        } catch {
          // ignore storage failures
        }
      }
      try {
        localStorage.removeItem(ROLE_HINT_KEY);
      } catch {
        // ignore storage failures
      }
      setUser(null);
      setProfile(null);
      setScreen("welcome");
    };

    try {
      await withTimeout(
        supabase.auth.signOut(),
        8000,
        "Çıkış isteği zaman aşımına uğradı (8sn)."
      );
      forceLocalLogout();
      appendRuntimeLog("info", "LOGOUT_SUCCESS", "Supabase signOut tamamlandi.");
      showToast("👋 Çıkış yapıldı");
    } catch (error) {
      appendRuntimeLog("warn", "LOGOUT_FALLBACK", error?.message || "SignOut failed");
      forceLocalLogout();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // noop
      }
      showToast("Oturum yerelde kapatıldı.", "success", 5000);
    }
  };

  const handleAuthSuccess = (authUser, authProfile) => {
    const resolvedRole =
      normalizeRoleHint(authProfile?.role) ||
      normalizeRoleHint(authUser?.user_metadata?.role) ||
      null;
    setUser(authUser);
    setProfile({
      ...(authProfile || {}),
      id: authUser?.id,
      role: resolvedRole,
    });
    writeRoleHint(resolvedRole, authUser?.id);
    setScreen("welcome");
    showToast("✅ Giriş başarılı!");
  };
  const activeRole = normalizeRoleHint(profile?.role) || (user ? readRoleHint(user.id) : null);
  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const hasVerifiedPhone = /\d{10,}/.test(String(profile?.phone || "").replace(/\D/g, ""));

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfileRoleLabel = (role) => {
    if (role === "employer") return "İşverenim";
    if (role === "driver") return "İş Arıyorum";
    return "Kullanıcı";
  };
  const formatDateTime = (value) => {
    if (!value) return "Belirsiz";
    try {
      return new Date(value).toLocaleString("tr-TR");
    } catch {
      return "Belirsiz";
    }
  };
  const formatDateOnly = (value) => {
    if (!value) return "Belirsiz";
    try {
      return new Date(value).toLocaleDateString("tr-TR");
    } catch {
      return "Belirsiz";
    }
  };
  const getBidStatusUi = (status) => {
    const key = String(status || "PENDING").toUpperCase();
    if (key === "ACCEPTED") {
      return {
        label: "Kabul Edildi",
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      };
    }
    if (key === "REJECTED") {
      return {
        label: "Reddedildi",
        className: "bg-red-500/15 text-red-300 border-red-500/30",
      };
    }
    return {
      label: "Yanıt Bekleniyor",
      className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
  };

  const openRoleFeed = useCallback(() => {
    if (!user) {
      nav("auth");
      return;
    }
    if (!activeRole) {
      showToast("Profil rolü yükleniyor, lütfen tekrar dene.", "error");
      return;
    }
    if (activeRole === "employer") {
      nav("employerFeed");
      return;
    }
    nav("driverFeed");
  }, [activeRole, nav, user]);

  // ─── FILTERS ───
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterTrailer, setFilterTrailer] = useState("");

  const filteredLocationCities = useMemo(() => {
    const normalized = normalizeCityKey(locationQuery);
    if (!normalized) return cities;
    return cities.filter((cityName) =>
      normalizeCityKey(cityName).includes(normalized)
    );
  }, [locationQuery]);

  const groupedLocationCities = useMemo(() => {
    const groups = {};
    filteredLocationCities.forEach((cityName) => {
      const letter = cityName[0].toLocaleUpperCase("tr-TR");
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(cityName);
    });
    return Object.entries(groups).sort((a, b) =>
      a[0].localeCompare(b[0], "tr-TR")
    );
  }, [filteredLocationCities]);

  const handleClearFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterTrailer("");
    setCity(null);
  };

  // Sync city selection from heatmap/landing with filterFrom
  useEffect(() => {
    if (city) setFilterFrom(city);
  }, [city]);

  const fetchPublicStats = useCallback((options = {}) => {
    const force = options?.force === true;
    const now = Date.now();

    if (!force && publicStatsFetchPromiseRef.current) {
      return publicStatsFetchPromiseRef.current;
    }
    if (!force && now - publicStatsLastFetchAtRef.current < PUBLIC_STATS_FETCH_COOLDOWN_MS) {
      return Promise.resolve(null);
    }

    const request = (async () => {
      publicStatsLastFetchAtRef.current = Date.now();
      let supabaseError = null;

      try {
        const data = await withTimeout(
          fetchPublicStatsApi(),
          8000,
          "Public stats query timeout."
        );
        persistPublicStats(data);
        return data;
      } catch (error) {
        supabaseError = error;
      }

      try {
        const restData = await fetchPublicStatsViaRestApi({ timeoutMs: 10000 });
        if (supabaseError) {
          appendRuntimeLog("info", "PUBLIC_STATS_SUPABASE_FALLBACK", supabaseError?.message || "Supabase stats failed, REST fallback used.");
        }
        appendRuntimeLog("info", "PUBLIC_STATS_REST_OK", `loads=${restData.activeLoads} drivers=${restData.activeDrivers} cities=${restData.activeCities}`);
        persistPublicStats(restData);
        return restData;
      } catch (restError) {
        if (supabaseError) {
          appendRuntimeLog("warn", "PUBLIC_STATS_SUPABASE_FAIL", supabaseError?.message || "Supabase stats failed");
        }
        console.error("Error fetching public stats:", restError);
        appendRuntimeLog("warn", "PUBLIC_STATS_REST_FAIL", restError?.message || "REST stats failed");
        pushPersistentError("PUBLIC_STATS", restError?.message || "Canlı sayaçlar güncellenemedi.");
      }

      // Local fallback: avoid 0/0 stats when visible data exists.
      applyLocalStatsFallback(latestRealLoadsRef.current);
      return null;
    })();

    publicStatsFetchPromiseRef.current = request.finally(() => {
      publicStatsFetchPromiseRef.current = null;
    });

    return publicStatsFetchPromiseRef.current;
  }, [appendRuntimeLog, applyLocalStatsFallback, persistPublicStats, pushPersistentError, withTimeout]);

  const fetchFeedback = useCallback((options = {}) => {
    const force = options?.force === true;
    const now = Date.now();

    if (!force && feedbackFetchPromiseRef.current) {
      return feedbackFetchPromiseRef.current;
    }
    if (!force && now - feedbackLastFetchAtRef.current < FEEDBACK_FETCH_COOLDOWN_MS) {
      return Promise.resolve(null);
    }

    const request = (async () => {
      feedbackLastFetchAtRef.current = Date.now();
      setIsFeedbackLoading(true);
      setFeedbackError("");
      try {
        const rows = await withTimeout(
          fetchFeedbackItemsApi({ limit: 50 }),
          12000,
          "Feedback listesi zaman aşımına uğradı (12sn)."
        );
        persistFeedbackItems(rows);
        return rows;
      } catch (error) {
        let effectiveError = error;
        let message = effectiveError?.message || "Feedback fetch failed";
        const timeoutPattern = /timeout|zaman aşım/i;

        if (timeoutPattern.test(String(message || ""))) {
          appendRuntimeLog("warn", "FEEDBACK_FETCH_RETRY", "İlk deneme timeout, ikinci deneme başlatılıyor.");
          try {
            const retryRows = await withTimeout(
              fetchFeedbackItemsApi({ limit: 50 }),
              16000,
              "Feedback listesi ikinci denemede de zaman aşımına uğradı (16sn)."
            );
            persistFeedbackItems(retryRows);
            setFeedbackError("");
            appendRuntimeLog(
              "info",
              "FEEDBACK_FETCH_OK_RETRY",
              `rows=${Array.isArray(retryRows) ? retryRows.length : 0}`
            );
            return retryRows;
          } catch (retryError) {
            effectiveError = retryError;
            message = retryError?.message || message;
            appendRuntimeLog("warn", "FEEDBACK_FETCH_RETRY_FAIL", message);
          }
        }

        appendRuntimeLog("warn", "FEEDBACK_FETCH_FAIL", message);

        if (isFeedbackTableMissingError(effectiveError)) {
          try {
            const runtimeRes = await withTimeout(
              supabase
                .from("runtime_logs")
                .select("id, details, created_at")
                .eq("event_code", "FEEDBACK_ITEM")
                .order("created_at", { ascending: false })
                .limit(50),
              8000,
              "Feedback fallback log sorgusu zaman aşımına uğradı (8sn)."
            );
            if (runtimeRes?.error) {
              throw new Error(runtimeRes.error.message || "Runtime feedback fallback failed");
            }
            const fallbackRows = (runtimeRes?.data || [])
              .map((row) => {
                const parsed = parseFeedbackRuntimeDetails(row?.details || "");
                if (!parsed) return null;
                return {
                  id: `rt-${row.id}`,
                  user_id: parsed.user_id || null,
                  author_name: parsed.author_name || "Kullanıcı",
                  content: parsed.content || "",
                  codex_comment: parsed.codex_comment || "",
                  status_tag: parsed.status_tag || "yapilacak",
                  moderation_status: parsed.moderation_status || "published",
                  created_at: row.created_at,
                  updated_at: row.created_at,
                };
              })
              .filter(Boolean);

            if (fallbackRows.length > 0) {
              persistFeedbackItems(fallbackRows);
            }
            setFeedbackError("Feedback panosu hazırlanıyor. Geçici kayıtlar gösteriliyor.");
            return fallbackRows;
          } catch (fallbackError) {
            appendRuntimeLog("warn", "FEEDBACK_FALLBACK_FAIL", fallbackError?.message || "Feedback fallback failed");
            setFeedbackError("Feedback panosu hazırlanıyor. Geçici kayıtlar gösterilecek.");
            return null;
          }
        }

        if (timeoutPattern.test(String(message || ""))) {
          // Timeout durumlarında mevcut listeyi koru; kullanıcıya kırmızı hata göstermeyelim.
          setFeedbackError("");
          return null;
        }

        setFeedbackError("Feedback listesi şu an yüklenemedi. Lütfen tekrar dene.");
        return null;
      } finally {
        setIsFeedbackLoading(false);
      }
    })();

    feedbackFetchPromiseRef.current = request.finally(() => {
      feedbackFetchPromiseRef.current = null;
    });

    return feedbackFetchPromiseRef.current;
  }, [appendRuntimeLog, persistFeedbackItems, withTimeout]);

  const fetchLoads = useCallback((options = {}) => {
    const force = options?.force === true;
    const now = Date.now();
    const key = `${String(filterFrom || "").trim().toLocaleLowerCase("tr-TR")}|${String(filterTo || "")
      .trim()
      .toLocaleLowerCase("tr-TR")}|${String(filterTrailer || "").trim().toLocaleLowerCase("tr-TR")}`;

    if (!force && loadsFetchPromiseRef.current && loadsFetchKeyRef.current === key) {
      return loadsFetchPromiseRef.current;
    }
    if (
      !force &&
      loadsFetchKeyRef.current === key &&
      now - loadsLastFetchAtRef.current < LOADS_FETCH_COOLDOWN_MS
    ) {
      return Promise.resolve(null);
    }

    const request = (async () => {
      loadsLastFetchAtRef.current = Date.now();
      loadsFetchKeyRef.current = key;
      setIsLoading(true);
      let supabaseError = null;

      try {
        const data = await withTimeout(
          fetchLoadsApi({ filterFrom, filterTo, filterTrailer }),
          10000,
          "Yük listesi sorgusu zaman aşımına uğradı (10sn)."
        );
        const mappedLoads = data.map((l) => mapDbToUi(l));
        setRealLoads(mappedLoads);
        setIsLoading(false);
        return mappedLoads;
      } catch (error) {
        supabaseError = error;
      }

      try {
        const restData = await fetchLoadsViaRestApi({
          filterFrom,
          filterTo,
          filterTrailer,
          timeoutMs: 12000,
        });
        const mappedLoads = restData.map((l) => mapDbToUi(l));
        setRealLoads(mappedLoads);
        if (supabaseError) {
          appendRuntimeLog("info", "LOADS_SUPABASE_FALLBACK", supabaseError?.message || "Supabase loads failed, REST fallback used.");
        }
        appendRuntimeLog("info", "LOADS_REST_OK", `rows=${mappedLoads.length}`);
        return mappedLoads;
      } catch (restError) {
        if (supabaseError) {
          appendRuntimeLog("warn", "LOADS_SUPABASE_FAIL", supabaseError?.message || "Supabase loads failed");
        }
        console.error("Error fetching loads:", restError);
        appendRuntimeLog("error", "LOADS_FETCH_FAIL", restError?.message || "Loads fetch failed");
        pushPersistentError("LOADS", restError?.message || "Yük listesi güncellenemedi.");
        return null;
      } finally {
        setIsLoading(false);
      }
    })();

    loadsFetchPromiseRef.current = request.finally(() => {
      loadsFetchPromiseRef.current = null;
    });

    return loadsFetchPromiseRef.current;
  }, [appendRuntimeLog, filterFrom, filterTo, filterTrailer, pushPersistentError, withTimeout]);

  // Fetch Loads from Supabase
  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    fetchPublicStats();
  }, [fetchPublicStats]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    if (!user) {
      setDriverFeedItems([]);
      setEmployerFeedItems([]);
      setFeedError("");
      return;
    }

    if (screen === "driverFeed") {
      loadDriverFeed();
    } else if (screen === "employerFeed") {
      loadEmployerFeed();
    }
  }, [loadDriverFeed, loadEmployerFeed, screen, user]);

  // Keep map/list in sync with new inserts/updates from any user session.
  useEffect(() => {
    const channel = supabase
      .channel("public:loads-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        () => {
          fetchLoads({ force: true });
          fetchPublicStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLoads, fetchPublicStats]);

  useEffect(() => {
    const channel = supabase
      .channel("public:feedback-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_items" },
        () => {
          fetchFeedback({ force: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeedback]);

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!empForm.from) errors.from = "Nereden bilgisi gerekli";
    if (!empForm.to) errors.to = "Nereye bilgisi gerekli";
    if (!empForm.type) errors.type = "Yük cinsi gerekli";
    if (!empForm.price) errors.price = "Fiyat gerekli";
    else if (isNaN(empForm.price)) errors.price = "Fiyat sayı olmalı";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePostLoad = async () => {
    if (!validateForm()) {
      appendRuntimeLog("warn", "POST_LOAD_VALIDATION_FAIL", "Eksik veya hatali form alani.");
      setPostLoadError("Eksik veya hatalı form alanı.");
      showToast("⚠️ Lütfen eksik alanları doldurun.", "error");
      return;
    }

    if (!user) {
      appendRuntimeLog("warn", "POST_LOAD_NO_SESSION", "Kullanici oturumu yok.");
      setPostLoadError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      showToast("İlan vermek için giriş yapmalısınız.", "error");
      nav("auth");
      return;
    }

    if (userSettings.requireEmailVerified && !isEmailVerified) {
      appendRuntimeLog("warn", "POST_LOAD_EMAIL_VERIFY_REQUIRED", "Email doğrulama gerekli.");
      setPostLoadError("İlan vermek için e-posta doğrulaması gereklidir.");
      showToast("İlan için e-posta doğrulaması gerekli.", "error");
      pushPersistentError("EMAIL_VERIFY", "E-posta doğrulanmadan ilan verilemez.");
      return;
    }
    if (userSettings.requirePhoneOnActions && !hasVerifiedPhone) {
      appendRuntimeLog("warn", "POST_LOAD_PHONE_VERIFY_REQUIRED", "Phone doğrulama gerekli.");
      setPostLoadError("İlan vermek için geçerli telefon bilgisi gereklidir.");
      showToast("İlan için geçerli telefon gerekli.", "error");
      pushPersistentError("PHONE_VERIFY", "Telefon doğrulanmadan ilan verilemez.");
      return;
    }

    const startTs = Date.now();
    setPostLoadError("");
    appendRuntimeLog("info", "POST_LOAD_STARTED", `${empForm.from} -> ${empForm.to} | ${empForm.type}`);
    setIsPostingLoad(true);
    try {
      let accessToken = readCachedAccessToken();
      if (accessToken) {
        const exp = decodeJwtExpiry(accessToken);
        appendRuntimeLog("info", "POST_LOAD_TOKEN_CACHE", `cached_token_exp=${exp || "unknown"}`);
      } else {
        appendRuntimeLog("warn", "POST_LOAD_TOKEN_CACHE_EMPTY", "localStorage token bulunamadı.");
      }

      // Session check should never block publishing. If it times out, continue and let DB decide.
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "Oturum kontrolü yavaş yanıt verdi."
        );
        const activeSession = sessionResult?.data?.session;
        if (!activeSession?.user?.id) {
          appendRuntimeLog("warn", "POST_LOAD_SESSION_EMPTY", "Session boş görünüyor, publish denenecek.");
        } else if (activeSession.user.id !== user.id) {
          appendRuntimeLog("warn", "POST_LOAD_SESSION_MISMATCH", `session=${activeSession.user.id} ui=${user.id}`);
        } else {
          accessToken = activeSession.access_token || accessToken;
          appendRuntimeLog("info", "POST_LOAD_SESSION_OK", `user=${activeSession.user.id}`);
        }
      } catch (sessionCheckError) {
        appendRuntimeLog("warn", "POST_LOAD_SESSION_CHECK_SKIPPED", sessionCheckError?.message || "Session check timeout");
      }

      const loadData = {
        origin_city: empForm.from,
        destination_city: empForm.to,
        load_type: empForm.type,
        trailer_type: empForm.trailer,
        price: parseFloat(empForm.price) || 0,
        kdv_included: empForm.kdv,
        weight_kg: 10000,
        is_urgent: false,
        is_fleet: empForm.fleet,
        truck_count: empForm.fleet ? Number(empForm.trucks) || 1 : 1,
        pickup_date: new Date().toISOString().split('T')[0],
        employer_id: user.id,
        status: "open",
        currency: "TRY",
      };

      const publishLoad = async (timeoutMs) => {
        if (accessToken) {
          return withTimeout(
            createLoadViaRestApi({ loadData, accessToken, timeoutMs }),
            timeoutMs + 2000,
            `REST insert zaman aşımına uğradı (${Math.ceil((timeoutMs + 2000) / 1000)}sn).`
          );
        }
        return withTimeout(
          createLoadApi(loadData),
          timeoutMs,
          `İlan oluşturma zaman aşımına uğradı (${Math.ceil(timeoutMs / 1000)}sn).`
        );
      };

      if (!accessToken) {
        throw new Error("Aktif oturum tokeni alınamadı. Çıkış yapıp tekrar giriş yapın.");
      }

      let createdLoad = null;
      try {
        createdLoad = await publishLoad(18000);
      } catch (firstError) {
        const firstMessage = (firstError?.cause?.message || firstError?.message || "").toLowerCase();
        const isTimeout = firstMessage.includes("zaman aşımına uğradı") || firstMessage.includes("timeout");
        const isAuthError =
          firstMessage.includes("jwt") ||
          firstMessage.includes("unauthorized") ||
          firstMessage.includes("permission denied") ||
          firstMessage.includes("row-level security") ||
          firstMessage.includes("not authenticated") ||
          firstMessage.includes("401") ||
          firstMessage.includes("403");
        const mightNeedProfileRepair =
          firstMessage.includes("foreign key") ||
          firstMessage.includes("profiles") ||
          firstMessage.includes("employer_id") ||
          firstMessage.includes("violates");

        if (isAuthError) {
          throw new Error("Oturum yetkisi geçersiz. Lütfen çıkış yapıp tekrar giriş yapın.");
        } else if (mightNeedProfileRepair) {
          appendRuntimeLog("warn", "POST_LOAD_PROFILE_REPAIR", firstMessage || "Profil satiri dogrulanip yeniden denenecek.");

          const ensuredProfile = await withTimeout(
            ensureProfileApi({
              userId: user.id,
              email: user.email,
              fullName: profile?.full_name || user.user_metadata?.full_name,
              phone: profile?.phone,
              role: activeRole || "employer",
            }),
            12000,
            "Profil onarımı zaman aşımına uğradı (12sn)."
          );
          setProfile(ensuredProfile);
          appendRuntimeLog("info", "POST_LOAD_PROFILE_READY", `role=${ensuredProfile?.role || "unknown"}`);

          createdLoad = await publishLoad(24000);
        } else if (isTimeout) {
          appendRuntimeLog("warn", "POST_LOAD_RETRY", "İlk deneme timeout, ikinci deneme başlatılıyor.");
          createdLoad = await publishLoad(30000);
        } else {
          throw firstError;
        }
      }

      const createdLoadId = Number(createdLoad?.id || createdLoad?.[0]?.id || Date.now());
      const optimisticDbLoad = {
        id: createdLoadId,
        employer_id: user.id,
        origin_city: loadData.origin_city,
        destination_city: loadData.destination_city,
        distance_km: null,
        load_type: loadData.load_type,
        trailer_type: loadData.trailer_type,
        weight_kg: loadData.weight_kg,
        price: loadData.price,
        currency: loadData.currency || "TRY",
        status: loadData.status || "open",
        pickup_date: loadData.pickup_date,
        created_at: new Date().toISOString(),
        is_urgent: loadData.is_urgent,
        is_fleet: loadData.is_fleet,
        truck_count: loadData.truck_count,
        kdv_included: loadData.kdv_included,
        profiles: {
          full_name: profile?.full_name || user?.email || "İşveren",
          avatar_url: profile?.avatar_url || null,
          phone: profile?.phone || null,
          role: activeRole || "employer",
        },
      };
      const optimisticUiLoad = mapDbToUi(optimisticDbLoad);
      const nextVisibleLoads = [optimisticUiLoad, ...realLoads.filter((item) => Number(item.id) !== createdLoadId)];
      setRealLoads(nextVisibleLoads);
      applyLocalStatsFallback(nextVisibleLoads, { incrementLoads: true });

      setPostLoadError("");
      showToast(empForm.fleet ? `✅ ${empForm.trucks} TIR'lık filo ilanınız yayında!` : "✅ İlanınız başarıyla yayınlandı!");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 100);
      setEmpForm({ from: "", to: "", type: "", trailer: "Kapalı", price: "", kdv: true, fleet: false, trucks: 1, date: "Pazartesi" });
      setFormErrors({});
      try {
        await withTimeout(
          Promise.all([fetchLoads({ force: true }), fetchPublicStats({ force: true })]),
          12000,
          "Liste yenileme zaman aşımına uğradı (12sn)."
        );
      } catch (refreshError) {
        appendRuntimeLog("warn", "POST_LOAD_REFRESH_WARN", refreshError?.message || "Refresh timeout");
        showToast("İlan yayınlandı. Liste arka planda güncelleniyor.", "success", 7000);
        setTimeout(() => {
          fetchLoads({ force: true });
          fetchPublicStats({ force: true });
        }, 2500);
      }
      setFilterFrom(loadData.origin_city);
      setFilterTo("");
      setFilterTrailer("");
      setCity(loadData.origin_city);
      nav("map");
      appendRuntimeLog("info", "POST_LOAD_SUCCESS", `ilan_yayin_suresi_ms=${Date.now() - startTs}`);
    } catch (error) {
      console.error("Insert error:", error);
      const backendMessage = error?.cause?.message || error?.message || "İlan eklenemedi.";
      appendRuntimeLog("error", "POST_LOAD_FAILED", backendMessage);
      setPostLoadError(backendMessage);
      showToast(`❌ Hata: ${backendMessage}`, "error");
      pushPersistentError("POST_LOAD", backendMessage);
    } finally {
      setIsPostingLoad(false);
      appendRuntimeLog("info", "POST_LOAD_FINISHED", `isPostingLoad=false | elapsed_ms=${Date.now() - startTs}`);
    }
  };

  const sendChat = () => {
    if (!chatMsg.trim()) return;
    const userMsg = chatMsg.trim();
    setChatMessages(p => [...p, { from: "user", text: userMsg }]);
    setChatMsg("");
    setTimeout(() => {
      const replies = [
        "Talebiniz alındı, en kısa sürede dönüş yapılacaktır.",
        "Bu konuda size yardımcı olabilirim. Detay verir misiniz?",
        "İlan numaranızı paylaşır mısınız? Hemen bakıyorum.",
        "Anlıyorum, sizi ilgili birime yönlendiriyorum.",
      ];
      setChatMessages(p => [...p, { from: "bot", text: replies[Math.floor(Math.random() * replies.length)] }]);
    }, 1200);
  };

  const loads = realLoads; // Filtering is handled in Supabase query now
  const employerNotificationBids = useMemo(() => {
    if (!selectedLoadDetail || !user || selectedLoadDetail.raw?.employer_id !== user.id) return [];
    const fromKey = normalizeCityKey(selectedLoadDetail.from || "");
    const toKey = normalizeCityKey(selectedLoadDetail.to || "");
    const messageBids = new Map();

    notifications.forEach((notification) => {
      const message = String(notification?.message || "");
      if (!/yeni teklif/i.test(message)) return;
      const normalizedMessage = normalizeCityKey(message);
      if (fromKey && !normalizedMessage.includes(fromKey)) return;
      if (toKey && !normalizedMessage.includes(toKey)) return;

      const bidIdMatch = message.match(/\[BID:(\d+)\]/i);
      const bidId = bidIdMatch ? Number(bidIdMatch[1]) : null;
      if (!bidId || Number.isNaN(bidId) || messageBids.has(bidId)) return;

      const priceMatch = message.match(/(\d+(?:[.,]\d+)?)\s*₺/);
      const bidPriceValue = priceMatch ? Number(String(priceMatch[1]).replace(",", ".")) : 0;

      messageBids.set(bidId, {
        id: bidId,
        driver_id: notification?.actor_id || null,
        price: bidPriceValue,
        status: "PENDING",
        created_at: notification?.created_at || new Date().toISOString(),
        driver: {
          full_name: "Şoför",
          rating: "5.0",
        },
      });
    });

    return Array.from(messageBids.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications, selectedLoadDetail, user]);
  const employerBidRows = loadBids.length > 0 ? loadBids : employerNotificationBids;
  const driverFeedBuckets = useMemo(() => {
    const classify = (item) => {
      const loadStatus = String(item?.load_status || "").toLowerCase();
      const bidStatus = String(item?.bid_status || "").toUpperCase();
      if (["completed", "cancelled"].includes(loadStatus) || bidStatus === "REJECTED") return "completed";
      if (bidStatus === "ACCEPTED" || ["assigned", "in_transit", "delivered"].includes(loadStatus)) return "planned";
      return "active";
    };

    return driverFeedItems.reduce(
      (acc, item) => {
        const bucket = classify(item);
        acc[bucket].push(item);
        acc.all.push(item);
        return acc;
      },
      { all: [], active: [], planned: [], completed: [] }
    );
  }, [driverFeedItems]);
  const visibleDriverFeedItems = driverFeedBuckets[driverFeedTab] || driverFeedBuckets.all;
  const employerBidBoard = useMemo(() => {
    const flattened = employerFeedItems.flatMap((item) =>
      (item?.bids || []).map((bid) => ({
        ...bid,
        load_id: item.load_id,
        origin_city: item.origin_city,
        destination_city: item.destination_city,
      }))
    );
    return {
      pending: flattened.filter((x) => x.bid_status === "PENDING"),
      accepted: flattened.filter((x) => x.bid_status === "ACCEPTED"),
      rejected: flattened.filter((x) => x.bid_status === "REJECTED"),
    };
  }, [employerFeedItems]);

  const e2eChecklist = useMemo(() => {
    const recentErrors = runtimeLogs.slice(0, 40).filter((log) => log.level === "error");
    const driverHasDecisionNotification = notifications.some((n) =>
      /kabul edildi|reddedildi/i.test(String(n?.message || ""))
    );
    const driverHasAcceptedLoad = driverFeedItems.some((item) => item.bid_status === "ACCEPTED");
    const employerHasIncomingBids = employerFeedItems.some((item) => item.bid_count > 0);
    const employerHasDecision = employerFeedItems.some((item) => item.accepted_count > 0 || item.rejected_count > 0);
    const employerHasPlannedPickup = employerFeedItems.some((item) => Boolean(item.pickup_date));

    const steps = [
      { id: "S1", title: "Kullanıcı oturumu açık mı?", passed: Boolean(user?.id) },
      { id: "S2", title: "Profil rolü çözüldü mü? (driver/employer)", passed: Boolean(activeRole) },
      { id: "S3", title: "Açık yük listesi yükleniyor mu?", passed: !isLoading },
      { id: "S4", title: "Şoför teklif oluşturabiliyor mu?", passed: driverFeedItems.length > 0 },
      { id: "S5", title: "İşveren kendi ilanına gelen teklifleri görüyor mu?", passed: employerHasIncomingBids },
      { id: "S6", title: "İşveren teklif kabul/red aksiyonu üretiyor mu?", passed: employerHasDecision || driverHasDecisionNotification },
      { id: "S7", title: "Şoför kabul/red bilgisini feed veya bildirimde görüyor mu?", passed: driverHasDecisionNotification || driverHasAcceptedLoad },
      { id: "S8", title: "Kabul edilen işte yükleme tarihi görünüyor mu?", passed: driverFeedItems.some((x) => x.bid_status === "ACCEPTED" && x.pickup_date) || employerHasPlannedPickup },
      { id: "S9", title: "Her role özel feed ekranı veri çekiyor mu?", passed: driverFeedItems.length > 0 || employerFeedItems.length > 0 },
      { id: "S10", title: "Kritik runtime hatası var mı?", passed: recentErrors.length === 0 },
    ];

    return steps.map((step, index) => {
      const unlocked = steps.slice(0, index).every((prev) => prev.passed);
      return {
        ...step,
        state: unlocked ? (step.passed ? "pass" : "check") : "locked",
      };
    });
  }, [activeRole, driverFeedItems, employerFeedItems, isLoading, notifications, runtimeLogs, user?.id]);

  // animated stats
  const statLoads = useAnimatedCount(publicStats.activeLoads);
  const statDrivers = useAnimatedCount(publicStats.activeDrivers);
  const statCities = useAnimatedCount(publicStats.activeCities);
  const feedbackPreviewItems = useMemo(
    () =>
      feedbackItems
        .slice(0, 20)
        .map((item) =>
          resolveFeedbackDisplayState({
            item,
            releaseUpdates,
          })
        ),
    [feedbackItems, releaseUpdates]
  );
  const showDriverHomeAction = !user || (Boolean(user) && !activeRole);
  const showEmployerHomeAction = !user || (Boolean(user) && !activeRole);

  return (
    <div className="app-shell min-h-screen flex items-center justify-center p-3 sm:p-5">
      {/* SPLASH SCREEN */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* CONFETTI */}
      <Suspense fallback={null}>
        <Confetti active={showConfetti} />
      </Suspense>

      {/* TOAST */}
      {toast && (
        <div className={`yc-toast fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl animate-bounce flex items-center gap-3 ${toastType === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toastType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {toast}
        </div>
      )}

      {persistentError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] w-[min(92vw,560px)] rounded-2xl border border-red-500/40 bg-red-950/90 backdrop-blur-sm shadow-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-red-200 text-sm font-black">Kritik Hata · {persistentError.source}</p>
              <p className="text-red-100 text-xs mt-1 leading-relaxed">{persistentError.message}</p>
              <p className="text-red-300/80 text-[10px] mt-2">{new Date(persistentError.at).toLocaleString("tr-TR")}</p>
            </div>
            <button
              type="button"
              onClick={() => setPersistentError(null)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-100 text-xs font-bold"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* PHONE FRAME - Mobile First Optimized */}
      <div className="device-frame relative w-full rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl" style={{ maxWidth: "430px", height: "85vh", maxHeight: "820px" }}>

        {/* ═══════════════════ HEADER BAR ═══════════════════ */}
        {screen !== "welcome" && screen !== "auth" && (
          <div className="topbar-grad flex items-center justify-between px-5 py-4 backdrop-blur-sm border-b border-slate-700/50 z-20 sticky top-0">
            <button
              onClick={() => nav(resolveBackScreen())}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all text-slate-300 hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => nav("welcome")}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-all text-left"
            >
              <span className="text-blue-500 transform -scale-x-100"><Truck size={22} className="fill-current" /></span>
              <span className="text-white font-extrabold text-lg tracking-tight">YükCep</span>
            </button>
            <div className="w-10" />
          </div>
        )}

        {/* ═══════════════════ SCREENS ═══════════════════ */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div key={screenKey} className="page-enter">

          {/* ─── WELCOME ─── */}
          {screen === "welcome" && (
            <div className="flex flex-col min-h-full">
              {/* ─── COMPACT TOP NAV BAR ─── */}
              <div className="topbar-grad relative z-40 flex items-center justify-between px-5 py-4 backdrop-blur-sm border-b border-slate-700/50">
                <button
                  type="button"
                  onClick={() => nav("welcome")}
                  className="flex items-center gap-2.5 px-1.5 py-1 rounded-xl hover:bg-white/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                    <span className="text-2xl">🚚</span>
                  </div>
                  <span className="text-white font-black text-xl tracking-tight">YükCep</span>
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-green-500" /></span>
                    <span className="text-green-400 text-xs font-bold">Canlı</span>
                  </div>
                  {/* Notifications */}
                  {user && (
                    <div className="relative">
                      <button
                        onClick={handleToggleNotification}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-slate-700/50 transition-colors relative active:scale-95"
                      >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                        )}
                      </button>

                      {showNotifications && (
                        <div className="absolute right-0 top-12 w-80 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl z-[90] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
                            <span className="text-white font-bold text-sm">Bildirimler</span>
                            {unreadCount > 0 && <span className="text-xs text-blue-400 font-bold">{unreadCount} yeni</span>}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="p-6 text-center text-slate-500 text-xs">Henüz bildirim yok.</div>
                            ) : (
                              notifications.map((n) => (
                                <div
                                  key={n.id}
                                  onClick={() => markNotificationRead(n.id)}
                                  className={`p-3 border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-500/10' : ''}`}
                                >
                                  <p className={`text-sm ${!n.is_read ? 'text-white font-bold' : 'text-slate-300'}`}>{n.message}</p>
                                  <p className="text-[10px] text-slate-500 mt-1">{new Date(n.created_at).toLocaleDateString('tr-TR')}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auth Button */}
                  {user ? (
                    <div className="relative">
                      <button
                        onClick={() => setShowProfileCard(!showProfileCard)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm active:scale-95 transition-all border-2 border-blue-500/50"
                        style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}
                      >
                        {getInitials(profile?.full_name)}
                      </button>
                      {/* Profile Card Dropdown */}
                      {showProfileCard && (
                        <div className="absolute right-0 top-12 w-72 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl z-[90] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-white/10">
                          <div className="p-5 bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border-b border-slate-700/50 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 opacity-50 blur-3xl -z-10" />
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div
                                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg ring-2 ring-white/10"
                                  style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}
                                >
                                  {getInitials(profile?.full_name)}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5">
                                  <TrustScoreRing score={92} />
                                </div>
                              </div>
                              <div>
                                <p className="text-white font-bold text-base tracking-tight">{profile?.full_name || getProfileRoleLabel(activeRole)}</p>
                                <p className="text-slate-400 text-xs font-medium mb-1">{user.email}</p>
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    activeRole === "driver"
                                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                      : activeRole === "employer"
                                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                        : "bg-slate-700/50 text-slate-300 border-slate-600/50"
                                  }`}
                                >
                                  {activeRole === "driver" ? "🚛 İş Arıyorum" : activeRole === "employer" ? "🏢 İşverenim" : "⏳ Rol Yükleniyor"}
                                </span>
                                <p className={`mt-1 text-[10px] font-bold ${isEmailVerified ? "text-emerald-300" : "text-amber-300"}`}>
                                  {isEmailVerified ? "✔ E-posta doğrulandı" : "⚠ E-posta doğrulaması bekleniyor"}
                                </p>
                              </div>
                            </div>
                          </div>
                          {profile?.phone && (
                            <div className="px-5 py-3 border-b border-slate-700/30 flex items-center justify-between">
                              <span className="text-slate-400 text-xs font-bold uppercase">Telefon</span>
                              <span className="text-white text-sm font-mono">{profile.phone}</span>
                            </div>
                          )}
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => {
                                setShowProfileCard(false);
                                openRoleFeed();
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 font-bold text-sm hover:bg-white/5 transition-all active:scale-95 group"
                            >
                              <span className="bg-slate-800 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">
                                {activeRole === "employer" ? "📋" : activeRole === "driver" ? "🧭" : "⏳"}
                              </span>
                              {activeRole === "employer" ? "İşveren Feed" : activeRole === "driver" ? "Benim Yapacak İşlerim" : "Feed Hazırlanıyor"}
                            </button>
                            <button
                              onClick={() => {
                                setShowProfileCard(false);
                                setShowSettingsPanel(true);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 font-bold text-sm hover:bg-white/5 transition-all active:scale-95 group"
                            >
                              <span className="bg-slate-800 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">⚙️</span>
                              Ayarlar
                            </button>
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 font-bold text-sm hover:bg-red-500/10 transition-colors active:scale-95 group"
                            >
                              <span className="bg-red-500/10 p-1.5 rounded-lg group-hover:bg-red-500/20 transition-colors"><LogOut size={14} /></span>
                              Çıkış Yap
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => nav("auth")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/25 transition-all active:scale-95"
                    >
                      <User size={14} />
                      Giriş Yap
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col p-5 flex-1 pb-20">
                {/* ─── LIVE TICKER ─── */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600/15 to-emerald-600/15 border border-blue-500/20 mb-5">
                  <span className="text-xl">🔥</span>
                  <p className="text-white text-sm font-bold flex-1">
                    Şu an <span className="text-emerald-400 text-lg font-black">{fmt(statLoads)}</span> aktif yük bekliyor
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold shrink-0">
                    <span>🚛 {fmt(statDrivers)}</span>
                    <span>📍 {statCities}</span>
                  </div>
                </div>

                {/* ─── ACTION BUTTONS (Above the Fold) ─── */}
                <div className="space-y-3 mb-6">
                  {showDriverHomeAction && (
                    <button
                      onClick={() => {
                        if (user && !activeRole) {
                          handleSwitchRole("driver");
                          return;
                        }
                        nav("location");
                      }}
                      className="group w-full py-6 px-5 rounded-3xl text-white text-xl font-black active:scale-[0.98] transition-all relative overflow-hidden shadow-lg hover:shadow-blue-500/20 hover-scale"
                      style={{ background: "linear-gradient(180deg,#60a5fa 0%,#2563eb 100%)", boxShadow: "0 10px 20px -5px rgba(37,99,235,0.4)" }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
                      <span className="relative flex items-center justify-center gap-3">
                        <span className="bg-white/20 p-2.5 rounded-xl group-hover:scale-110 transition-transform">🚛</span>
                        İŞ ARIYORUM
                      </span>
                      <p className="relative text-white/60 text-xs font-medium mt-1">Yük ara, teklif ver</p>
                    </button>
                  )}
                  {showEmployerHomeAction && (
                    <button
                      onClick={() => {
                        if (user && !activeRole) {
                          handleSwitchRole("employer");
                          return;
                        }
                        nav("employer");
                      }}
                      className="group w-full py-5 px-5 rounded-3xl text-white text-lg font-black active:scale-[0.98] transition-all relative overflow-hidden shadow-lg hover:shadow-orange-500/20 hover-scale"
                      style={{ background: "linear-gradient(180deg,#fb923c 0%,#ea580c 100%)", boxShadow: "0 8px 16px -5px rgba(234,88,12,0.3)" }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
                      <span className="relative flex items-center justify-center gap-3">
                        <span className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">🏢</span>
                        İŞVERENİM
                      </span>
                      <p className="relative text-white/50 text-xs font-medium mt-1">Yük ilanı ver, şoför bul</p>
                    </button>
                  )}
                  {user && (
                    activeRole === "driver" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={openRoleFeed}
                          className="py-3 px-3 rounded-2xl border text-sm font-black transition-all border-cyan-500/30 bg-cyan-500/10 text-cyan-200 active:scale-[0.98]"
                        >
                          🧭 Benim Yapacak İşlerim
                        </button>
                        <button
                          onClick={() => nav("location")}
                          className="py-3 px-3 rounded-2xl border text-sm font-black transition-all border-blue-500/30 bg-blue-500/10 text-blue-200 active:scale-[0.98]"
                        >
                          🔎 Yeni İş Ara
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={openRoleFeed}
                        disabled={!activeRole}
                        className={`w-full py-3 px-4 rounded-2xl border text-sm font-black transition-all ${
                          activeRole
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 active:scale-[0.98]"
                            : "border-slate-600/40 bg-slate-800/60 text-slate-400 cursor-wait"
                        }`}
                      >
                        {activeRole === "employer" ? "📋 İşveren Feed'e Git" : "⏳ Profil Rolü Yükleniyor"}
                      </button>
                    )
                  )}
                </div>

                {/* ─── SPACER ─── */}
                <div className="flex-1" />

                {/* ─── FEEDBACK BOARD ─── */}
                <div className="mb-3 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-200 text-sm font-black">💬 Feedback Panosu</p>
                    <span className="text-[10px] text-slate-500 font-bold">HERKESE AÇIK</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
                    1. kolon kullanıcı önerisi, 2. kolon Codex yeniden değerlendirme yorumu, 3. kolon yeniden etiketlenmiş durumdur.
                  </p>

                  <div className="space-y-2 mb-3">
                    <textarea
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSubmitFeedback();
                        }
                      }}
                      disabled={!user || isPostingFeedback}
                      placeholder={user ? "Önerini veya bulduğun hatayı yaz... (Ctrl+Enter gönder)" : "Feedback bırakmak için giriş yapmalısın."}
                      className="w-full min-h-[74px] py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                      maxLength={280}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {feedbackInput.length}/280
                      </p>
                      <button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={!user || isPostingFeedback}
                        className={`px-3 py-2 rounded-lg text-xs font-black border ${
                          !user || isPostingFeedback
                            ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                            : "bg-cyan-500/15 text-cyan-200 border-cyan-500/40 hover:bg-cyan-500/25"
                        }`}
                      >
                        {isPostingFeedback ? "GÖNDERİLİYOR..." : "FEEDBACK BIRAK"}
                      </button>
                    </div>
                    {feedbackError && (
                      <p className="text-[11px] text-red-300 font-bold">{feedbackError}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                    <p className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-wide">Kullanıcı Feedback</p>
                    <p className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-wide">Codex Yorumu</p>
                    <p className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-wide text-center">Durum</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto pr-1 space-y-2">
                    {isFeedbackLoading && feedbackPreviewItems.length === 0 ? (
                      <p className="text-slate-500 text-xs">Feedback listesi yükleniyor...</p>
                    ) : feedbackPreviewItems.length === 0 ? (
                      <p className="text-slate-500 text-xs">Henüz feedback yok.</p>
                    ) : (
                      feedbackPreviewItems.map((item) => {
                        const statusUi = getFeedbackStatusUi(item.status_tag);
                        return (
                          <div
                            key={`feedback-${item.id}`}
                            className={`grid grid-cols-12 gap-2 p-2 rounded-lg border ${
                              item.moderation_status === "filtered"
                                ? "bg-slate-900/30 border-red-500/20"
                                : "bg-slate-900/40 border-slate-700/30"
                            }`}
                          >
                            <div className="col-span-5">
                              <p className="text-slate-100 text-[11px] font-semibold leading-snug">{item.content}</p>
                              <p className="text-slate-500 text-[10px] mt-1">
                                {item.author_name} · {new Date(item.created_at).toLocaleString("tr-TR")}
                              </p>
                            </div>
                            <div className="col-span-5">
                              <p className="text-cyan-100 text-[11px] font-semibold leading-snug">{item.codex_comment}</p>
                              {item.moderation_status === "filtered" && (
                                <p className="text-red-300 text-[10px] mt-1 font-bold">Filtrelendi</p>
                              )}
                            </div>
                            <div className="col-span-2 flex items-center justify-center">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black text-center ${statusUi.className}`}>
                                {statusUi.label}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ─── RELEASE LOG ─── */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-200 text-sm font-black">🧾 Son 10 Güncelleme</p>
                    <span className="text-[10px] text-slate-500 font-bold">LIVE LOG</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
                    {releaseUpdates.map((item, idx) => (
                      <div key={`${item.date}-${idx}`} className="p-2 rounded-lg bg-slate-900/40 border border-slate-700/30">
                        <p className="text-slate-100 text-xs font-bold leading-snug">{item.title}</p>
                        <p className="text-slate-500 text-[10px] mt-1">{item.date}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── RUNTIME ERROR LOG ─── */}
                <div className="mt-3 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-200 text-sm font-black">🐞 Hata/Çalışma Logları</p>
                    <button
                      type="button"
                      onClick={() => setShowRuntimeLogs((prev) => !prev)}
                      className="text-[10px] px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-bold"
                    >
                      {showRuntimeLogs ? "Gizle" : "Goster"}
                    </button>
                  </div>
                  {showRuntimeLogs && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={copyRuntimeLogs}
                          className="text-[10px] px-2 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold"
                        >
                          Kopyala
                        </button>
                        <button
                          type="button"
                          onClick={clearRuntimeLogs}
                          className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-bold"
                        >
                          Temizle
                        </button>
                      </div>
                      <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
                        {runtimeLogs.length === 0 ? (
                          <p className="text-slate-500 text-xs">Henuz log yok.</p>
                        ) : (
                          runtimeLogs.slice(0, 10).map((log) => (
                            <div key={log.id} className="p-2 rounded-lg bg-slate-900/40 border border-slate-700/30">
                              <p className={`text-[10px] font-black ${log.level === "error" ? "text-red-300" : log.level === "warn" ? "text-amber-300" : "text-emerald-300"}`}>
                                {log.level.toUpperCase()} · {log.event}
                              </p>
                              <p className="text-slate-300 text-[11px] mt-1 leading-snug">{log.details}</p>
                              <p className="text-slate-500 text-[10px] mt-1">{new Date(log.at).toLocaleString("tr-TR")}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── CITY SELECTION ─── */}
          {screen === "location" && (
            <div className="p-5 pb-20">
              <h2 className="text-white text-3xl font-black mb-2 tracking-tight">📍 Neredesiniz?</h2>
              <p className="text-slate-400 text-base mb-4">81 il arasından yazarak filtreleyip şehir seçin.</p>

              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Sehir ara... (Ornek: Istanbul, Erzurum)"
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="max-h-[440px] overflow-y-auto pr-1 space-y-4">
                {groupedLocationCities.length === 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-slate-400 text-sm font-semibold">
                    Sonuc bulunamadi.
                  </div>
                )}
                {groupedLocationCities.map(([letter, groupCities]) => (
                  <div key={letter}>
                    <p className="text-xs font-black text-slate-500 mb-2 tracking-[0.15em]">{letter}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {groupCities.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleLocationSelect(c)}
                          className="py-3 px-3 rounded-xl bg-slate-800 border border-slate-700/50 text-white font-bold text-sm hover:bg-blue-600 hover:border-blue-500 transition-all active:scale-95 shadow-lg"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {screen === "driverFeed" && (
            <div className="p-5 pb-20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-white text-3xl font-black tracking-tight">🧭 Benim Yapacak İşlerim</h2>
                  <p className="text-slate-400 text-sm mt-1">Aktif teklifler, planlanan yükler ve tamamlanan işler.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nav("location")}
                    className="px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-200 text-xs font-bold"
                  >
                    Yük Ara
                  </button>
                  <button
                    type="button"
                    onClick={loadDriverFeed}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold"
                  >
                    Yenile
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { key: "all", label: "Tümü", count: driverFeedBuckets.all.length },
                  { key: "active", label: "Aktif", count: driverFeedBuckets.active.length },
                  { key: "planned", label: "Planlı", count: driverFeedBuckets.planned.length },
                  { key: "completed", label: "Biten", count: driverFeedBuckets.completed.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDriverFeedTab(tab.key)}
                    className={`py-2 rounded-xl border text-[11px] font-black ${
                      driverFeedTab === tab.key
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {feedError && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-red-300 text-xs font-bold">{feedError}</p>
                </div>
              )}

              <div className="space-y-3">
                {isFeedLoading ? (
                  <>
                    <SkeletonLoadCard />
                    <SkeletonLoadCard />
                  </>
                ) : visibleDriverFeedItems.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-white font-bold">Bu sekmede kayıt yok</p>
                    <p className="text-slate-400 text-sm mt-1">Yeni iş ara veya farklı sekmeyi kontrol et.</p>
                  </div>
                ) : (
                  visibleDriverFeedItems.map((item) => {
                    const bidUi = getBidStatusUi(item.bid_status);
                    return (
                      <div key={`driver-feed-${item.bid_id}`} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-white font-black text-lg">{item.origin_city} → {item.destination_city}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{item.load_type} · {item.trailer_type}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${bidUi.className}`}>
                            {bidUi.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40">
                            <p className="text-slate-500">Teklifim</p>
                            <p className="text-emerald-300 font-black">{fmt(Number(item.bid_price || 0))} ₺</p>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40">
                            <p className="text-slate-500">Yükleme Tarihi</p>
                            <p className="text-cyan-300 font-black">{formatDateOnly(item.pickup_date)}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-[11px] text-slate-300 mb-3">
                          <p>1. Teklif gönderildi: <span className="text-slate-100 font-semibold">{formatDateTime(item.bid_created_at)}</span></p>
                          <p>2. İşveren kararı: <span className="text-slate-100 font-semibold">{formatDateTime(item.bid_updated_at)}</span></p>
                          <p>3. İşi alım tarihi: <span className="text-slate-100 font-semibold">{formatDateOnly(item.pickup_date)}</span></p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-400">İşveren: <span className="text-slate-200 font-semibold">{item.employer_name}</span></p>
                          <button
                            type="button"
                            onClick={() => handleLoadClick(item.load_id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                          >
                            İlanı Aç
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                <p className="text-slate-200 text-sm font-black mb-2">✅ E2E Kontrol Listesi (10 Senaryo)</p>
                <div className="space-y-2">
                  {e2eChecklist.map((item) => (
                    <div key={item.id} className="p-2 rounded-lg bg-slate-900/50 border border-slate-700/40">
                      <p className="text-[11px] font-bold text-slate-200">{item.id} · {item.title}</p>
                      <p className={`text-[10px] mt-1 font-bold ${
                        item.state === "pass"
                          ? "text-emerald-300"
                          : item.state === "check"
                            ? "text-amber-300"
                            : "text-slate-500"
                      }`}>
                        {item.state === "pass" ? "GEÇTİ" : item.state === "check" ? "KONTROL BEKLİYOR" : "ÖNCEKİ ADIMLAR BEKLENİYOR"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {screen === "employerFeed" && (
            <div className="p-5 pb-20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-white text-3xl font-black tracking-tight">📋 İşveren Feed</h2>
                  <p className="text-slate-400 text-sm mt-1">İlanlarım, teklifler ve kabul/red karar takibi.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nav("employer")}
                    className="px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-200 text-xs font-bold"
                  >
                    Yeni İlan Ver
                  </button>
                  <button
                    type="button"
                    onClick={loadEmployerFeed}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold"
                  >
                    Yenile
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-[10px] text-amber-200 font-bold uppercase">Bekleyen Teklif</p>
                  <p className="text-lg text-amber-300 font-black mt-1">{employerBidBoard.pending.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-[10px] text-emerald-200 font-bold uppercase">Kabul</p>
                  <p className="text-lg text-emerald-300 font-black mt-1">{employerBidBoard.accepted.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-[10px] text-red-200 font-bold uppercase">Red</p>
                  <p className="text-lg text-red-300 font-black mt-1">{employerBidBoard.rejected.length}</p>
                </div>
              </div>

              {employerBidBoard.pending.length > 0 && (
                <div className="mb-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-slate-200 text-xs font-black mb-2">Kanban Hızlı Bakış · Bekleyen</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {employerBidBoard.pending.slice(0, 6).map((bid) => (
                      <button
                        key={`pending-bid-${bid.bid_id}`}
                        type="button"
                        onClick={() => handleLoadClick(bid.load_id)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-left"
                      >
                        <p className="text-slate-100 text-xs font-bold truncate">
                          {bid.origin_city} → {bid.destination_city}
                        </p>
                        <p className="text-amber-300 text-[11px] font-semibold">
                          {bid.driver_name} · {fmt(Number(bid.bid_price || 0))} ₺
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {feedError && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-red-300 text-xs font-bold">{feedError}</p>
                </div>
              )}

              <div className="space-y-3">
                {isFeedLoading ? (
                  <>
                    <SkeletonLoadCard />
                    <SkeletonLoadCard />
                  </>
                ) : employerFeedItems.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-white font-bold">Henüz yayınlanmış ilan yok</p>
                    <p className="text-slate-400 text-sm mt-1">Yeni ilan verdiğinde teklif akışını burada izleyeceksin.</p>
                  </div>
                ) : (
                  employerFeedItems.map((item) => (
                    <div key={`employer-feed-${item.load_id}`} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-white font-black text-lg">{item.origin_city} → {item.destination_city}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{item.load_type} · {item.trailer_type}</p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold border bg-cyan-500/10 border-cyan-500/30 text-cyan-200">
                          {item.load_status?.toUpperCase() || "OPEN"}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-3 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-center">
                          <p className="text-slate-500">Toplam</p>
                          <p className="text-slate-100 font-black">{item.bid_count}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-center">
                          <p className="text-slate-500">Bekleyen</p>
                          <p className="text-amber-300 font-black">{item.pending_count}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-center">
                          <p className="text-slate-500">Kabul</p>
                          <p className="text-emerald-300 font-black">{item.accepted_count}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-center">
                          <p className="text-slate-500">Red</p>
                          <p className="text-red-300 font-black">{item.rejected_count}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-slate-300 mb-3">
                        <p>1. İlan yayınlandı: <span className="text-slate-100 font-semibold">{formatDateTime(item.load_created_at)}</span></p>
                        <p>2. Yükleme tarihi: <span className="text-slate-100 font-semibold">{formatDateOnly(item.pickup_date)}</span></p>
                        <p>3. Son durum: <span className="text-slate-100 font-semibold">{item.load_status || "open"}</span></p>
                      </div>

                      {item.bids.length > 0 && (
                        <div className="mb-3 p-2 rounded-xl bg-slate-900/40 border border-slate-700/40">
                          <p className="text-slate-300 text-[11px] font-bold mb-2">Son teklifler</p>
                          <div className="space-y-1">
                            {item.bids.slice(0, 3).map((bid) => (
                              <div key={bid.bid_id} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300">{bid.driver_name}</span>
                                <span className="text-emerald-300 font-bold">{fmt(Number(bid.bid_price || 0))} ₺</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleLoadClick(item.load_id)}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                      >
                        İlan Detayını Aç
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30">
                <p className="text-slate-200 text-sm font-black mb-2">✅ E2E Kontrol Listesi (10 Senaryo)</p>
                <div className="space-y-2">
                  {e2eChecklist.map((item) => (
                    <div key={item.id} className="p-2 rounded-lg bg-slate-900/50 border border-slate-700/40">
                      <p className="text-[11px] font-bold text-slate-200">{item.id} · {item.title}</p>
                      <p className={`text-[10px] mt-1 font-bold ${
                        item.state === "pass"
                          ? "text-emerald-300"
                          : item.state === "check"
                            ? "text-amber-300"
                            : "text-slate-500"
                      }`}>
                        {item.state === "pass" ? "GEÇTİ" : item.state === "check" ? "KONTROL BEKLİYOR" : "ÖNCEKİ ADIMLAR BEKLENİYOR"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── MAP + LOADS ─── */}
          {screen === "map" && (
            <div className="flex flex-col pb-20">
              {/* Quick Action Bar - Modern Pills */}
              <div className="p-4 grid grid-cols-3 gap-3">
                <button onClick={() => nav("fleet")} className="flex flex-col items-center justify-center py-3 rounded-2xl text-center active:scale-95 transition-all bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 hover-scale">
                  <span className="text-2xl mb-1">🚚</span>
                  <span className="text-white font-extrabold text-[10px] uppercase tracking-wide">Filo İşleri</span>
                </button>
                <button onClick={() => nav("calendar")} className="flex flex-col items-center justify-center py-3 rounded-2xl text-center bg-slate-800 border border-slate-700 active:scale-95 transition-all group hover-scale">
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📅</span>
                  <span className="text-slate-300 font-extrabold text-[10px] uppercase tracking-wide">Takvim</span>
                </button>
                <button onClick={() => { setSelectedLoad(null); setDetailTab("detail"); fetchLoads({ force: true }); }} className="flex flex-col items-center justify-center py-3 rounded-2xl text-center bg-slate-800 border border-slate-700 active:scale-95 transition-all group hover-scale">
                  <span className="text-2xl mb-1 group-hover:rotate-180 transition-transform duration-500">🔄</span>
                  <span className="text-slate-300 font-extrabold text-[10px] uppercase tracking-wide">Yenile</span>
                </button>
              </div>

              {/* ─── FILTER BAR ─── */}
              <div className="px-4 pb-4">
                <div className="glass-card rounded-2xl p-3 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><span className="text-blue-400 text-sm">🔎</span> Akıllı Filtre</span>
                    {(filterFrom || filterTo || filterTrailer) && (
                      <button onClick={handleClearFilters} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 transition-all">
                        Temizle
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="relative">
                      <select 
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="">Nereden</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <MapPin size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select 
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="">Nereye</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <MapPin size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  
                  {/* Trailer Pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button 
                      onClick={() => setFilterTrailer("")}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${!filterTrailer ? "bg-slate-700 text-white border-slate-600" : "bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800"}`}
                    >
                      Tümü
                    </button>
                    {dorseTypes.map(d => (
                      <button 
                        key={d.k}
                        onClick={() => setFilterTrailer(filterTrailer === d.k ? "" : d.k)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${filterTrailer === d.k ? "text-white border-transparent shadow-lg shadow-blue-500/20" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}
                        style={filterTrailer === d.k ? { background: d.color } : {}}
                      >
                        <span>{d.icon}</span>
                        {d.k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* City Title */}
              <div className="px-5 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-black text-2xl tracking-tight">{(filterFrom || filterTo) ? "Filtreli" : "Tüm"} Yükler</h3>
                  <p className="text-slate-400 text-sm font-medium">{loads.length} aktif ilan</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-green-500" /></span>
                  <span className="text-green-400 text-xs font-bold uppercase tracking-wider">Canlı</span>
                </div>
              </div>

              {/* Turkey Heatmap - Interactive */}
              <Suspense fallback={<div className="mx-4 h-[250px] rounded-2xl bg-slate-900/40 border border-slate-700/40 animate-pulse" />}>
                <TurkeyHeatmap
                  loads={loads}
                  onCityClick={(cityName) => { setCity(cityName); }}
                  selectedLoad={selectedLoad}
                  onLoadSelect={(l) => { setSelectedLoad(l); setDetailTab("detail"); }}
                />
              </Suspense>

              {/* Load List - Modern Card Design */}
              <div className="px-4 space-y-3 pb-6">
                {isLoading ? (
                  <>
                    <SkeletonLoadCard />
                    <SkeletonLoadCard />
                    <SkeletonLoadCard />
                  </>
                ) : loads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl mb-4">🔍</div>
                    <p className="text-white font-bold text-lg mb-1">Yük Bulunamadı</p>
                    <p className="text-slate-400 text-sm mb-5">Bu kriterlere uygun aktif ilan yok.</p>
                    <button 
                      onClick={handleClearFilters}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                    >
                      Filtreleri Temizle
                    </button>
                  </div>
                ) : loads.map(l => (
                  <button key={l.id} onClick={() => handleLoadClick(l.id)} className={`group w-full p-4 rounded-3xl border text-left transition-all active:scale-[0.98] relative overflow-hidden hover-scale ${selectedLoad?.id === l.id ? "bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/10" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"} ${l.fleet ? "ring-1 ring-amber-500/30" : ""}`}>

                    {/* Background decoration */}
                    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-10 transition-colors ${l.urgent ? 'bg-red-500' : 'bg-blue-500'}`} />

                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-emerald-400 font-black text-2xl tracking-tight">{fmt(l.price)} ₺</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-400 text-xs font-medium">{l.daysOld === 0 ? '🕒 Bugün eklendi' : `🕒 ${l.daysOld} gün önce`}</span>
                            {l.urgent && <span className="animate-pulse text-red-400 text-xs font-bold">⚡ ACİL</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <KdvBadge included={l.kdv} />
                          <TrailerBadge type={l.trailer} />
                        </div>
                      </div>

                      {/* Route Visualization */}
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/50 border border-slate-700/30 mb-3">
                        <div className="flex-1">
                          <p className="text-slate-400 text-[10px] font-bold uppercase mb-0.5">NEREDEN</p>
                          <p className="text-white font-bold">{l.from}</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-slate-600 text-[10px] font-mono mb-0.5">{l.distance}</span>
                          <div className="w-12 h-0.5 bg-slate-600/50 relative">
                            <div className="absolute -right-0.5 -top-1 w-2 h-2 border-t-2 border-r-2 border-slate-600/50 rotate-45" />
                          </div>
                        </div>
                        <div className="flex-1 text-right">
                          <p className="text-slate-400 text-[10px] font-bold uppercase mb-0.5">NEREYE</p>
                          <p className="text-white font-bold">{l.to}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 gap-2">
                        <span className="flex items-center gap-1.5"><Package size={14} /> {l.type}</span>
                        <span className="flex items-center gap-1.5">⚖️ {l.weight}</span>
                        <span className="text-cyan-300 text-[11px] font-bold">{estimateEtaLabel(l.distance)}</span>
                        <span className="text-blue-400">{l.employer}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* DETAIL PANEL - Bottom Sheet Style */}
              {selectedLoad && (
                <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2.5rem] bg-slate-900 border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-300 transform" style={{ maxHeight: "85vh", maxWidth: "430px", margin: "0 auto", width: "100%" }}>
                  <div className="w-12 h-1.5 bg-slate-700/50 rounded-full mx-auto mt-3 mb-1" />

                  {/* Tabs */}
                  <div className="flex border-b border-slate-800 px-4">
                    {[{ k: "detail", l: "📋 Detay" }, { k: "reviews", l: "💬 Yorumlar" }, { k: "delivery", l: "🏭 Teslim Yeri" }].map(t => (
                      <button key={t.k} onClick={() => setDetailTab(t.k)} className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${detailTab === t.k ? "text-blue-400 border-blue-500" : "text-slate-500 border-transparent hover:text-slate-300"}`}>{t.l}</button>
                    ))}
                    <button onClick={() => setSelectedLoad(null)} className="ml-2 pl-4 text-slate-500 hover:text-white"><span className="text-xl">✕</span></button>
                  </div>

                  <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(80vh - 60px)" }}>
                    {detailTab === "detail" && (
                      <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">TOPLAM TUTAR</p>
                          <p className="text-4xl font-black text-emerald-400 tracking-tight">{fmt(selectedLoad.price)} ₺</p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <KdvBadge included={selectedLoad.kdv} big />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                            <p className="text-slate-400 text-xs uppercase font-bold mb-1">Mesafe</p>
                            <p className="text-white font-bold">{selectedLoad.distance}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                            <p className="text-slate-400 text-xs uppercase font-bold mb-1">Ağırlık</p>
                            <p className="text-white font-bold">{selectedLoad.weight}</p>
                          </div>
                        </div>

                        <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50 mb-6">
                          <h4 className="text-white font-bold mb-3 flex items-center gap-2">🏢 İşveren Hakkında</h4>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-300 text-sm">{selectedLoad.employer}</span>
                            <Stars n={getER(selectedLoad.employer).ratings.payment} />
                          </div>
                          <div className="h-px bg-slate-700/50 my-2" />
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">⚡ Hızlı Ödeme</span>
                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                            <span className="flex items-center gap-1">📞 7/24 İletişim</span>
                          </div>
                        </div>

                        <button onClick={() => { showToast("✅ Teklifiniz işverene iletildi! Geri dönüş bekleniyor."); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 100); }} className="w-full py-5 rounded-2xl text-white font-black text-xl active:scale-[0.97] transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40" style={{ background: "linear-gradient(180deg,#34d399,#059669)" }}>
                          ✅ TEKLİF VER
                        </button>
                      </div>
                    )}

                    {detailTab === "reviews" && (
                      <div className="animate-in fade-in zoom-in-95 duration-200">
                        {/* Review Content - Same logic as before but better styled */}
                        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-5">
                          <RatingBars ratings={getER(selectedLoad.employer).ratings} />
                        </div>
                        {getER(selectedLoad.employer).reviews.map((r, i) => (
                          <div key={i} className="mb-3 p-4 rounded-2xl bg-slate-800/30 border border-slate-700/30">
                            <div className="flex justify-between mb-2">
                              <span className="font-bold text-white text-sm">{r.driver}</span>
                              <Stars n={r.stars} />
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">"{r.text}"</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {detailTab === "delivery" && (
                      <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-4 text-center">
                          <h4 className="text-white font-bold text-lg mb-1">{getDP(selectedLoad.to).name}</h4>
                          <p className="text-slate-400 text-sm mb-4">{selectedLoad.to}</p>
                          <DemorajBar hours={getDP(selectedLoad.to).avgHours} />
                        </div>
                        {/* Additional delivery content... */}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── LOAD DETAIL SCREEN ─── */}
          {screen === "loadDetail" && selectedLoadDetail && (
            <div className="flex flex-col min-h-full pb-20">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-20">
                <button
                  onClick={() => nav("map")}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all text-slate-300 hover:text-white"
                >
                  <ArrowLeft size={24} />
                </button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center text-white font-bold text-sm">
                    <span>{selectedLoadDetail.from}</span>
                    <span className="text-slate-500">→</span>
                    <span>{selectedLoadDetail.to}</span>
                  </div>
                  <div className="text-emerald-400 font-black text-lg tracking-tight">
                    {fmt(selectedLoadDetail.price)} ₺
                  </div>
                </div>
                <div className="w-10" />
              </div>

              <div className="p-5 space-y-5">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Mesafe</p>
                    <p className="text-white font-bold">{selectedLoadDetail.distance}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Ağırlık</p>
                    <p className="text-white font-bold">{selectedLoadDetail.weight}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Tarih</p>
                    <FreshTag d={selectedLoadDetail.daysOld} />
                  </div>
                </div>

                {/* Main Card */}
                <div className="p-5 rounded-3xl bg-slate-800 border border-slate-700 relative overflow-hidden">
                  <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none ${selectedLoadDetail.urgent ? 'bg-red-500' : 'bg-blue-500'}`} />
                  
                  <div className="relative">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-slate-400 text-xs font-bold uppercase mb-1">Yük Cinsi</p>
                        <div className="flex items-center gap-2">
                          <Package className="text-blue-400" size={20} />
                          <span className="text-white font-bold text-lg">{selectedLoadDetail.type}</span>
                        </div>
                      </div>
                      <TrailerBadge type={selectedLoadDetail.trailer} big />
                    </div>

                    <div className="flex items-center gap-4 relative mb-6">
                      <div className="flex flex-col items-center h-full absolute left-1.5 top-2 bottom-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 z-10" />
                        <div className="w-0.5 flex-1 bg-slate-700 my-1" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 z-10" />
                      </div>
                      <div className="flex-1 space-y-8 pl-8">
                        <div>
                          <p className="text-slate-400 text-[10px] font-bold uppercase mb-0.5">Yükleme Yeri</p>
                          <p className="text-white font-bold text-lg">{selectedLoadDetail.from}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px] font-bold uppercase mb-0.5">Boşaltma Yeri</p>
                          <p className="text-white font-bold text-lg">{selectedLoadDetail.to}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700/50 flex items-center justify-between">
                      <KdvBadge included={selectedLoadDetail.kdv} big />
                      {selectedLoadDetail.urgent && (
                        <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 animate-pulse">
                          ⚡ ACİL YÜK
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Employer Card */}
                <div className="p-5 rounded-3xl bg-slate-800 border border-slate-700">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <User size={18} className="text-blue-400" />
                    İlan Sahibi
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border-2 border-slate-700 shrink-0 overflow-hidden">
                      {selectedLoadDetail.employerAvatar ? (
                        <img src={selectedLoadDetail.employerAvatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(selectedLoadDetail.employerName)
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">{selectedLoadDetail.employerName}</p>
                      <p className="text-slate-400 text-sm font-mono">
                        {userSettings.hidePhoneOnCards
                          ? "Numara kullanıcı ayarında gizli"
                          : selectedLoadDetail.employerPhone
                            ? selectedLoadDetail.employerPhone.replace(/(\d{4})(\d{3})(\d{2})(\d{2})/, "$1 *** ** $4")
                            : "Numara Gizli"}
                      </p>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        selectedLoadDetail.employerRole === 'driver' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                          : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>
                        {selectedLoadDetail.employerRole === 'driver' ? '🚛 Şoför' : '🏢 İşveren'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ─── BIDDING SYSTEM ─── */}
                {user && (
                  <div className="p-5 rounded-3xl bg-slate-800 border border-slate-700 animate-in slide-in-from-bottom-5 duration-500">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      💰 {selectedLoadDetail.raw?.employer_id === user.id ? "Gelen Teklifler" : "Teklif Ver"}
                    </h3>

                    {selectedLoadDetail.raw?.employer_id === user.id ? (
                      /* EMPLOYER VIEW: List Bids */
                      <div className="space-y-3">
                        {employerBidRows.length === 0 ? (
                          <p className="text-slate-400 text-sm text-center py-4">Henüz teklif gelmedi.</p>
                        ) : (
                          <>
                            {loadBids.length === 0 && employerNotificationBids.length > 0 && (
                              <p className="text-[11px] text-cyan-300 font-bold text-center py-1">
                                Bildirim tabanlı teklif görünümü aktif (DB fallback).
                              </p>
                            )}
                            {employerBidRows.map((bid) => (
                            <div key={bid.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-white font-bold">{bid.driver?.full_name || "Şoför"}</span>
                                  <div className="flex items-center text-amber-400 text-[10px]">
                                    ★ {bid.driver?.rating || "5.0"}
                                  </div>
                                </div>
                                <div className="text-emerald-400 font-black text-lg">{bid.price} ₺</div>
                                <div className="text-slate-500 text-[10px]">{new Date(bid.created_at).toLocaleDateString('tr-TR')}</div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                {bid.status === 'PENDING' ? (
                                  <>
                                    <button 
                                      onClick={() => respondToBid(bid.id, bid.driver_id, 'ACCEPTED')}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 active:scale-95 transition-all"
                                    >
                                      ✅ Kabul
                                    </button>
                                    <button 
                                      onClick={() => respondToBid(bid.id, bid.driver_id, 'REJECTED')}
                                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all"
                                    >
                                      ❌ Reddet
                                    </button>
                                  </>
                                ) : (
                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${bid.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                    {bid.status === 'ACCEPTED' ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                                  </span>
                                )}
                              </div>
                            </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      /* DRIVER VIEW: Submit Bid */
                      <div>
                        {hasBid ? (
                          <div className="text-center py-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
                            <h4 className="text-emerald-400 font-bold mb-1">Teklifiniz İletildi</h4>
                            <p className="text-slate-400 text-sm">Verilen Teklif: <span className="text-white font-bold">{bidPrice} ₺</span></p>
                            <p className="text-slate-500 text-xs mt-2">İşveren onayladığında bildirim alacaksınız.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
                              <input
                                type="number"
                                placeholder="Teklifiniz (Ör: 14500)"
                                value={bidPrice}
                                onChange={(e) => setBidPrice(e.target.value)}
                                className="w-full py-4 pl-8 pr-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <button
                              onClick={submitBid}
                              disabled={isProcessingBid}
                              className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-lg ${isProcessingBid ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500'}`}
                            >
                              {isProcessingBid ? "Gönderiliyor..." : "Teklif Gönder"}
                            </button>
                            <p className="text-slate-500 text-xs text-center">Teklifiniz işverene anında iletilir.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Bottom Bar */}
              <div className="fixed bottom-0 inset-x-0 p-5 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-30 pb-8 safe-area-bottom">
                <div className="flex gap-3 max-w-[430px] mx-auto w-full">
                  {user && selectedLoadDetail.raw?.employer_id === user.id ? (
                    /* Owner Actions */
                    <>
                      <button className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-bold border border-slate-600 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                        ✏️ DÜZENLE
                      </button>
                      <button className="flex-1 py-4 rounded-2xl bg-red-500/10 text-red-400 font-bold border border-red-500/30 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                        🗑️ SİL
                      </button>
                    </>
                  ) : (
                    /* Visitor Actions */
                    <>
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-3">
                          <a
                            href={!userSettings.hidePhoneOnCards && selectedLoadDetail.employerPhone ? `tel:${selectedLoadDetail.employerPhone}` : "#"}
                            className={`flex-1 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                              userSettings.hidePhoneOnCards || !selectedLoadDetail.employerPhone
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 shadow-none"
                                : "bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500"
                            }`}
                            onClick={e => (userSettings.hidePhoneOnCards || !selectedLoadDetail.employerPhone) && e.preventDefault()}
                          >
                            📞 ARA
                          </a>
                          <a
                            href={!userSettings.hidePhoneOnCards && selectedLoadDetail.employerPhone ? `https://wa.me/${selectedLoadDetail.employerPhone.replace(/\D/g,'')}?text=Merhaba, ${selectedLoadDetail.from} - ${selectedLoadDetail.to} ilanı için yazıyorum.` : "#"}
                            className={`flex-1 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                              userSettings.hidePhoneOnCards || !selectedLoadDetail.employerPhone
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 shadow-none"
                                : "bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
                            }`}
                            onClick={e => (userSettings.hidePhoneOnCards || !selectedLoadDetail.employerPhone) && e.preventDefault()}
                          >
                            💬 WHATSAPP
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={handleReportLoad}
                          disabled={isReportingLoad}
                          className={`w-full py-2.5 rounded-xl text-xs font-black border transition-all ${
                            isReportingLoad
                              ? "bg-slate-700 text-slate-300 border-slate-600 cursor-not-allowed"
                              : "bg-red-500/10 text-red-300 border-red-500/35 hover:bg-red-500/20"
                          }`}
                        >
                          {isReportingLoad ? "RAPOR GÖNDERİLİYOR..." : "🚨 İLANI RAPORLA"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {screen === "legal" && (
            <div className="p-5 pb-20 space-y-4">
              <h2 className="text-white text-3xl font-black tracking-tight">⚖️ Hukuki Sayfalar</h2>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">KVKK / Gizlilik Politikası</p>
                <p className="text-slate-300 text-sm mt-1">Kimlik, iletişim, ilan ve teklif verileri yalnızca hizmet sunumu amacıyla işlenir.</p>
                <p className="text-slate-400 text-xs mt-1">Erişim/düzeltme/silme talepleri için: support@yukcep.app</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">Kullanım Şartları</p>
                <p className="text-slate-300 text-sm mt-1">Platform pazaryeridir. Taşıma sözleşmesi işveren ve taşıyıcı taraflar arasındadır.</p>
                <p className="text-slate-400 text-xs mt-1">Yanıltıcı ilan, spam teklif ve kötüye kullanım hesap kısıtına yol açabilir.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">Çerez Politikası</p>
                <p className="text-slate-300 text-sm mt-1">Zorunlu çerezler oturum için, analitik çerezler performans iyileştirmesi için kullanılır.</p>
                <p className="text-slate-400 text-xs mt-1">Tarayıcı ayarlarından çerez tercihlerini yönetebilirsin.</p>
              </div>
            </div>
          )}

          {screen === "support" && (
            <div className="p-5 pb-20 space-y-4">
              <h2 className="text-white text-3xl font-black tracking-tight">🛟 Yardım Merkezi</h2>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">Sık Sorulan Sorular</p>
                <p className="text-slate-300 text-sm mt-1">Rol değişimi, teklif süreci, ilan yönetimi, görünürlük ve bildirim adımlarını kapsar.</p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <p>• İşveren: İlan ver → teklifleri yönet → kabul/red</p>
                  <p>• Sürücü: İş ara → teklif gönder → Benim Yapacak İşlerim</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">İletişim</p>
                <p className="text-slate-300 text-sm mt-1">support@yukcep.app · Hafta içi 09:00-18:00</p>
                <p className="text-slate-400 text-xs mt-1">P1 olaylar için hedef ilk yanıt: 15 dakika.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <p className="text-white font-bold">Acil Durum / Güvenlik Bildirimi</p>
                <p className="text-slate-300 text-sm mt-1">Şüpheli ilan veya kötüye kullanım durumunu “İlanı Raporla” ile iletebilirsin.</p>
              </div>
            </div>
          )}

          {/* ─── AUTH SCREEN ─── */}
          {screen === "auth" && (
            <Suspense fallback={<div className="p-6 text-slate-300 text-sm">Kimlik doğrulama ekranı yükleniyor...</div>}>
              <AuthScreen
                onBack={() => nav("welcome")}
                onAuthSuccess={handleAuthSuccess}
              />
            </Suspense>
          )}

          {/* ─── EMPLOYER ─── */}
          {screen === "employer" && (
            <div className="relative p-5 pb-20">
              {isPostingLoad && (
                <div className="absolute inset-0 z-30 rounded-2xl bg-slate-950/88 backdrop-blur-[3px] border border-slate-700/50 flex items-center justify-center p-6">
                  <div className="w-full max-w-sm rounded-2xl border border-cyan-500/25 bg-slate-900/90 p-5 shadow-2xl">
                    <div className="text-center mb-4">
                      <p className="text-cyan-300 font-black text-base tracking-wide">İLAN YAYINLANIYOR</p>
                      <p className="text-slate-300 text-xs mt-1">Lütfen bekleyin. Alanlar geçici olarak kilitlendi.</p>
                    </div>
                    <div className="yc-posting-track">
                      <div className="yc-posting-track-line" />
                      <div className="yc-posting-truck" aria-hidden="true">🚚</div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span>Rota ve ilan bilgileri doğrulanıyor...</span>
                    </div>
                  </div>
                </div>
              )}

              <fieldset
                disabled={isPostingLoad}
                className={`border-0 m-0 p-0 min-w-0 ${isPostingLoad ? "opacity-60 select-none" : ""}`}
              >
              <h2 className="text-white text-3xl font-black mb-2 tracking-tight">🏢 Hızlı İlan Ver</h2>
              <p className="text-slate-400 text-sm mb-6">Yük detaylarını girin, binlerce şoföre ulaşın.</p>

              {/* Fleet Toggle - Improved */}
              <button
                type="button"
                onClick={() => setEmpForm(p => ({ ...p, fleet: !p.fleet }))}
                className={`w-full p-4 rounded-2xl mb-6 border-2 flex items-center gap-4 transition-all active:scale-[0.98] ${empForm.fleet ? "border-amber-500 bg-amber-500/10 shadow-amber-500/10 shadow-lg" : "border-slate-700 bg-slate-800/50"}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${empForm.fleet ? "bg-amber-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {empForm.fleet ? "🚚" : "📦"}
                </div>
                <div className="text-left flex-1">
                  <p className={`font-bold text-base transition-colors ${empForm.fleet ? "text-amber-400" : "text-white"}`}>{empForm.fleet ? "Toplu Filo İşi" : "Standart Yük İlanı"}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{empForm.fleet ? "Birden fazla araç kiralayın." : "Tek seferlik yük taşıma."}</p>
                </div>
                <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all ${empForm.fleet ? "bg-amber-500" : "bg-slate-600"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${empForm.fleet ? "translate-x-4" : ""}`} />
                </div>
              </button>

              {/* Form Fields - Validated */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">📍 Nereden</label>
                    <select
                      value={empForm.from}
                      onChange={e => { setEmpForm(p => ({ ...p, from: e.target.value })); if (formErrors.from) setFormErrors(p => ({ ...p, from: null })); }}
                      className={`w-full py-4 px-4 rounded-xl bg-slate-800 border text-white text-base font-bold appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all ${formErrors.from ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                    >
                      <option value="">İl Seçin</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {formErrors.from && <span className="text-red-400 text-[10px] font-bold absolute -bottom-4 left-1">{formErrors.from}</span>}
                  </div>
                  <div className="relative">
                    <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">📍 Nereye</label>
                    <select
                      value={empForm.to}
                      onChange={e => { setEmpForm(p => ({ ...p, to: e.target.value })); if (formErrors.to) setFormErrors(p => ({ ...p, to: null })); }}
                      className={`w-full py-4 px-4 rounded-xl bg-slate-800 border text-white text-base font-bold appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all ${formErrors.to ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                    >
                      <option value="">İl Seçin</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {formErrors.to && <span className="text-red-400 text-[10px] font-bold absolute -bottom-4 left-1">{formErrors.to}</span>}
                  </div>
                </div>

                <div className="relative pt-1">
                  <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">📦 Yük Cinsi</label>
                  <input
                    type="text"
                    placeholder="Ör: Tekstil, Mobilya..."
                    value={empForm.type}
                    onChange={e => { setEmpForm(p => ({ ...p, type: e.target.value })); if (formErrors.type) setFormErrors(p => ({ ...p, type: null })); }}
                    className={`w-full py-4 px-4 rounded-xl bg-slate-800 border text-white text-base font-bold placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${formErrors.type ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                  />
                  {formErrors.type && <span className="text-red-400 text-[10px] font-bold absolute -bottom-4 left-1">{formErrors.type}</span>}
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">🚛 Dorse Tipi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {dorseTypes.map(d => (
                      <button type="button" key={d.k} onClick={() => setEmpForm(p => ({ ...p, trailer: d.k }))} className={`py-3 rounded-xl text-center font-bold text-xs transition-all active:scale-95 ${empForm.trailer === d.k ? "text-white border-2 scale-105 shadow-lg" : "text-slate-400 bg-slate-800 border border-slate-700 opacity-70"}`} style={empForm.trailer === d.k ? { background: d.color + "25", borderColor: d.color } : {}}>
                        <span className="text-xl block mb-1">{d.icon}</span>{d.k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative pt-1">
                  <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">💰 Fiyat (₺)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="0"
                      value={empForm.price}
                      onChange={e => { setEmpForm(p => ({ ...p, price: e.target.value })); if (formErrors.price) setFormErrors(p => ({ ...p, price: null })); }}
                      className={`flex-1 py-4 px-4 rounded-xl bg-slate-800 border text-white text-lg font-black placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${formErrors.price ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                    />
                    <button type="button" onClick={() => setEmpForm(p => ({ ...p, kdv: !p.kdv }))} className={`h-[58px] px-4 rounded-xl font-bold text-sm transition-all whitespace-nowrap active:scale-95 border-2 ${empForm.kdv ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400 opacity-60"}`}>
                      {empForm.kdv ? "+KDV" : "KDV Yok"}
                    </button>
                  </div>
                  {formErrors.price && <span className="text-red-400 text-[10px] font-bold absolute -bottom-4 left-1">{formErrors.price}</span>}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePostLoad}
                    disabled={isPostingLoad}
                    className={`w-full py-5 rounded-2xl text-white font-black text-xl active:scale-[0.98] transition-all relative overflow-hidden shadow-xl ${isPostingLoad ? "opacity-70 cursor-not-allowed" : ""}`}
                    style={{ background: empForm.fleet ? "linear-gradient(180deg,#fbbf24,#d97706)" : "linear-gradient(180deg,#fb923c,#ea580c)" }}
                  >
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                    <span className="relative drop-shadow-sm">{isPostingLoad ? "YAYINLANIYOR..." : (empForm.fleet ? "FİLO İLANI YAYINLA" : "📢 İLANI YAYINLA")}</span>
                  </button>
                  {postLoadError && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p className="text-red-300 text-xs font-bold">Son Hata</p>
                      <p className="text-red-200 text-xs leading-relaxed mt-1">{postLoadError}</p>
                    </div>
                  )}
                </div>

              </div>
              </fieldset>
            </div>
          )}
          </div>{/* end page-enter */}
        </div>

        {showSettingsPanel && (
          <div
            className="absolute inset-0 z-[92] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => setShowSettingsPanel(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-700/60 bg-slate-900/95 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-600/15 to-cyan-500/15 flex items-center justify-between">
                <div>
                  <p className="text-white text-lg font-black tracking-tight">⚙️ Ayarlar</p>
                  <p className="text-slate-400 text-xs">Profil ve rol tercihleri</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsPanel(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
                {user && (
                  <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
                    <p className="text-white text-sm font-bold">Aktif Rol</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Ana sayfada yalnızca seçtiğin role ait akış görünür.
                    </p>
                    <p className="text-cyan-300 text-[11px] mt-1.5 font-semibold">
                      Aynı hesapta iki rolü de kullanabilirsin; buradan istediğin zaman geçiş yapabilirsin.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        disabled={isUpdatingRole}
                        onClick={() => handleSwitchRole("driver")}
                        className={`py-2.5 rounded-lg text-xs font-black border transition-all active:scale-95 ${
                          activeRole === "driver"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                            : "bg-slate-900 text-slate-300 border-slate-700"
                        } ${isUpdatingRole ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        🚛 İş Arıyorum
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingRole}
                        onClick={() => handleSwitchRole("employer")}
                        className={`py-2.5 rounded-lg text-xs font-black border transition-all active:scale-95 ${
                          activeRole === "employer"
                            ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                            : "bg-slate-900 text-slate-300 border-slate-700"
                        } ${isUpdatingRole ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        🏢 İşverenim
                      </button>
                    </div>
                    {isUpdatingRole && (
                      <p className="text-[10px] text-cyan-300 mt-2 font-bold">Rol güncelleniyor...</p>
                    )}
                  </div>
                )}
                <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 space-y-3">
                  <p className="text-white text-sm font-bold">Bildirim Tercihleri</p>
                  <button
                    type="button"
                    onClick={() => updateUserSetting("notificationsEnabled", !userSettings.notificationsEnabled)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold ${
                      userSettings.notificationsEnabled
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>Anlık bildirim toast'ı</span>
                    <span>{userSettings.notificationsEnabled ? "Açık" : "Kapalı"}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 space-y-3">
                  <p className="text-white text-sm font-bold">Dil</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateUserSetting("language", "tr")}
                      className={`py-2 rounded-lg text-xs font-black border ${userSettings.language === "tr" ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-slate-900 text-slate-300 border-slate-700"}`}
                    >
                      Türkçe
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUserSetting("language", "en")}
                      className={`py-2 rounded-lg text-xs font-black border ${userSettings.language === "en" ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-slate-900 text-slate-300 border-slate-700"}`}
                    >
                      English
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 space-y-3">
                  <p className="text-white text-sm font-bold">Gizlilik ve Güvenlik</p>
                  <button
                    type="button"
                    onClick={() => updateUserSetting("hidePhoneOnCards", !userSettings.hidePhoneOnCards)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold ${
                      userSettings.hidePhoneOnCards
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>Telefonu kartlarda gizle</span>
                    <span>{userSettings.hidePhoneOnCards ? "Açık" : "Kapalı"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateUserSetting("requireEmailVerified", !userSettings.requireEmailVerified)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold ${
                      userSettings.requireEmailVerified
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>İşlem öncesi e-posta doğrulaması iste</span>
                    <span>{userSettings.requireEmailVerified ? "Açık" : "Kapalı"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateUserSetting("requirePhoneOnActions", !userSettings.requirePhoneOnActions)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold ${
                      userSettings.requirePhoneOnActions
                        ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>İşlem öncesi telefon doğrulaması iste</span>
                    <span>{userSettings.requirePhoneOnActions ? "Açık" : "Kapalı"}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsPanel(false);
                      nav("legal");
                    }}
                    className="py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"
                  >
                    Hukuki Sayfalar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsPanel(false);
                      nav("support");
                    }}
                    className="py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"
                  >
                    Yardım Merkezi
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsPanel(false)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}

        {roleSwitchPopup && (
          <div
            className="absolute inset-0 z-[93] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setRoleSwitchPopup(null)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-slate-900/95 shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-cyan-600/15 to-blue-500/15">
                <p className="text-white text-lg font-black tracking-tight">{roleSwitchPopup.title}</p>
                <p className="text-slate-300 text-xs mt-1">{roleSwitchPopup.summary}</p>
              </div>
              <div className="p-4 space-y-2">
                {roleSwitchPopup.points?.map((point, idx) => (
                  <div key={`role-point-${idx}`} className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
                    <p className="text-slate-200 text-xs font-semibold leading-relaxed">{point}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRoleSwitchPopup(null)}
                  className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {roleSwitchPopup.action || "Anladım"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ LIVE SUPPORT CHAT ═══════════════════ */}
        {chatOpen && (
          <div className="absolute bottom-20 right-4 w-72 rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900 z-50 animate-in slide-in-from-bottom-10 fade-in duration-200 shadow-2xl" style={{ height: "380px" }}>
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute h-full w-full rounded-full bg-green-300 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-green-400" /></span>
                <span className="text-white font-bold text-sm">Canlı Destek</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white"><span className="text-lg">✕</span></button>
            </div>
            <div className="flex flex-col h-full pb-14 bg-slate-900/95 backdrop-blur-md">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${m.from === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="absolute bottom-0 inset-x-0 p-3 bg-slate-800/90 border-t border-slate-700/50 flex items-center gap-2">
                <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Mesajınız..." className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-blue-500 outline-none transition-colors" />
                <button onClick={sendChat} className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white active:scale-95 transition-transform shadow-lg shadow-blue-600/20">➤</button>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT FAB - Always Visible */}
        <button onClick={() => setChatOpen(!chatOpen)} className="floating-fab absolute bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center z-40 active:scale-90 transition-all shadow-lg hover:shadow-blue-500/40" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
          <span className="text-2xl drop-shadow-md">{chatOpen ? "✕" : <MessageSquare size={26} className="fill-white/20" />}</span>
          {!chatOpen && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900 animate-bounce">1</span>}
        </button>
      </div>
    </div>
  );
}

