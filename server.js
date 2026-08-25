const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_DIR = path.join(__dirname, "output");

// Helper to format file size
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper to safely resolve path inside base directory
function isSubDir(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// Helper to scan directory files recursively or flat
function getFilesInfo(dirPath, category) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath);
  return files
    .filter((f) => f.endsWith(".html") || f.endsWith(".json"))
    .map((filename) => {
      const fullPath = path.join(dirPath, filename);
      const stat = fs.statSync(fullPath);
      return {
        category,
        filename,
        relativePath: path.relative(__dirname, fullPath).replace(/\\/g, "/"),
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        mtime: stat.mtime
      };
    });
}

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for local API usage
  res.setHeader("Access-Control-Allow-Origin", "*");

  // --------------------------------------------------
  // API ENDPOINTS
  // --------------------------------------------------

  // API Summary
  if (pathname === "/api/cache/summary") {
    const catalogueDir = path.join(CACHE_DIR, "catalogue");
    const booksDir = path.join(CACHE_DIR, "books");
    const booksJsonFile = path.join(OUTPUT_DIR, "books.json");

    const catalogueFiles = getFilesInfo(catalogueDir, "catalogue");
    const bookFiles = getFilesInfo(booksDir, "books");

    const totalCatalogueSize = catalogueFiles.reduce((acc, f) => acc + f.size, 0);
    const totalBooksSize = bookFiles.reduce((acc, f) => acc + f.size, 0);

    let parsedBooksCount = 0;
    if (fs.existsSync(booksJsonFile)) {
      try {
        const raw = fs.readFileSync(booksJsonFile, "utf8");
        const parsed = JSON.parse(raw);
        parsedBooksCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        parsedBooksCount = 0;
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        catalogueCount: catalogueFiles.length,
        catalogueTotalSizeFormatted: formatBytes(totalCatalogueSize),
        bookCacheCount: bookFiles.length,
        bookCacheTotalSizeFormatted: formatBytes(totalBooksSize),
        totalCacheFiles: catalogueFiles.length + bookFiles.length,
        totalCacheSizeFormatted: formatBytes(totalCatalogueSize + totalBooksSize),
        parsedBooksCount
      })
    );
  }

  // API File List
  if (pathname === "/api/cache/list") {
    const catalogueDir = path.join(CACHE_DIR, "catalogue");
    const booksDir = path.join(CACHE_DIR, "books");

    const catalogueFiles = getFilesInfo(catalogueDir, "catalogue");
    const bookFiles = getFilesInfo(booksDir, "books");

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        catalogue: catalogueFiles,
        books: bookFiles
      })
    );
  }

  // API Raw File Content
  if (pathname === "/api/cache/content") {
    const relPath = parsedUrl.query.file;
    if (!relPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing file parameter" }));
    }

    const fullPath = path.normalize(path.join(__dirname, relPath));
    if (!isSubDir(__dirname, fullPath) || (!fullPath.startsWith(CACHE_DIR) && !fullPath.startsWith(OUTPUT_DIR))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Access denied" }));
    }

    if (!fs.existsSync(fullPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "File not found" }));
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
    return res.end(content);
  }

  // API Scraped Books JSON
  if (pathname === "/api/books") {
    const booksJsonFile = path.join(OUTPUT_DIR, "books.json");
    if (!fs.existsSync(booksJsonFile)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "books.json not found" }));
    }

    const content = fs.readFileSync(booksJsonFile, "utf8");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(content);
  }

  // --------------------------------------------------
  // RAW CACHE & STATIC FILE SERVING
  // --------------------------------------------------

  // Direct raw file access under /cache or /output
  if (pathname.startsWith("/cache/") || pathname.startsWith("/output/")) {
    const safePath = path.normalize(path.join(__dirname, pathname));
    if (isSubDir(__dirname, safePath) && fs.existsSync(safePath) && !fs.statSync(safePath).isDirectory()) {
      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/html" });
      return fs.createReadStream(safePath).pipe(res);
    }
  }

  // Static assets from public/
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!isSubDir(PUBLIC_DIR, filePath) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/html" });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Default 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Cache Viewer Frontend is running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
