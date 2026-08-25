const fs = require("fs");
const path = require("path");

const URL = "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

async function fetchPage() {
  // Use cached HTML if it already exists
  if (fs.existsSync(CACHE_FILE)) {
    const html = fs.readFileSync(CACHE_FILE, "utf8");

    console.log("CACHE HIT");
    console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);

    return html;
  }

  console.log("FETCH");

  const controller = new AbortController();

  // Give the request 5 seconds before timing out
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(URL, {
      headers: {
        "User-Agent": "FlyRankInternship-A9/1.0 (+https://github.com/your-github-username/your-repo)"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    // Only HTTP 200 is accepted
    if (response.status !== 200) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, html);

    console.log(`Status: ${response.status}`);
    console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);
    console.log(`Cached at: ${CACHE_FILE}`);

    return html;
  } catch (error) {
    clearTimeout(timeout);

    console.error("FETCH ERROR:", error.message);
    process.exitCode = 1;
  }
}

fetchPage();