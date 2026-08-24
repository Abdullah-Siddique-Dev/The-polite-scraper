# The Polite Scraper

## Target Classification

### Target

Books to Scrape

### Website

https://books.toscrape.com/

### Why this target?

Books to Scrape is a public demo website created for web scraping practice.

### Scope

This scraper will process only the first 3 catalogue pages and discover the books listed on those pages.

The expected scope is 60 unique book pages.

### Data collected

For each book, the scraper will collect:

- title
- product URL
- price text
- availability text
- rating text
- description
- source page
- fetched timestamp

### Robots.txt

The robots.txt URL was checked:

https://books.toscrape.com/robots.txt

Result: 404 Not Found. No robots.txt file was found.

A missing robots.txt file is not treated as permission to scrape other websites. This assignment uses Books to Scrape because it is specifically provided as a public practice sandbox for scraping.

### Appropriate use

The scraper is limited to the first 3 catalogue pages as required by the assignment. Requests will also use an identifying user-agent, a timeout, and a delay between real requests.

I will not reuse this code on another site without checking its rules and terms first.