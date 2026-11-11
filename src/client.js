(() => {
  document.querySelectorAll('[data-gathering-catalog]').forEach((catalog) => {
    const search = catalog.querySelector('[data-gathering-search]');
    const filters = catalog.querySelector('.kumpul-category-filters');
    const results = catalog.querySelector('[data-gathering-results]');
    const noResults = catalog.querySelector('[data-gathering-no-results]');
    const pagination = catalog.querySelector('[data-gathering-pagination]');
    const previousButton = catalog.querySelector('[data-page-previous]');
    const nextButton = catalog.querySelector('[data-page-next]');
    const pageStatus = catalog.querySelector('[data-page-status]');
    const cards = Array.from(catalog.querySelectorAll('[data-gathering-name]'));
    if (!search || !filters || !results || !noResults || !pagination || !previousButton || !nextButton || !pageStatus || cards.length === 0) return;

    let activeCategory = 'all';
    let currentPage = 0;
    let pageCount = 1;
    const pageSize = 12;
    const categoryButtons = Array.from(filters.querySelectorAll('[data-category-filter]'));
    search.closest('label').hidden = false;
    filters.hidden = false;
    results.hidden = false;

    const updateResults = () => {
      const query = search.value.trim().toLocaleLowerCase('id-ID');
      const matchingCards = cards.filter((card) => {
        const matchesQuery = card.dataset.gatheringName.includes(query);
        const matchesCategory = activeCategory === 'all' || card.dataset.gatheringCategory === activeCategory;
        return matchesQuery && matchesCategory;
      });
      pageCount = Math.ceil(matchingCards.length / pageSize);
      currentPage = Math.min(currentPage, Math.max(pageCount - 1, 0));
      const start = currentPage * pageSize;
      const end = Math.min(start + pageSize, matchingCards.length);
      const visibleCards = new Set(matchingCards.slice(start, end));
      cards.forEach((card) => {
        card.hidden = !visibleCards.has(card);
      });

      results.textContent = matchingCards.length
        ? `Menampilkan ${start + 1}–${end} dari ${matchingCards.length} gathering`
        : `0 dari ${cards.length} gathering`;
      noResults.hidden = matchingCards.length > 0;
      pagination.hidden = pageCount <= 1;
      pageStatus.textContent = `Halaman ${currentPage + 1} dari ${Math.max(pageCount, 1)}`;
      previousButton.disabled = currentPage === 0;
      nextButton.disabled = currentPage >= pageCount - 1;
    };

    search.addEventListener('input', () => {
      currentPage = 0;
      updateResults();
    });
    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.categoryFilter;
        currentPage = 0;
        categoryButtons.forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        updateResults();
      });
    });
    previousButton.addEventListener('click', () => {
      if (currentPage === 0) return;
      currentPage -= 1;
      updateResults();
    });
    nextButton.addEventListener('click', () => {
      if (currentPage >= pageCount - 1) return;
      currentPage += 1;
      updateResults();
    });
    updateResults();
  });
})();
