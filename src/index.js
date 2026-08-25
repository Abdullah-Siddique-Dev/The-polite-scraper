const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { z } = require("zod");

// --------------------------------------------------
// BOOK VALIDATION SCHEMA
// --------------------------------------------------

const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_gbp: z.number().nonnegative(),
  availability: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  description: z.string().min(1),
  source_page: z.string().url(),
  fetched_at: z.string().datetime()
});

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const BASE_URL =
  "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(
  __dirname,
  "..",
  "cache"
);

const CATALOGUE_CACHE_DIR = path.join(
  CACHE_DIR,
  "catalogue"
);

const BOOK_CACHE_DIR = path.join(
  CACHE_DIR,
  "books"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "output"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  "books.json"
);

// --------------------------------------------------
// DELAY FUNCTION
// --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// --------------------------------------------------
// FETCH PAGE WITH CACHE
// --------------------------------------------------

async function fetchPage(url, cacheFile) {
  // If cached file exists, use it.
  if (fs.existsSync(cacheFile)) {
    const html = fs.readFileSync(
      cacheFile,
      "utf8"
    );

    console.log(`CACHE HIT: ${url}`);

    return html;
  }

  console.log(`FETCH: ${url}`);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FlyRankInternship-A9/1.0"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.status !== 200) {
      throw new Error(
        `Fetch failed with status ${response.status}`
      );
    }

    const html = await response.text();

    // Make sure cache directory exists.
    fs.mkdirSync(
      path.dirname(cacheFile),
      {
        recursive: true
      }
    );

    // Save HTML in cache.
    fs.writeFileSync(
      cacheFile,
      html
    );

    console.log(`Status: ${response.status}`);
    console.log(
      `Response size: ${html.length} bytes`
    );
    console.log(
      `Cached at: ${cacheFile}`
    );

    return html;

  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// --------------------------------------------------
// EXTRACT BOOK LINKS
// --------------------------------------------------

function extractBookLinks(
  html,
  pageUrl
) {
  const $ = cheerio.load(html);

  const urls = [];

  $("article.product_pod h3 a").each(
    (index, element) => {
      const href = $(element).attr("href");

      if (href) {
        const absoluteUrl = new URL(
          href,
          pageUrl
        ).href;

        urls.push(absoluteUrl);
      }
    }
  );

  return urls;
}

// --------------------------------------------------
// FIND NEXT CATALOGUE PAGE
// --------------------------------------------------

function findNextPage(
  html,
  pageUrl
) {
  const $ = cheerio.load(html);

  const nextHref = $("li.next a").attr("href");

  if (!nextHref) {
    return null;
  }

  return new URL(
    nextHref,
    pageUrl
  ).href;
}

// --------------------------------------------------
// EXTRACT RAW BOOK DATA
// --------------------------------------------------

function extractBookData(
  html,
  productUrl,
  sourcePage
) {
  const $ = cheerio.load(html);

  const title = $(
    "div.product_main h1"
  )
    .text()
    .trim();

  const priceText = $(
    "p.price_color"
  )
    .first()
    .text()
    .trim();

  const availabilityText = $(
    "p.instock.availability"
  )
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const ratingText =
    $("p.star-rating").attr("class") || "";

  const description = $(
    "#product_description"
  )
    .next("p")
    .text()
    .trim();

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString()
  };
}

// --------------------------------------------------
// NORMALIZE RAW BOOK DATA
// --------------------------------------------------

function normalizeBookData(rawBook) {
  // Convert "£51.77" into 51.77
  const priceMatch =
    rawBook.price_text.match(/[\d.]+/);

  const price_gbp = priceMatch
    ? Number(priceMatch[0])
    : NaN;

  // Convert rating word into number.
  const ratingWords = {
    One: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5
  };

  const ratingWord =
    Object.keys(ratingWords).find(
      (word) =>
        rawBook.rating_text.includes(word)
    );

  const rating = ratingWord
    ? ratingWords[ratingWord]
    : NaN;

  // Convert:
  // "In stock (22 available)"
  // into:
  // "In stock"
  const availability =
    rawBook.availability_text
      .replace(
        /\(\d+ available\)/i,
        ""
      )
      .trim();

  return {
    title: rawBook.title,

    product_url:
      rawBook.product_url,

    price_gbp,

    availability,

    rating,

    description:
      rawBook.description,

    source_page:
      rawBook.source_page,

    fetched_at:
      rawBook.fetched_at
  };
}

// --------------------------------------------------
// BOOK CACHE FILE
// --------------------------------------------------

function getBookCacheFile(index) {
  return path.join(
    BOOK_CACHE_DIR,
    `book-${index + 1}.html`
  );
}

// --------------------------------------------------
// MAIN SCRAPER
// --------------------------------------------------

