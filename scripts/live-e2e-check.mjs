import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.YUKCEP_BASE_URL || "https://yukcep.vercel.app/";

const now = new Date();
const seed = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
  now.getUTCDate()
).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(
  2,
  "0"
)}${String(now.getUTCSeconds()).padStart(2, "0")}`;

const runId = `e2e-${seed}`;
const fromCity = "Adana";
const toCity = "Ankara";
const loadType = `E2E-CODEX-${seed}`;
const loadPrice = "32000";
const bidPrice = "30500";
const driverPhone = `0555${seed.slice(-7)}`;
const employerPhone = `0533${seed.slice(-7)}`;
const password = `YukCep!${seed.slice(-6)}Aa`;

const employer = {
  fullName: `E2E Isveren ${seed.slice(-6)}`,
  email: `e2e.isveren.${seed}@example.com`,
  phone: employerPhone,
  password,
  role: "employer",
};

const driver = {
  fullName: `E2E Sofor ${seed.slice(-6)}`,
  email: `e2e.sofor.${seed}@example.com`,
  phone: driverPhone,
  password,
  role: "driver",
};

const outputDir = path.join(process.cwd(), "tmp", "e2e");
fs.mkdirSync(outputDir, { recursive: true });

const results = [];
const startedAt = Date.now();

const pushResult = (entry) => {
  results.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

const ensureVisible = async (locator, timeout = 30000, message = "Element bulunamadı.") => {
  await locator.waitFor({ state: "visible", timeout }).catch(() => {
    throw new Error(message);
  });
};

const isVisible = async (locator) => locator.isVisible().catch(() => false);

const waitForWelcomeReady = async (page, options = {}) => {
  if (options.navigate !== false) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  }
  await ensureVisible(page.getByText("YükCep").first(), 45000, "Ana ekran yüklenmedi.");
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const hasPrimary =
      (await isVisible(page.getByRole("button", { name: /^İŞ ARIYORUM$/i }))) ||
      (await isVisible(page.getByRole("button", { name: /^İŞVERENİM$/i }))) ||
      (await isVisible(page.getByRole("button", { name: /Feed'e Git/i }))) ||
      (await isVisible(page.getByRole("button", { name: /Profil Rolü Yükleniyor/i }))) ||
      (await isVisible(page.getByRole("button", { name: /Giriş Yap/i })));
    if (hasPrimary) return;
    await page.waitForTimeout(300);
  }
  throw new Error("Ana ekran aksiyon butonları yüklenmedi.");
};

const authViaSignup = async (page, user) => {
  await waitForWelcomeReady(page);
  const loginButton = page.getByRole("button", { name: /Giriş Yap/i });
  await ensureVisible(loginButton, 20000, "Giriş Yap butonu bulunamadı.");
  await loginButton.click();

  await ensureVisible(page.getByRole("heading", { name: /Giriş Yap/i }), 25000, "Auth ekranı açılmadı.");
  await page.getByRole("button", { name: /Ücretsiz Hesap Oluştur/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /Hesap Oluştur/i }), 15000, "Signup ekranı açılmadı.");

  await page.getByPlaceholder("Adınız Soyadınız").fill(user.fullName);
  await page.getByPlaceholder("ornek@email.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByPlaceholder("05XX XXX XX XX").fill(user.phone);

  if (user.role === "employer") {
    await page.locator("button", { hasText: "Yük göndereceğim" }).first().click();
  } else {
    await page.locator("button", { hasText: "Yük taşıyorum" }).first().click();
  }

  await page.getByRole("button", { name: /KAYIT OL/i }).click();

  const authDeadline = Date.now() + 40000;
  while (Date.now() < authDeadline) {
    const verifyRequired = await page
      .getByText("Lütfen e-posta adresinizi doğrulayın.", { exact: false })
      .isVisible()
      .catch(() => false);
    if (verifyRequired) {
      throw new Error("Signup tamamlandı ama e-posta doğrulaması zorunlu. Otomatik E2E devam edemiyor.");
    }

    const welcomeReady =
      (await isVisible(page.getByRole("button", { name: /^İŞ ARIYORUM$/i }))) ||
      (await isVisible(page.getByRole("button", { name: /^İŞVERENİM$/i }))) ||
      (await isVisible(page.getByRole("button", { name: /Feed'e Git/i }))) ||
      (await isVisible(page.getByRole("button", { name: /Profil Rolü Yükleniyor/i })));
    if (welcomeReady) {
      const roleDeadline = Date.now() + 15000;
      while (Date.now() < roleDeadline) {
        const employerFeedVisible = await page
          .getByRole("button", { name: /İşveren Feed'e Git/i })
          .isVisible()
          .catch(() => false);
        const driverFeedVisible = await page
          .getByRole("button", { name: /İş Arıyorum Feed'e Git/i })
          .isVisible()
          .catch(() => false);

        if (user.role === "employer" && employerFeedVisible) return;
        if (user.role === "driver" && driverFeedVisible) return;
        if (user.role === "employer" && driverFeedVisible) {
          throw new Error("Signup sonrası rol driver görünüyor; employer bekleniyordu.");
        }
        if (user.role === "driver" && employerFeedVisible) {
          throw new Error("Signup sonrası rol employer görünüyor; driver bekleniyordu.");
        }
        await page.waitForTimeout(350);
      }
      throw new Error("Signup sonrası rol feed butonu doğrulanamadı.");
    }

    await page.waitForTimeout(400);
  }

  throw new Error("Signup sonrası welcome ekranına dönülemedi.");
};

const postLoadAsEmployer = async (page) => {
  await waitForWelcomeReady(page);
  const employerFeedButton = page.getByRole("button", { name: /İşveren Feed'e Git/i });
  await ensureVisible(employerFeedButton, 20000, "İşveren feed butonu bulunamadı.");
  await employerFeedButton.click();
  await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 25000, "İşveren feed ekranı açılmadı.");
  await page.getByRole("button", { name: /Yeni İlan Ver/i }).click();
  await ensureVisible(
    page.getByRole("heading", { name: /Hızlı İlan Ver/i }),
    25000,
    "İşveren ilan ekranı açılmadı."
  );

  const selects = page.locator("fieldset select");
  await selects.nth(0).selectOption(fromCity);
  await selects.nth(1).selectOption(toCity);

  await page.getByPlaceholder("Ör: Tekstil, Mobilya...").fill(loadType);
  await page.getByPlaceholder("0").fill(loadPrice);
  await page.getByRole("button", { name: /İLANI YAYINLA|FİLO İLANI YAYINLA/i }).click();

  const mapLoaded = page.getByText(/Yükler/i).first();
  await ensureVisible(mapLoaded, 90000, "İlan yayınlama sonrası map/list ekranı gelmedi.");

  const card = page.locator("button", { hasText: loadType }).first();
  await ensureVisible(card, 45000, "Yayınlanan ilan listede görünmedi.");
};

const ensureEmployerFeedHasLoadCard = async (page) => {
  await waitForWelcomeReady(page);
  const employerFeedButton = page.getByRole("button", { name: /İşveren Feed'e Git/i });
  await ensureVisible(employerFeedButton, 15000, "İşveren feed butonu görünmedi.");
  await employerFeedButton.click();
  await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 30000, "İşveren feed ekranı açılmadı.");
  await page.getByRole("button", { name: /^Yenile$/i }).click();
  const card = page.locator("div", { hasText: loadType }).first();
  await ensureVisible(card, 45000, "İşveren feed kartında yeni ilan görünmedi.");
};

const openDriverLocationAndList = async (page) => {
  await waitForWelcomeReady(page);
  const driverFeedButton = page.getByRole("button", { name: /İş Arıyorum Feed'e Git/i });
  await ensureVisible(driverFeedButton, 20000, "İş arıyorum feed butonu bulunamadı.");
  await driverFeedButton.click();
  await ensureVisible(page.getByRole("heading", { name: /İş Arıyorum Feed/i }), 25000, "Şoför feed ekranı açılmadı.");
  await page.getByRole("button", { name: /Yük Ara/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /Neredesiniz/i }), 25000, "Lokasyon ekranı açılmadı.");

  await page.getByPlaceholder(/Sehir ara/i).fill(fromCity);
  await page.getByRole("button", { name: new RegExp(`^${fromCity}$`, "i") }).click();

  await ensureVisible(page.getByText(/Yükler/i).first(), 30000, "Yük listesi ekranı açılmadı.");
};

const openDriverTargetLoadDetail = async (page) => {
  const loadCard = page.locator("button", { hasText: loadType }).first();
  await ensureVisible(loadCard, 45000, "Şoför tarafında hedef ilan listede görünmedi.");
  await loadCard.click();

  await ensureVisible(page.getByText(/Teklif Ver/i), 25000, "Yük detayında teklif alanı açılmadı.");
};

const ensureNoFatalUiError = async (page) => {
  const text = ((await page.locator("body").textContent()) || "").replace(/\s+/g, " ");
  if (/Bir Hata Oluştu/i.test(text)) throw new Error("UI error boundary görünüyor.");
  if (/Teklif gönderilemedi/i.test(text)) throw new Error("Ekranda 'Teklif gönderilemedi' hatası görünüyor.");
};

const submitBidAsDriver = async (page) => {
  await page.getByPlaceholder(/Teklifiniz/i).fill(bidPrice);
  await page.getByRole("button", { name: /Teklif Gönder/i }).click();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const bodyText = ((await page.locator("body").textContent()) || "").replace(/\s+/g, " ");
    if (/Teklifiniz\s*[İi]letildi/i.test(bodyText)) return;
    if (/Teklif gönderilemedi/i.test(bodyText)) {
      throw new Error("Teklif gönderilemedi.");
    }
    await page.waitForTimeout(350);
  }
  throw new Error("Teklif gönderimi tamamlanmadı.");
};

const getInitials = (fullName = "") =>
  String(fullName)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const assertHomeButtonsForRole = async (page, role) => {
  await waitForWelcomeReady(page, { navigate: false });
  const deadline = Date.now() + 25000;
  let lastState = {};
  while (Date.now() < deadline) {
    const hasDriverBtn = await isVisible(page.getByRole("button", { name: /^İŞ ARIYORUM$/i }));
    const hasEmployerBtn = await isVisible(page.getByRole("button", { name: /^İŞVERENİM$/i }));
    const hasDriverFeedBtn = await isVisible(page.getByRole("button", { name: /İş Arıyorum Feed'e Git/i }));
    const hasEmployerFeedBtn = await isVisible(page.getByRole("button", { name: /İşveren Feed'e Git/i }));
    const hasPendingRoleBtn = await isVisible(page.getByRole("button", { name: /Profil Rolü Yükleniyor/i }));

    lastState = {
      hasDriverBtn,
      hasEmployerBtn,
      hasDriverFeedBtn,
      hasEmployerFeedBtn,
      hasPendingRoleBtn,
    };

    if (role === "driver") {
      const ready =
        !hasDriverBtn &&
        !hasEmployerBtn &&
        !hasEmployerFeedBtn &&
        hasDriverFeedBtn &&
        !hasPendingRoleBtn;
      if (ready) return;
    } else {
      const ready =
        !hasDriverBtn &&
        !hasEmployerBtn &&
        !hasDriverFeedBtn &&
        hasEmployerFeedBtn &&
        !hasPendingRoleBtn;
      if (ready) return;
    }

    await page.waitForTimeout(350);
  }

  throw new Error(`Ana sayfa rol görünürlüğü doğrulanamadı (${role}). state=${JSON.stringify(lastState)}`);
};

const openSettingsFromProfile = async (page, fullName) => {
  await waitForWelcomeReady(page, { navigate: false });
  const initials = getInitials(fullName);
  let avatarButton = page.getByRole("button", { name: new RegExp(`^${initials}$`, "i") }).first();
  let hasAvatar = await avatarButton.isVisible().catch(() => false);
  if (!hasAvatar) {
    avatarButton = page.getByRole("button", { name: /^\?$/i }).first();
    hasAvatar = await avatarButton.isVisible().catch(() => false);
  }
  if (hasAvatar) {
    await avatarButton.click({ force: true });
  } else {
    const fallbackTopbarAvatar = page.locator(".topbar-grad button").last();
    const hasFallback = await fallbackTopbarAvatar.isVisible().catch(() => false);
    if (!hasFallback) {
      throw new Error("Profil avatar butonu bulunamadı.");
    }
    await fallbackTopbarAvatar.click({ force: true });
  }
  const settingsButton = page.getByRole("button", { name: /Ayarlar/i });
  await page.waitForTimeout(350);
  let settingsVisible = await settingsButton.isVisible().catch(() => false);
  if (!settingsVisible) {
    const fallbackTopbarAvatar = page.locator(".topbar-grad button").last();
    const hasFallback = await fallbackTopbarAvatar.isVisible().catch(() => false);
    if (hasFallback) {
      await fallbackTopbarAvatar.click({ force: true });
      await page.waitForTimeout(350);
      settingsVisible = await settingsButton.isVisible().catch(() => false);
    }
  }
  if (!settingsVisible) {
    const buttonNames = await page
      .getByRole("button")
      .allTextContents()
      .catch(() => []);
    throw new Error(`Profil menüsü açılamadı. visible_buttons=${JSON.stringify(buttonNames.slice(0, 20))}`);
  }
  await page.getByRole("button", { name: /Ayarlar/i }).click();
  await ensureVisible(page.getByText(/Aktif Rol/i), 10000, "Ayarlar paneli açılmadı.");
};

const switchRoleInSettings = async (page, role) => {
  const label = role === "employer" ? /İşverenim/i : /İş Arıyorum/i;
  const button = page.getByRole("button", { name: label }).first();
  await ensureVisible(button, 10000, "Rol seçim butonu bulunamadı.");
  await button.click();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const closing = await isVisible(page.getByText(/Rol güncelleniyor/i));
    if (!closing) break;
    await page.waitForTimeout(300);
  }
  const closeButton = page.getByRole("button", { name: /^Kapat$/i }).last();
  if (await isVisible(closeButton)) {
    await closeButton.click();
  }
  await waitForWelcomeReady(page, { navigate: false });
};

const openEmployerBidPanel = async (page) => {
  await waitForWelcomeReady(page);
  const employerFeedButton = page.getByRole("button", { name: /İşveren Feed'e Git/i });
  const hasEmployerFeedButton = await employerFeedButton.isVisible().catch(() => false);

  if (hasEmployerFeedButton) {
    await employerFeedButton.click();
    await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 30000, "İşveren feed ekranı açılmadı.");
    await page.getByRole("button", { name: /^Yenile$/i }).click();

    const feedCard = page.locator("div", { hasText: loadType }).first();
    await ensureVisible(feedCard, 45000, "İşveren feed kartında hedef ilan görünmedi.");
    await feedCard.getByRole("button", { name: /İlan Detayını Aç/i }).click();
  } else {
    throw new Error("İşveren feed butonu bulunamadı.");
  }

  await ensureVisible(page.getByText(/Gelen Teklifler/i), 25000, "İşveren teklif detayı açılmadı.");
};

const acceptBidOnEmployerPanel = async (page) => {
  const pendingBidRow = page
    .locator("div", { hasText: `${bidPrice} ₺` })
    .filter({ has: page.getByRole("button", { name: /Kabul/i }) })
    .first();
  await ensureVisible(pendingBidRow, 60000, "Beklenen teklif satırı işverene düşmedi.");
  await pendingBidRow.getByRole("button", { name: /Kabul/i }).click({ force: true });

  const waitForDecision = async (deadlineMs) => {
    const decisionDeadline = Date.now() + deadlineMs;
    while (Date.now() < decisionDeadline) {
      const stillPendingVisible = await pendingBidRow.isVisible().catch(() => false);
      if (!stillPendingVisible) return true;
      const rowText = ((await pendingBidRow.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
      const hasAcceptedLabel = /ONAYLANDI|Kabul Edildi|ACCEPTED/i.test(rowText);
      const hasAcceptButton = await pendingBidRow
        .getByRole("button", { name: /Kabul/i })
        .isVisible()
        .catch(() => false);
      if (hasAcceptedLabel || !hasAcceptButton) return true;
      await page.waitForTimeout(350);
    }
    return false;
  };

  const accepted = await waitForDecision(50000);
  if (accepted) return;

  const rowText = ((await pendingBidRow.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
  throw new Error(`Kabul aksiyonu sonrası teklif satırı güncellenmedi. row=${rowText}`);
};

const verifyDriverFeedAccepted = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İş Arıyorum Feed'e Git/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /İş Arıyorum Feed/i }), 30000, "Şoför feed ekranı açılmadı.");
  await page.getByRole("button", { name: /^Yenile$/i }).click();

  const card = page.locator("div", { hasText: loadType }).first();
  await ensureVisible(card, 45000, "Şoför feed kartında hedef ilan görünmedi.");
  await ensureVisible(card.getByText(/Kabul Edildi/i), 45000, "Şoför feed içinde kabul durumu görünmüyor.");

  const text = (await card.textContent()) || "";
  if (!/Yükleme Tarihi/i.test(text)) {
    throw new Error("Şoför feed kartında yükleme tarihi alanı bulunamadı.");
  }
  if (/Yükleme Tarihi\s*Belirsiz/i.test(text)) {
    throw new Error("Şoför feed kartında yükleme tarihi belirsiz görünüyor.");
  }
};

const verifyDriverFeedPending = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İş Arıyorum Feed'e Git/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /İş Arıyorum Feed/i }), 30000, "Şoför feed ekranı açılmadı.");
  await page.getByRole("button", { name: /^Yenile$/i }).click();

  const card = page.locator("div", { hasText: loadType }).first();
  await ensureVisible(card, 45000, "Şoför feed kartında hedef ilan görünmedi.");
  const text = (await card.textContent()) || "";
  if (!/Yanıt Bekleniyor|Kabul Edildi|Reddedildi/i.test(text)) {
    throw new Error("Şoför feed kartında teklif durumu okunamadı.");
  }
};

const verifyEmployerFeedAssignedAndNoTimeout = async (page) => {
  await waitForWelcomeReady(page);
  const employerFeedButton = page.getByRole("button", { name: /İşveren Feed'e Git/i });
  const hasEmployerFeedButton = await employerFeedButton.isVisible().catch(() => false);

  if (!hasEmployerFeedButton) throw new Error("İşveren feed butonu bulunamadı.");
  await employerFeedButton.click();
  await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 30000, "İşveren feed tekrar açılamadı.");

  const refreshButton = page.getByRole("button", { name: /^Yenile$/i });
  const deadline = Date.now() + 60000;
  let lastCardText = "";

  while (Date.now() < deadline) {
    await refreshButton.click();
    const card = page
      .locator("div", {
        hasText: loadType,
        has: page.getByRole("button", { name: /İlan Detayını Aç/i }),
      })
      .first();
    await ensureVisible(card, 20000, "İşveren feed’de hedef ilan bulunamadı (final kontrol).");
    lastCardText = ((await card.textContent()) || "").replace(/\s+/g, " ");
    if (/ASSIGNED|assigned/i.test(lastCardText)) {
      const pageText = (await page.locator("body").textContent()) || "";
      if (/zaman aşımına uğradı/i.test(pageText)) {
        throw new Error("Ekranda zaman aşımı hatası görünüyor.");
      }
      if (/Son Hata/i.test(pageText)) {
        throw new Error("Ekranda Son Hata bloğu görünüyor.");
      }
      return;
    }
    await page.waitForTimeout(1800);
  }

  throw new Error(`İşveren feed’de ilan durumu ASSIGNED değil. card=${lastCardText}`);
};

const runCheckpoint = async (id, title, fn) => {
  const started = Date.now();
  process.stdout.write(`\n[CHECKPOINT ${id}] ${title}\n`);
  try {
    await fn();
    const durationMs = Date.now() - started;
    pushResult({ id, title, status: "PASS", durationMs });
    process.stdout.write(`[PASS] ${id} (${durationMs} ms)\n`);
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    pushResult({ id, title, status: "FAIL", durationMs, message });
    process.stdout.write(`[FAIL] ${id} (${durationMs} ms) -> ${message}\n`);
    throw error;
  }
};

const writeReport = (status, extra = {}) => {
  const endedAt = Date.now();
  const payload = {
    runId,
    baseUrl: BASE_URL,
    status,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: endedAt - startedAt,
    data: {
      load: {
        fromCity,
        toCity,
        loadType,
        loadPrice,
        bidPrice,
      },
      users: {
        employer: { email: employer.email, role: employer.role },
        driver: { email: driver.email, role: driver.role },
      },
      checkpoints: results,
      ...extra,
    },
  };
  const filePath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  process.stdout.write(`\n[REPORT] ${filePath}\n`);
  return filePath;
};

const readRuntimeLogs = async (page) => {
  try {
    const raw = await page.evaluate(() => localStorage.getItem("yukcep_runtime_logs_v1"));
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    const bidLogs = parsed.filter((row) => String(row?.event || "").startsWith("BID_"));
    return {
      latest: parsed.slice(0, 30),
      bidOnly: bidLogs.slice(0, 30),
    };
  } catch {
    return { latest: [], bidOnly: [] };
  }
};

const readLocalDebug = async (page) => {
  try {
    return await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const roleHint = localStorage.getItem("yukcep_profile_role_hint_v1");
      const authKeys = keys.filter((key) => /auth-token|profile_role_hint/i.test(key));
      let authUserId = null;
      const authKey = keys.find((key) => key.includes("-auth-token"));
      if (authKey) {
        try {
          const raw = localStorage.getItem(authKey);
          const parsed = raw ? JSON.parse(raw) : null;
          authUserId =
            parsed?.user?.id ||
            parsed?.currentSession?.user?.id ||
            parsed?.session?.user?.id ||
            (Array.isArray(parsed) ? parsed?.[0]?.user?.id : null) ||
            (Array.isArray(parsed) ? parsed?.[0]?.currentSession?.user?.id : null) ||
            null;
        } catch {
          authUserId = null;
        }
      }
      const body = (document.body?.innerText || "").replace(/\s+/g, " ");
      return {
        roleHint,
        authKeys,
        authUserId,
        roleLoadingVisible: /Profil Rolü Yükleniyor/i.test(body),
      };
    });
  } catch {
    return null;
  }
};

const launch = async () => {
  const edgePathCandidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const edgePath = edgePathCandidates.find((candidate) => fs.existsSync(candidate));
  if (edgePath) {
    return chromium.launch({ headless: true, executablePath: edgePath });
  }
  return chromium.launch({ headless: true });
};

const main = async () => {
  const browser = await launch();
  const employerContext = await browser.newContext({ locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const driverContext = await browser.newContext({ locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const employerPage = await employerContext.newPage();
  const driverPage = await driverContext.newPage();
  const networkProbe = [];

  const watchNetwork = (page, who) => {
    page.on("response", async (res) => {
      const url = res.url();
      if (!/\/rest\/v1\/(bids|notifications|loads|profiles)/i.test(url)) return;
      networkProbe.push({
        at: new Date().toISOString(),
        who,
        kind: "response",
        status: res.status(),
        url,
      });
    });
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (!/\/rest\/v1\/(bids|notifications|loads|profiles)/i.test(url)) return;
      networkProbe.push({
        at: new Date().toISOString(),
        who,
        kind: "requestfailed",
        error: req.failure()?.errorText || "unknown",
        url,
      });
    });
  };

  watchNetwork(employerPage, "employer");
  watchNetwork(driverPage, "driver");

  try {
    await runCheckpoint("E1", "İşveren kayıt + giriş", async () => {
      await authViaSignup(employerPage, employer);
    });

    await runCheckpoint("E2", "İşveren ana sayfada yalnızca kendi role feed aksiyonunu görüyor", async () => {
      await assertHomeButtonsForRole(employerPage, "employer");
    });

    await runCheckpoint("E3", "İşveren rolü ayarlardan driver'a çevrilebiliyor", async () => {
      await openSettingsFromProfile(employerPage, employer.fullName);
      await switchRoleInSettings(employerPage, "driver");
      await assertHomeButtonsForRole(employerPage, "driver");
    });

    await runCheckpoint("E4", "İşveren rolü tekrar employer'a dönebiliyor", async () => {
      await openSettingsFromProfile(employerPage, employer.fullName);
      await switchRoleInSettings(employerPage, "employer");
      await assertHomeButtonsForRole(employerPage, "employer");
    });

    await runCheckpoint("E5", "İşveren ilan formunu feed üzerinden açabiliyor", async () => {
      await postLoadAsEmployer(employerPage);
    });

    await runCheckpoint("E6", "İşveren yeni yük ilanı oluşturabiliyor", async () => {
      const card = employerPage.locator("button", { hasText: loadType }).first();
      await ensureVisible(card, 30000, "Yeni ilan listede doğrulanamadı.");
    });

    await runCheckpoint("E7", "Yayınlanan ilan listede görünüyor", async () => {
      const card = employerPage.locator("button", { hasText: loadType }).first();
      await ensureVisible(card, 30000, "Yeni ilan listede doğrulanamadı.");
    });

    await runCheckpoint("E8", "İşveren feed ekranında ilan kartını görüyor", async () => {
      await ensureEmployerFeedHasLoadCard(employerPage);
    });

    await runCheckpoint("D1", "Şoför kayıt + giriş", async () => {
      await authViaSignup(driverPage, driver);
    });

    await runCheckpoint("D2", "Şoför ana sayfada yalnızca kendi role feed aksiyonunu görüyor", async () => {
      await assertHomeButtonsForRole(driverPage, "driver");
    });

    await runCheckpoint("D3", "Şoför rolü ayarlardan employer'a çevrilebiliyor", async () => {
      await openSettingsFromProfile(driverPage, driver.fullName);
      await switchRoleInSettings(driverPage, "employer");
      await assertHomeButtonsForRole(driverPage, "employer");
    });

    await runCheckpoint("D4", "Şoför rolü tekrar driver'a dönebiliyor", async () => {
      await openSettingsFromProfile(driverPage, driver.fullName);
      await switchRoleInSettings(driverPage, "driver");
      await assertHomeButtonsForRole(driverPage, "driver");
    });

    await runCheckpoint("D5", "Şoför lokasyon ekranını açıp şehir seçebiliyor", async () => {
      await openDriverLocationAndList(driverPage);
    });

    await runCheckpoint("D6", "Şoför hedef yükü listede görebiliyor", async () => {
      const loadCard = driverPage.locator("button", { hasText: loadType }).first();
      await ensureVisible(loadCard, 30000, "Şoför hedef yükü listede göremedi.");
    });

    await runCheckpoint("D7", "Şoför yük detayını açabiliyor", async () => {
      await openDriverTargetLoadDetail(driverPage);
    });

    await runCheckpoint("D8", "Şoför teklif gönderebiliyor", async () => {
      await submitBidAsDriver(driverPage);
    });

    await runCheckpoint("D9", "Şoför feed ekranında teklif kaydını görüyor", async () => {
      await verifyDriverFeedPending(driverPage);
    });

    await runCheckpoint("E9", "İşveren teklif panelinde gelen teklifi görüyor", async () => {
      await openEmployerBidPanel(employerPage);
      const bidRow = employerPage
        .locator("div", { hasText: `${bidPrice} ₺` })
        .filter({ has: employerPage.getByRole("button", { name: /Kabul/i }) })
        .first();
      await ensureVisible(bidRow, 60000, "Beklenen teklif satırı işverene düşmedi.");
    });

    await runCheckpoint("E10", "İşveren teklifi kabul edip ilanı assigned yapabiliyor", async () => {
      await acceptBidOnEmployerPanel(employerPage);
      await verifyEmployerFeedAssignedAndNoTimeout(employerPage);
    });

    await runCheckpoint("D10", "Şoför feed ekranında kabul + yükleme tarihi görüyor", async () => {
      await verifyDriverFeedAccepted(driverPage);
      await ensureNoFatalUiError(driverPage);
    });

    await runCheckpoint("E11", "İşveren ekranında fatal hata görünmüyor", async () => {
      await ensureNoFatalUiError(employerPage);
    });

    const report = writeReport("PASS");
    process.stdout.write(`\nE2E PASS (${runId})\n`);
    process.stdout.write(`Report: ${report}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const employerShot = path.join(outputDir, `${runId}-employer-fail.png`);
    const driverShot = path.join(outputDir, `${runId}-driver-fail.png`);
    await employerPage.waitForTimeout(1200).catch(() => {});
    const employerLogs = await readRuntimeLogs(employerPage);
    const driverLogs = await readRuntimeLogs(driverPage);
    const employerLocalDebug = await readLocalDebug(employerPage);
    const driverLocalDebug = await readLocalDebug(driverPage);
    await employerPage.screenshot({ path: employerShot, fullPage: true }).catch(() => {});
    await driverPage.screenshot({ path: driverShot, fullPage: true }).catch(() => {});
    const report = writeReport("FAIL", {
      error: message,
      runtimeLogs: {
        employer: employerLogs,
        driver: driverLogs,
      },
      localDebug: {
        employer: employerLocalDebug,
        driver: driverLocalDebug,
      },
      networkProbe: networkProbe.slice(-120),
      screenshots: {
        employer: employerShot,
        driver: driverShot,
      },
    });
    process.stderr.write(`\nE2E FAIL (${runId}) -> ${message}\n`);
    process.stderr.write(`Report: ${report}\n`);
    process.exitCode = 1;
  } finally {
    await employerContext.close().catch(() => {});
    await driverContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }
};

main();
