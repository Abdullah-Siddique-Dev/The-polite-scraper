document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let summaryData = null;
  let cacheListData = null;
  let parsedBooksData = [];

  let currentModalFile = null;

  // DOM Elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const refreshBtn = document.getElementById("refresh-btn");

  // Stat Elements
  const statCatalogueCount = document.getElementById("stat-catalogue-count");
  const statCatalogueSize = document.getElementById("stat-catalogue-size");
  const statBookCacheCount = document.getElementById("stat-book-cache-count");
  const statBookCacheSize = document.getElementById("stat-book-cache-size");
  const statParsedCount = document.getElementById("stat-parsed-count");
  const statTotalSize = document.getElementById("stat-total-size");
  const statTotalFiles = document.getElementById("stat-total-files");

  const tabCatalogueCount = document.getElementById("tab-catalogue-count");
  const tabBooksCount = document.getElementById("tab-books-count");
  const tabParsedCount = document.getElementById("tab-parsed-count");

  const treeCatalogueInfo = document.getElementById("tree-catalogue-info");
  const treeBooksInfo = document.getElementById("tree-books-info");

  // Table Elements
  const catalogueTableBody = document.getElementById("catalogue-table-body");
  const booksCacheTableBody = document.getElementById("books-cache-table-body");
  const bookCacheSearch = document.getElementById("book-cache-search");

  // Parsed Books Elements
  const parsedBooksGrid = document.getElementById("parsed-books-grid");
  const parsedSearch = document.getElementById("parsed-search");
  const parsedRatingFilter = document.getElementById("parsed-rating-filter");
  const parsedSort = document.getElementById("parsed-sort");

  // Modal Elements
  const viewerModal = document.getElementById("viewer-modal");
  const modalFilename = document.getElementById("modal-filename");
  const modalFilesize = document.getElementById("modal-filesize");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalIframe = document.getElementById("modal-iframe");
  const modalCode = document.getElementById("modal-code");
  const modalModeRendered = document.getElementById("modal-mode-rendered");
  const modalModeRaw = document.getElementById("modal-mode-raw");
  const modalRenderedView = document.getElementById("modal-rendered-view");
  const modalRawView = document.getElementById("modal-raw-view");

  // --------------------------------------------------
  // TAB SWITCHING
  // --------------------------------------------------
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${targetTab}`).classList.add("active");
    });
  });

  // --------------------------------------------------
  // API FETCH FUNCTIONS
  // --------------------------------------------------

  async function loadSummary() {
    try {
      const res = await fetch("/api/cache/summary");
      summaryData = await res.json();

      statCatalogueCount.textContent = summaryData.catalogueCount;
      statCatalogueSize.textContent = summaryData.catalogueTotalSizeFormatted;

      statBookCacheCount.textContent = summaryData.bookCacheCount;
      statBookCacheSize.textContent = summaryData.bookCacheTotalSizeFormatted;

      statParsedCount.textContent = summaryData.parsedBooksCount;

      statTotalSize.textContent = summaryData.totalCacheSizeFormatted;
      statTotalFiles.textContent = `${summaryData.totalCacheFiles} Total Files`;

      tabCatalogueCount.textContent = summaryData.catalogueCount;
      tabBooksCount.textContent = summaryData.bookCacheCount;
      tabParsedCount.textContent = summaryData.parsedBooksCount;

      treeCatalogueInfo.textContent = `${summaryData.catalogueCount} files (${summaryData.catalogueTotalSizeFormatted})`;
      treeBooksInfo.textContent = `${summaryData.bookCacheCount} files (${summaryData.bookCacheTotalSizeFormatted})`;
    } catch (err) {
      console.error("Failed to load summary:", err);
    }
  }

  async function loadCacheList() {
    try {
      const res = await fetch("/api/cache/list");
      cacheListData = await res.json();

      renderCatalogueTable(cacheListData.catalogue);
      renderBooksCacheTable(cacheListData.books);
    } catch (err) {
      console.error("Failed to load cache list:", err);
    }
  }

  async function loadParsedBooks() {
    try {
      const res = await fetch("/api/books");
      parsedBooksData = await res.json();
      renderParsedBooks();
    } catch (err) {
      console.error("Failed to load parsed books:", err);
      parsedBooksGrid.innerHTML = `<div class="loading-spinner">No parsed books data available</div>`;
    }
  }

  // --------------------------------------------------
  // RENDERING FUNCTIONS
  // --------------------------------------------------

  function renderCatalogueTable(files) {
    if (!files || files.length === 0) {
      catalogueTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No catalogue cache files found.</td></tr>`;
      return;
    }

    catalogueTableBody.innerHTML = files
      .map((f) => {
        return `
        <tr>
          <td><strong>${f.filename}</strong></td>
          <td><code>${f.relativePath}</code></td>
          <td><span class="badge badge-purple">${f.sizeFormatted}</span></td>
          <td>${new Date(f.mtime).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-blue view-file-btn" data-path="${f.relativePath}" data-filename="${f.filename}" data-size="${f.sizeFormatted}">
              👁 View File
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderBooksCacheTable(files) {
    if (!files || files.length === 0) {
      booksCacheTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No book cache files found.</td></tr>`;
      return;
    }

    const searchTerm = bookCacheSearch.value.toLowerCase().trim();
    const filteredFiles = files.filter(
      (f) =>
        f.filename.toLowerCase().includes(searchTerm) ||
        f.relativePath.toLowerCase().includes(searchTerm)
    );

    if (filteredFiles.length === 0) {
      booksCacheTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No matching book files.</td></tr>`;
      return;
    }

    booksCacheTableBody.innerHTML = filteredFiles
      .map((f) => {
        return `
        <tr>
          <td><strong>${f.filename}</strong></td>
          <td><code>${f.relativePath}</code></td>
          <td><span class="badge badge-blue">${f.sizeFormatted}</span></td>
          <td>${new Date(f.mtime).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-blue view-file-btn" data-path="${f.relativePath}" data-filename="${f.filename}" data-size="${f.sizeFormatted}">
              👁 View File
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderParsedBooks() {
    if (!parsedBooksData || parsedBooksData.length === 0) {
      parsedBooksGrid.innerHTML = `<div class="loading-spinner">No books found in output/books.json</div>`;
      return;
    }

    const search = parsedSearch.value.toLowerCase().trim();
    const ratingFilter = parsedRatingFilter.value;
    const sortVal = parsedSort.value;

    let filtered = parsedBooksData.filter((b) => {
      const matchSearch =
        !search ||
        b.title.toLowerCase().includes(search) ||
        b.description.toLowerCase().includes(search);

      const matchRating = !ratingFilter || b.rating === parseInt(ratingFilter, 10);

      return matchSearch && matchRating;
    });

    // Sorting
    if (sortVal === "price-asc") {
      filtered.sort((a, b) => a.price_gbp - b.price_gbp);
    } else if (sortVal === "price-desc") {
      filtered.sort((a, b) => b.price_gbp - a.price_gbp);
    } else if (sortVal === "rating-desc") {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    if (filtered.length === 0) {
      parsedBooksGrid.innerHTML = `<div class="loading-spinner">No books match your criteria.</div>`;
      return;
    }

    parsedBooksGrid.innerHTML = filtered
      .map((book, index) => {
        const stars = "★".repeat(book.rating) + "☆".repeat(5 - book.rating);
        const bookCacheIndex = index + 1;
        const cacheFilePath = `cache/books/book-${bookCacheIndex}.html`;

        return `
        <div class="book-card">
          <div class="book-title">${book.title}</div>
          <div class="book-meta">
            <span class="book-price">£${book.price_gbp.toFixed(2)}</span>
            <span class="book-rating" title="${book.rating} Stars">${stars}</span>
          </div>
          <p class="book-desc">${book.description}</p>
          <div class="book-card-foot">
            <span class="badge badge-green">${book.availability}</span>
            <button class="btn btn-sm btn-blue view-file-btn" data-path="${cacheFilePath}" data-filename="book-${bookCacheIndex}.html" data-size="Cached HTML">
              👁 View Cached Page
            </button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // --------------------------------------------------
  // FILE VIEWER MODAL LOGIC
  // --------------------------------------------------

  async function openModal(filePath, filename, filesize) {
    currentModalFile = filePath;
    modalFilename.textContent = filename;
    modalFilesize.textContent = filesize;

    // Set raw HTML URL into iframe
    modalIframe.src = `/${filePath}`;

    // Fetch raw content for code view
    try {
      modalCode.textContent = "Loading raw HTML content...";
      const res = await fetch(`/api/cache/content?file=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const text = await res.text();
        modalCode.textContent = text;
      } else {
        modalCode.textContent = "Error loading raw file content.";
      }
    } catch (e) {
      modalCode.textContent = "Error fetching raw content.";
    }

    // Default to rendered preview mode
    setModalMode("rendered");
    viewerModal.classList.remove("hidden");
  }

  function closeModal() {
    viewerModal.classList.add("hidden");
    modalIframe.src = "about:blank";
  }

  function setModalMode(mode) {
    if (mode === "rendered") {
      modalModeRendered.classList.add("active");
      modalModeRaw.classList.remove("active");
      modalRenderedView.classList.remove("hidden");
      modalRawView.classList.add("hidden");
    } else {
      modalModeRaw.classList.add("active");
      modalModeRendered.classList.remove("active");
      modalRawView.classList.remove("hidden");
      modalRenderedView.classList.add("hidden");
    }
  }

  // Event Listeners for Modal
  modalCloseBtn.addEventListener("click", closeModal);
  viewerModal.addEventListener("click", (e) => {
    if (e.target === viewerModal) closeModal();
  });

  modalModeRendered.addEventListener("click", () => setModalMode("rendered"));
  modalModeRaw.addEventListener("click", () => setModalMode("raw"));

  // Event Delegation for View File buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-file-btn");
    if (btn) {
      const path = btn.dataset.path;
      const name = btn.dataset.filename;
      const size = btn.dataset.size;
      openModal(path, name, size);
    }
  });

  // Filter Listeners
  bookCacheSearch.addEventListener("input", () => {
    if (cacheListData) renderBooksCacheTable(cacheListData.books);
  });

  parsedSearch.addEventListener("input", renderParsedBooks);
  parsedRatingFilter.addEventListener("change", renderParsedBooks);
  parsedSort.addEventListener("change", renderParsedBooks);

  refreshBtn.addEventListener("click", () => {
    loadSummary();
    loadCacheList();
    loadParsedBooks();
  });

  // Initial Data Load
  loadSummary();
  loadCacheList();
  loadParsedBooks();
});
