class FilterableCollection extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector('[data-filterable-form]');
    this.status = this.querySelector('[data-filterable-status]');
    this.abortController = null;
    this.onChange = this.onChange.bind(this);
    this.onPopState = this.onPopState.bind(this);
  }

  connectedCallback() {
    if (!this.form) return;
    this.form.addEventListener('change', this.onChange);
    this.querySelector('[data-filterable-clear]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.clearFilters();
    });
    window.addEventListener('popstate', this.onPopState);
    const hydrated = this.hydrateFromQueryParams();
    if (hydrated.hasFilterState) this.render({ updateHistory: false });
  }

  disconnectedCallback() {
    this.form?.removeEventListener('change', this.onChange);
    window.removeEventListener('popstate', this.onPopState);
    this.abortController?.abort();
  }

  onChange() {
    this.render();
  }

  onPopState() {
    this.hydrateFromQueryParams();
    this.render({ updateHistory: false });
  }

  hydrateFromQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const selectedTags = (params.get('filter_tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const sortBy = params.get('sort_by');

    this.querySelectorAll('[data-filter-tag]').forEach((input) => {
      input.checked = selectedTags.includes(input.value);
    });

    const sortSelect = this.querySelector('[name="sort_by"]');
    if (sortSelect && sortBy && [...sortSelect.options].some((option) => option.value === sortBy)) {
      sortSelect.value = sortBy;
    }

    return {
      hasFilterState: selectedTags.length > 0 || Boolean(sortBy),
    };
  }

  clearFilters() {
    this.querySelectorAll('[data-filter-tag]').forEach((input) => {
      input.checked = false;
    });
    const sortSelect = this.querySelector('[name="sort_by"]');
    if (sortSelect) sortSelect.value = sortSelect.dataset.defaultSort || 'manual';
    this.render();
  }

  get selectedTags() {
    return [...this.querySelectorAll('[data-filter-tag]:checked')].map((input) => input.value);
  }

  get sortBy() {
    return this.querySelector('[name="sort_by"]')?.value || '';
  }

  buildFetchUrl() {
    const basePath = this.dataset.collectionUrl || window.location.pathname;
    const tagPath = this.selectedTags.length ? `/${this.selectedTags.map(encodeURIComponent).join('+')}` : '';
    const url = new URL(`${basePath}${tagPath}`, window.location.origin);
    url.searchParams.set('section_id', this.dataset.sectionId);
    if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);
    return url;
  }

  buildShareUrl() {
    const url = new URL(this.dataset.collectionUrl || window.location.pathname, window.location.origin);
    if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);
    if (this.selectedTags.length) url.searchParams.set('filter_tags', this.selectedTags.join(','));
    return url;
  }

  async render({ updateHistory = true } = {}) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.classList.add('is-loading');
    this.setStatus('Loading products');

    try {
      const response = await fetch(this.buildFetchUrl().toString(), { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`Section request failed with ${response.status}`);
      const text = await response.text();
      const html = new DOMParser().parseFromString(text, 'text/html');
      const nextSection = html.querySelector(`filterable-collection[data-section-id="${this.dataset.sectionId}"]`);
      if (!nextSection) throw new Error('Updated collection section was not found');

      this.querySelector('[data-filterable-results]').innerHTML =
        nextSection.querySelector('[data-filterable-results]').innerHTML;
      this.querySelector('[data-filterable-count]').innerHTML =
        nextSection.querySelector('[data-filterable-count]').innerHTML;

      if (updateHistory) {
        const nextUrl = this.buildShareUrl();
        window.history.pushState({}, '', nextUrl.toString());
      }

      this.setStatus('Products updated');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
        this.setStatus('Unable to update products. Please try again.');
      }
    } finally {
      this.classList.remove('is-loading');
    }
  }

  setStatus(message) {
    if (this.status) this.status.textContent = message;
  }
}

customElements.define('filterable-collection', FilterableCollection);
