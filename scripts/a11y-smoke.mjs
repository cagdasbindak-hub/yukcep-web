import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.YUKCEP_BASE_URL || "https://yukcep.vercel.app/";
const timeoutMs = Number(process.env.YUKCEP_A11Y_TIMEOUT_MS || "30000");

const run = async () => {
  const outDir = path.join(process.cwd(), "tmp", "a11y");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `a11y-${Date.now()}.json`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

  const result = {
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    issues: [],
    checks: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    result.checks.push({ name: "goto", ok: true });

    const docLang = await page.locator("html").getAttribute("lang");
    if (!docLang) {
      result.issues.push("`<html lang>` missing.");
    }
    result.checks.push({ name: "html-lang", ok: Boolean(docLang), value: docLang || null });

    const unnamedButtons = await page.$$eval("button", (nodes) =>
      nodes
        .filter((node) => {
          const text = (node.textContent || "").trim();
          const ariaLabel = node.getAttribute("aria-label");
          return !text && !ariaLabel;
        })
        .map((node) => node.outerHTML.slice(0, 120))
    );
    if (unnamedButtons.length) {
      result.issues.push(`Buttons without accessible name: ${unnamedButtons.length}`);
    }
    result.checks.push({ name: "button-name", ok: unnamedButtons.length === 0, count: unnamedButtons.length });

    const unlabeledInputs = await page.$$eval("input, select, textarea", (nodes) =>
      nodes
        .filter((node) => {
          const id = node.getAttribute("id");
          const hasLabelByFor = id ? Boolean(document.querySelector(`label[for='${id}']`)) : false;
          const hasAria = Boolean(node.getAttribute("aria-label") || node.getAttribute("aria-labelledby"));
          const hasPlaceholder = Boolean(node.getAttribute("placeholder"));
          return !hasLabelByFor && !hasAria && !hasPlaceholder;
        })
        .map((node) => node.outerHTML.slice(0, 120))
    );
    if (unlabeledInputs.length) {
      result.issues.push(`Inputs without label/aria/placeholder: ${unlabeledInputs.length}`);
    }
    result.checks.push({ name: "input-label", ok: unlabeledInputs.length === 0, count: unlabeledInputs.length });
  } finally {
    await browser.close();
  }

  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(JSON.stringify({ ok: result.issues.length === 0, reportPath, issueCount: result.issues.length }));
  if (result.issues.length > 0) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
