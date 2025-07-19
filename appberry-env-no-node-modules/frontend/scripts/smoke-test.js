/**
 * Will exit with a non-zero exit code if any of the following errors are detected:
 * - TypeScript errors
 * - Console errors (from localhost)
 * - Page errors
 * - Error boundary found
 */

import { execSync } from "child_process";

import { chromium } from "playwright";
import process from "process";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tails the dev server logs, since there might be relevant info that's useful
 * for debugging/understanding the errors.
 */
function tailDevServerLogs() {
  console.log("========== Tailing backend dev server logs. ==========");
  execSync("tail -n 100 ../backend/backend.log", { stdio: "inherit" });
  console.log("========== Tailing frontend dev server logs. ==========");
  execSync("tail -n 100 frontend.log", { stdio: "inherit" });
}

/**
 * Detects TypeScript errors.
 */
function checkTypeScript() {
  try {
    execSync("pnpm run tsc", { stdio: "inherit" });
  } catch (error) {
    throw new Error("TypeScript build failed.");
  }
}

function runBackendAndFrontend() {
  execSync("cd ../backend && pnpm install", { stdio: "inherit" });
  execSync("cd ../backend && pnpm run dev", { stdio: "inherit" });
  execSync("pnpm install", { stdio: "inherit" });
  execSync("pnpm run dev", { stdio: "inherit" });
}

/**
 * Loads the page and captures console and page errors.
 */
async function loadPageAndDetectErrors(browser) {
  const page = await browser.newPage();

  const consoleErrorMessages = [];
  const pageErrorMessages = [];

  // Note: this should capture any API errors that occur while loading the page,
  // e.g. if an API endpoint returns a 500 error.
  page.on("console", (msg) => {
    const location = msg.location();
    if (!location.url || !location.url.startsWith("http://localhost:")) {
      // Ignore messages from other locations.
      return;
    }

    if (msg.type() === "error") {
      consoleErrorMessages.push(msg);
    }
  });

  page.on("pageerror", (error) => {
    pageErrorMessages.push(error);
  });

  // Sleep for 5 seconds to ensure the app is running
  await sleep(5000);
  await page.goto("http://localhost:5173/");
  await page.reload({ waitUntil: "load", force: true });
  // Sleep for 5 seconds to ensure the page is loaded
  await sleep(5000);

  if (consoleErrorMessages.length > 0) {
    console.error("Console error messages:");
    for (const msg of consoleErrorMessages) {
      console.error(`Message: ${msg.text()}\nLocation: ${msg.location().url}`);
    }
    throw new Error("Console error messages detected.");
  }

  if (pageErrorMessages.length > 0) {
    console.error("Page error messages:");
    for (const msg of pageErrorMessages) {
      console.error(msg);
    }
    throw new Error("Page error messages detected.");
  }

  return page;
}

/**
 * Detects rendering errors. These should also be detected by loadPageAndDetectErrors,
 * but do this just in case.
 */
async function checkForErrorBoundary(page) {
  // Keep in sync with project/appberry-env/frontend/src/error-boundary.tsx
  const errorBoundary = await page.$("#top-level-error-boundary");
  if (errorBoundary != null) {
    throw new Error("Error boundary found, meaning the page failed to render.");
  }
}

async function smokeTest() {
  console.log("========== Running smoke test... ==========");
  let browser;

  try {
    console.log("========== Checking TypeScript. ==========");
    checkTypeScript();

    console.log("========== Clearing dev server logs. ==========");
    execSync("rm -f ../backend/backend.log frontend.log", { stdio: "inherit" });

    console.log("========== Running backend and frontend. ==========");
    runBackendAndFrontend();

    console.log("========== Loading page and detecting errors. ==========");
    browser = await chromium.launch();

    const page = await loadPageAndDetectErrors(browser);

    console.log("========== Checking for error boundary. ==========");
    await checkForErrorBoundary(page);
  } catch (error) {
    tailDevServerLogs();
    if (browser) {
      await browser.close();
    }
    console.log("========== Logging error and exiting. ==========");
    console.error(error);
    process.exit(1);
  }

  tailDevServerLogs();
  await browser.close();
}

smokeTest();
