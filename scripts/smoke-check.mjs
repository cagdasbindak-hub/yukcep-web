import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.YUKCEP_BASE_URL || "https://yukcep.vercel.app/";
const timeoutMs = Number(process.env.YUKCEP_SMOKE_TIMEOUT_MS || "30000");

const run = async () => {
  const outDir = path.join(process.cwd(), "tmp", "smoke");
  fs.mkdirSync(outDir, { recursive: true });
  const now = Date.now();
  const reportFile = path.join(outDir, `smoke-${now}.json`);
  const screenshotFile = path.join(outDir, `smoke-${now}.png`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 430, height: 900 },
  });

  const result = {
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok: false,
    steps: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    result.steps.push({ step: "goto", ok: true });

    await page.waitForSelector("text=YükCep", { timeout: timeoutMs });
    result.steps.push({ step: "brand-visible", ok: true });

    const primaryChecks = await Promise.all([
      page.getByRole("button", { name: /^İŞ ARIYORUM$/i }).isVisible().catch(() => false),
      page.getByRole("button", { name: /^İŞVERENİM$/i }).isVisible().catch(() => false),
      page.getByRole("button", { name: /Giriş Yap/i }).isVisible().catch(() => false),
      page.getByRole("button", { name: /Benim Yapacak İşlerim|Feed/i }).isVisible().catch(() => false),
    ]);
    const primaryVisible = primaryChecks.some(Boolean);

    if (!primaryVisible) {
      throw new Error("Primary action buttons are not visible.");
    }
    result.steps.push({ step: "primary-action-visible", ok: true });

    await page.screenshot({ path: screenshotFile, fullPage: true });
    result.steps.push({ step: "screenshot", ok: true, path: screenshotFile });
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(reportFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(JSON.stringify({ ok: result.ok, reportFile, screenshotFile }));
  if (!result.ok) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
