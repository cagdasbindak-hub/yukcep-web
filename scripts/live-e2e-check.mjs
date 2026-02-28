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

const waitForWelcomeReady = async (page) => {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await ensureVisible(
    page.getByRole("button", { name: /İŞ ARIYORUM/i }),
    45000,
    "Ana ekran yüklenmedi."
  );
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
    await page.getByRole("button", { name: /İşveren/i }).click();
  } else {
    await page.getByRole("button", { name: /Şoför/i }).click();
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

    const welcomeReady = await page
      .getByRole("button", { name: /İŞ ARIYORUM/i })
      .isVisible()
      .catch(() => false);
    if (welcomeReady) return;

    await page.waitForTimeout(400);
  }

  throw new Error("Signup sonrası welcome ekranına dönülemedi.");
};

const postLoadAsEmployer = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İŞVERENİM/i }).click();
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

const openLoadAsDriver = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İŞ ARIYORUM/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /Neredesiniz/i }), 25000, "Lokasyon ekranı açılmadı.");

  await page.getByPlaceholder(/Sehir ara/i).fill(fromCity);
  await page.getByRole("button", { name: new RegExp(`^${fromCity}$`, "i") }).click();

  await ensureVisible(page.getByText(/Yükler/i).first(), 30000, "Yük listesi ekranı açılmadı.");
  const loadCard = page.locator("button", { hasText: loadType }).first();
  await ensureVisible(loadCard, 45000, "Şoför tarafında hedef ilan listede görünmedi.");
  await loadCard.click();

  await ensureVisible(page.getByText(/Teklif Ver/i), 25000, "Yük detayında teklif alanı açılmadı.");
};

const submitBidAsDriver = async (page) => {
  await page.getByPlaceholder(/Teklifiniz/i).fill(bidPrice);
  await page.getByRole("button", { name: /Teklif Gönder/i }).click();
  await ensureVisible(page.getByText(/Teklifiniz İletildi/i), 45000, "Teklif gönderimi tamamlanmadı.");
};

const openEmployerFeedAndAcceptBid = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İşveren Feed'e Git/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 30000, "İşveren feed ekranı açılmadı.");
  await page.getByRole("button", { name: /^Yenile$/i }).click();

  const feedCard = page.locator("div", { hasText: loadType }).first();
  await ensureVisible(feedCard, 45000, "İşveren feed kartında hedef ilan görünmedi.");
  await feedCard.getByRole("button", { name: /İlan Detayını Aç/i }).click();

  await ensureVisible(page.getByText(/Gelen Teklifler/i), 25000, "İşveren teklif detayı açılmadı.");
  const bidRow = page
    .locator("div", { hasText: `${bidPrice} ₺` })
    .filter({ has: page.getByRole("button", { name: /Kabul/i }) })
    .first();
  await ensureVisible(bidRow, 60000, "Beklenen teklif satırı işverene düşmedi.");
  await bidRow.getByRole("button", { name: /Kabul/i }).click();
  await ensureVisible(page.getByText(/ONAYLANDI/i), 30000, "Teklif kabul edildikten sonra durum güncellenmedi.");
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

const verifyEmployerFeedAssignedAndNoTimeout = async (page) => {
  await waitForWelcomeReady(page);
  await page.getByRole("button", { name: /İşveren Feed'e Git/i }).click();
  await ensureVisible(page.getByRole("heading", { name: /İşveren Feed/i }), 30000, "İşveren feed tekrar açılamadı.");
  await page.getByRole("button", { name: /^Yenile$/i }).click();

  const card = page.locator("div", { hasText: loadType }).first();
  await ensureVisible(card, 45000, "İşveren feed’de hedef ilan bulunamadı (final kontrol).");
  await ensureVisible(card.getByText(/ASSIGNED/i), 45000, "İşveren feed’de ilan durumu ASSIGNED değil.");

  const pageText = (await page.locator("body").textContent()) || "";
  if (/zaman aşımına uğradı/i.test(pageText)) {
    throw new Error("Ekranda zaman aşımı hatası görünüyor.");
  }
  if (/Son Hata/i.test(pageText)) {
    throw new Error("Ekranda Son Hata bloğu görünüyor.");
  }
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
    await runCheckpoint("S1", "İşveren kullanıcı kaydı ve oturum açma", async () => {
      await authViaSignup(employerPage, employer);
    });

    await runCheckpoint("S2", "İşveren yeni yük ilanı oluşturabiliyor", async () => {
      await postLoadAsEmployer(employerPage);
    });

    await runCheckpoint("S3", "Yayınlanan ilan pazaryeri listesinde görünüyor", async () => {
      const card = employerPage.locator("button", { hasText: loadType }).first();
      await ensureVisible(card, 30000, "Yeni ilan listede doğrulanamadı.");
    });

    await runCheckpoint("S4", "Şoför kullanıcı kaydı ve oturum açma", async () => {
      await authViaSignup(driverPage, driver);
    });

    await runCheckpoint("S5", "Şoför ilanı bulup detayını açabiliyor", async () => {
      await openLoadAsDriver(driverPage);
    });

    await runCheckpoint("S6", "Şoför teklif gönderebiliyor", async () => {
      await submitBidAsDriver(driverPage);
    });

    await runCheckpoint("S7", "İşveren kendi feed/detay ekranında teklifi görüyor", async () => {
      await openEmployerFeedAndAcceptBid(employerPage);
    });

    await runCheckpoint("S8", "İşveren teklifi kabul ettiğinde durum güncelleniyor", async () => {
      await ensureVisible(employerPage.getByText(/ONAYLANDI/i), 20000, "Kabul edilen teklif durumu görünmedi.");
    });

    await runCheckpoint("S9", "Şoför feed ekranında kabul + yükleme tarihi görünüyor", async () => {
      await verifyDriverFeedAccepted(driverPage);
    });

    await runCheckpoint("S10", "İşveren feed assigned durumu ve hata temizliği doğrulandı", async () => {
      await verifyEmployerFeedAssignedAndNoTimeout(employerPage);
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
    await employerPage.screenshot({ path: employerShot, fullPage: true }).catch(() => {});
    await driverPage.screenshot({ path: driverShot, fullPage: true }).catch(() => {});
    const report = writeReport("FAIL", {
      error: message,
      runtimeLogs: {
        employer: employerLogs,
        driver: driverLogs,
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