async function main() {

  // ------------------------------------------------
  // CREATE REQUIRED DIRECTORIES
  // ------------------------------------------------

  fs.mkdirSync(
    CATALOGUE_CACHE_DIR,
    {
      recursive: true
    }
  );

  fs.mkdirSync(
    BOOK_CACHE_DIR,
    {
      recursive: true
    }
  );

  // ==================================================
  // PART 1
  // DISCOVER BOOK URLS
  // ==================================================

  const allBookUrls = [];

  let currentPageUrl = BASE_URL;

  let pageNumber = 1;

  while (
    currentPageUrl &&
    pageNumber <= 3
  ) {

    const catalogueCacheFile =
      path.join(
        CATALOGUE_CACHE_DIR,
        `catalogue-page-${pageNumber}.html`
      );

    const html =
      await fetchPage(
        currentPageUrl,
        catalogueCacheFile
      );

    const bookUrls =
      extractBookLinks(
        html,
        currentPageUrl
      );

    console.log(
      `Page ${pageNumber}: discovered ${bookUrls.length} book URLs`
    );

    allBookUrls.push(
      ...bookUrls.map((url) => ({
        url,
        sourcePage:
          currentPageUrl
      }))
    );

    if (pageNumber === 3) {
      break;
    }

    currentPageUrl =
      findNextPage(
        html,
        currentPageUrl
      );

    pageNumber++;
  }

  // --------------------------------------------------
  // REMOVE DUPLICATES
  // --------------------------------------------------

  const uniqueBooks = [
    ...new Map(
      allBookUrls.map(
        (book) => [
          book.url,
          book
        ]
      )
    ).values()
  ];

  console.log(
    `\nFound ${uniqueBooks.length} unique book URLs\n`
  );

  // ==================================================
  // PART 2
  // FETCH + EXTRACT + NORMALIZE + VALIDATE
  // ==================================================

  const books = [];

  for (
    let i = 0;
    i < uniqueBooks.length;
    i++
  ) {

    const book =
      uniqueBooks[i];

    console.log(
      `Processing ${i + 1}/${uniqueBooks.length}: ${book.url}`
    );

    const cacheFile =
      getBookCacheFile(i);

    // Wait only if we need a real network request.
    if (!fs.existsSync(cacheFile)) {
      await sleep(500);
    }

    try {

      // ----------------------------------------------
      // STEP 1: GET HTML
      // ----------------------------------------------

      const html =
        await fetchPage(
          book.url,
          cacheFile
        );

      // ----------------------------------------------
      // STEP 2: EXTRACT RAW DATA
      // ----------------------------------------------

      const rawBook =
        extractBookData(
          html,
          book.url,
          book.sourcePage
        );

      // ----------------------------------------------
      // STEP 3: NORMALIZE DATA
      // ----------------------------------------------

      const normalizedBook =
        normalizeBookData(
          rawBook
        );

      // ----------------------------------------------
      // STEP 4: VALIDATE WITH ZOD
      // ----------------------------------------------

      const result =
        BookSchema.safeParse(
          normalizedBook
        );

      // ----------------------------------------------
      // STEP 5: SAVE VALID RECORD
      // ----------------------------------------------

      if (result.success) {

        books.push(
          result.data
        );

      } else {

        console.error(
          `VALIDATION FAILED: ${book.url}`
        );

        console.error(
          result.error.issues
        );

        console.error(
          "Normalized book:"
        );

        console.error(
          normalizedBook
        );
      }

    } catch (error) {

      console.error(
        `FAILED: ${book.url} - ${error.message}`
      );
    }
  }

  // ==================================================
  // PART 3
  // STAGE 4 CHECKPOINT
  // ==================================================

  console.log(
    "\n--- STAGE 4 CHECKPOINT ---"
  );

  console.log(
    `book_urls_discovered=${uniqueBooks.length}`
  );

  console.log(
    `validated_records=${books.length}`
  );

  // --------------------------------------------------
  // SHOW SAMPLE VALIDATED RECORD
  // --------------------------------------------------

  if (books.length > 0) {

    console.log(
      "\nSample normalized record:"
    );

    console.log(
      JSON.stringify(
        books[0],
        null,
        2
      )
    );

  } else {

    console.log(
      "\nNo validated records were produced."
    );
  }

  // ==================================================
  // PART 4
  // SAVE BOOKS TO JSON
  // ==================================================

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      books,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `\nSaved ${books.length} records to: ${OUTPUT_FILE}`
  );

  // ==================================================
  // PART 5
  // READ SAVED JSON BACK
  // ==================================================

  const savedJson =
    fs.readFileSync(
      OUTPUT_FILE,
      "utf8"
    );

  const savedBooks =
    JSON.parse(savedJson);

  // ==================================================
  // STAGE 6 CHECKPOINT
  // ==================================================

  console.log(
    "\n--- STAGE 6 CHECKPOINT ---"
  );

  console.log(
    `saved_records=${savedBooks.length}`
  );

  console.log(
    "\nFirst saved record:"
  );

  console.log(
    JSON.stringify(
      savedBooks[0],
      null,
      2
    )
  );

  // ==================================================
  // PART 6
  // COMPLETENESS CHECK
  // ==================================================

  const completeRecords =
    savedBooks.filter(
      (book) =>
        book.title &&
        book.product_url &&
        typeof book.price_gbp === "number" &&
        book.availability &&
        typeof book.rating === "number" &&
        book.description &&
        book.source_page &&
        book.fetched_at
    );

  // ==================================================
  // STAGE 7 CHECKPOINT
  // ==================================================

  console.log(
    "\n--- STAGE 7 CHECKPOINT ---"
  );

  console.log(
    `total_records=${savedBooks.length}`
  );

  console.log(
    `complete_records=${completeRecords.length}`
  );

  console.log(
    `incomplete_records=${
      savedBooks.length -
      completeRecords.length
    }`
  );
}

// --------------------------------------------------
// START PROGRAM
// --------------------------------------------------

main().catch((error) => {

  console.error(
    "FATAL ERROR:",
    error.message
  );

  process.exitCode = 1;
});