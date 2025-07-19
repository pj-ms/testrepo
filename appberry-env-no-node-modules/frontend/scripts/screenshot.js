import fs from "fs";
import { dirname } from "path";
import { chromium } from "playwright";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRONTEND_LOG_FILE_PATH = `${__dirname}/../frontend.log`;
const BACKEND_LOG_FILE_PATH = `${__dirname}/../../backend/backend.log`;

function clearLogs() {
  try {
    fs.writeFileSync(FRONTEND_LOG_FILE_PATH, "");
    fs.writeFileSync(BACKEND_LOG_FILE_PATH, "");
  } catch {
    // Swallow
  }
}

function readLogs(label) {
  const logFiles = [
    { path: FRONTEND_LOG_FILE_PATH, name: "frontend.log" },
    { path: BACKEND_LOG_FILE_PATH, name: "backend.log" },
  ];

  console.log(label);
  let didLog = false;

  logFiles.forEach((logFile) => {
    if (fs.existsSync(logFile.path)) {
      const logContent = fs.readFileSync(logFile.path, "utf-8");
      const logLines = logContent.split("\n");
      logLines.forEach((line) => {
        if (line.trim()) {
          didLog = true;
          console.log(`[${logFile.name}] ${line}`);
        }
      });
    }
  });

  if (!didLog) {
    console.log("No logs found");
  }
}

function getParams(args) {
  const allowedKeys = new Set(['saveToFile', 'outputPath', 'width', 'height', 'url']);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const arg = args[i].slice(2);

      // Support --key=value format
      if (arg.includes('=')) {
        const [key, value] = arg.split('=');
        if (!allowedKeys.has(key)) {
          throw new Error(`Unknown parameter: --${key}`);
        }

        params[key] = value;
      } else {
        const key = arg;
        if (!allowedKeys.has(key)) {
          throw new Error(`Unknown parameter: --${key}`);
        }

        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
        params[key] = value;
      }
    }
  }

  return params;
}

// Outputs a screenshot of http://localhost:5173/ as a base64 string or saves it to a file if --saveToFile flag is present
// The --saveToFile flag should only be used by real humans, not by our models.
//
// Also captures console messages and uncaught errors and logs them to the console.
//
// Also outputs the contents of frontend.log and backend.log to the console, in case there is any pertinent information in them.
(async () => {
  const args = process.argv.slice(2); // Skip node path and script path

  let params = {};
  try {
    params = getParams(args);
  } catch (e) {
    console.error("Error parsing parameters:", e.message);
    return;
  }

  readLogs("===== Frontend and backend logs before loading the page =====");
  clearLogs();

  const saveToFile = params.saveToFile || false;
  const outputPath = params.outputPath || 'screenshot.png';
  const width = parseInt(params.width, 10) || 1280;
  const height = parseInt(params.height, 10) || 720;
  const url = params.url || "http://localhost:5173/";

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Capture console messages
  page.on("console", (msg) => {
    console.log(`[Console] ${msg.type()}: ${msg.text()}`);
  });

  // Capture uncaught errors
  page.on("pageerror", (error) => {
    console.error(`[Page Error] ${error.message}`);
  });

  console.log("===== Loading the page, capturing console messages and uncaught errors =====");
  await page.goto(url);
  await page.reload({ waitUntil: "load", force: true });

  // Sleep for 2 seconds to ensure the page is loaded
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const screenshotBuffer = await page.screenshot();

  // Sleep for 2 seconds before reading logs
  await new Promise((resolve) => setTimeout(resolve, 2000));
  readLogs("===== Frontend and backend logs after loading the page =====");

  await browser.close();

  if (saveToFile) {
    fs.writeFileSync(outputPath, screenshotBuffer);
    console.log("Screenshot saved to " + outputPath);
  } else {
    const screenshotBase64 = screenshotBuffer.toString("base64");
    const screenshotObject = { screenshot: screenshotBase64 };
    console.log(JSON.stringify(screenshotObject));
  }
})();
