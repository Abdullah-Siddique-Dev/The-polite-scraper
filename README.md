# Books Scraper

## Overview

This project is a Node.js web scraper built for the FlyRank internship assignment.

The scraper collects book information from Books to Scrape, processes and validates the data, and saves the final results as a JSON file.

## What the Scraper Does

The scraper performs the following steps:

1. Discovers book URLs from the first 3 catalogue pages.
2. Collects 60 unique book URLs.
3. Downloads each book page.
4. Uses a local cache to avoid unnecessary repeated requests.
5. Extracts book information using Cheerio.
6. Normalizes the extracted data.
7. Validates each record using Zod.
8. Saves all valid records to `output/books.json`.
9. Verifies that the saved JSON contains complete records.

## Data Collected

Each book record contains:

- `title`
- `product_url`
- `price_gbp`
- `availability`
- `rating`
- `description`
- `source_page`
- `fetched_at`

## Project Structure

```text
scraper/
├── src/
│   └── index.js
├── cache/
│   ├── catalogue/
│   └── books/
├── output/
│   └── books.json
├── package.json
└── README.md





