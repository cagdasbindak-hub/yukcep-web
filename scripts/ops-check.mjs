import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.YUKCEP_BASE_URL || "https://yukcep.vercel.app/";
const timeoutMs = Number(process.env.YUKCEP_OPS_TIMEOUT_MS || "45000");

const now = Date.now();
const outDir = path.join(process.cwd(), "tmp", "ops");
const reportFile = path.join(outDir, `ops-check-${now}.json`);

const extractMatchingLines = (text, pattern) => {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => pattern.test(line));
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 2200 } });

  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok: false,
    steps: [],
    findings: {
      feedback: {},
      logs: {},
    },
    backlog: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(2000);
    report.steps.push({ step: "goto", ok: true });

    const brandVisible = await page.locator("text=YükCep").first().isVisible().catch(() => false);
    if (!brandVisible) {
      throw new Error("Brand is not visible on homepage");
    }
    report.steps.push({ step: "brand-visible", ok: true });

    const feedbackPanel = page.locator("div", { has: page.locator("text=Feedback Panosu") }).first();
    const feedbackHeadingVisible = await feedbackPanel.isVisible().catch(() => false);
    const feedbackStatusVisible = await feedbackPanel
      .locator("text=Feedback panosu hazırlanıyor. Geçici kayıtlar gösterilecek.")
      .first()
      .isVisible()
      .catch(() => false);
    const feedbackTechErrorVisible = await feedbackPanel
      .locator("text=Failed to fetch feedback items")
      .first()
      .isVisible()
      .catch(() => false);
    const feedbackEmptyVisible = await feedbackPanel
      .locator("text=Henüz feedback yok.")
      .first()
      .isVisible()
      .catch(() => false);
    const feedbackRows = await feedbackPanel
      .locator("div.max-h-52.overflow-y-auto.pr-1.space-y-2 > div")
      .allTextContents()
      .catch(() => []);

    const syntheticFeedbackPattern = /(db verify feedback|e2e|smoke|test|deneme)/i;
    const feedbackActionableRows = feedbackRows.filter((row) => {
      const line = String(row || "");
      return /Yapacağım/i.test(line) && !/Kötü Fikir/i.test(line) && !syntheticFeedbackPattern.test(line);
    });

    report.findings.feedback = {
      headingVisible: feedbackHeadingVisible,
      fallbackInfoVisible: feedbackStatusVisible,
      technicalErrorVisible: feedbackTechErrorVisible,
      emptyVisible: feedbackEmptyVisible,
      rowCount: feedbackRows.length,
      actionableCount: feedbackActionableRows.length,
      preview: feedbackRows.slice(0, 5),
      actionablePreview: feedbackActionableRows.slice(0, 5),
    };

    const logToggle = page.getByRole("button", { name: /Goster|Göster/i }).first();
    if (await logToggle.isVisible().catch(() => false)) {
      await logToggle.click().catch(() => {});
      await page.waitForTimeout(1000);
      report.steps.push({ step: "logs-toggle", ok: true });
    }

    const bodyText = await page.locator("body").innerText();
    const leveledLogLines = extractMatchingLines(bodyText, /^(INFO|WARN|ERROR)\s*·/i);
    const errorLines = leveledLogLines.filter((line) => /^ERROR\s*·/i.test(line));
    const warnLines = leveledLogLines.filter((line) => /^WARN\s*·/i.test(line));

    report.findings.logs = {
      errorLineCount: errorLines.length,
      warnLineCount: warnLines.length,
      errorPreview: errorLines.slice(0, 10),
      warnPreview: warnLines.slice(0, 10),
    };

    if (feedbackTechErrorVisible) {
      report.backlog.push({
        priority: "high",
        code: "FEEDBACK_TECH_ERROR",
        action: "Hide technical feedback fetch error in UI and keep fallback path user-friendly.",
      });
    }

    if (feedbackStatusVisible) {
      report.backlog.push({
        priority: "high",
        code: "DB_MIGRATION_FEEDBACK_ITEMS",
        action: "Apply schema.sql in Supabase SQL editor to create public.feedback_items and related policies.",
      });
    }

    if (feedbackActionableRows.length > 0) {
      report.backlog.push({
        priority: "medium",
        code: "FEEDBACK_ACTIONABLE",
        action: "Review actionable feedback rows and convert them into fixes/todo items before finalizing the next deploy.",
      });
    }

    if (errorLines.some((line) => /POST_LOAD_FAILED/i.test(line)) || warnLines.some((line) => /zaman aşım|timeout/i.test(line))) {
      report.backlog.push({
        priority: "medium",
        code: "POST_LOAD_TIMEOUT",
        action: "Review post-load timeout path and increase resilience for slow session/profile checks.",
      });
    }

    if (
      errorLines.some((line) => /PUBLIC_STATS_SUPABASE_FAIL|LOADS_SUPABASE_FAIL/i.test(line)) ||
      warnLines.some((line) => /PUBLIC_STATS_SUPABASE_FAIL|LOADS_SUPABASE_FAIL/i.test(line))
    ) {
      report.backlog.push({
        priority: "medium",
        code: "SUPABASE_TIMEOUTS",
        action: "Investigate Supabase query latency and keep REST fallback counters in sync.",
      });
    }

    report.ok = true;
  } catch (error) {
    report.error = String(error?.message || error);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify({ ok: report.ok, reportFile, backlogCount: report.backlog.length }));
  if (!report.ok) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
