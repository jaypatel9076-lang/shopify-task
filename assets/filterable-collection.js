class FilterableCollection extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector('[data-filterable-form]');
    this.status = this.querySelector('[data-filterable-status]');
    this.abortController = null;
    this.onChange = this.onChange.bind(this);
    this.onFilterLinkClick = this.onFilterLinkClick.bind(this);
    this.onPopState = this.onPopState.bind(this);
  }

  connectedCallback() {
    if (!this.form) return;
    this.form.addEventListener('change', this.onChange);
    this.addEventListener('click', this.onFilterLinkClick);
    this.querySelector('[data-filterable-clear]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.clearFilters();
    });
    window.addEventListener('popstate', this.onPopState);
    const hydrated = this.hydrateFromQueryParams();
    if (this.needsRemoteNativeFilters()) {
      this.loadRemoteNativeFilters().then(() => {
        const nextHydrated = this.hydrateFromQueryParams();
        if (hydrated.hasFilterState || nextHydrated.hasFilterState) this.render({ updateHistory: false });
      });
    } else if (hydrated.hasFilterState) {
      this.render({ updateHistory: false });
    }
  }

  disconnectedCallback() {
    this.form?.removeEventListener('change', this.onChange);
    this.removeEventListener('click', this.onFilterLinkClick);
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

  onFilterLinkClick(event) {
    const link = event.target.closest('[data-filter-link]');
    if (!link) return;
    event.preventDefault();
    this.render({ updateHistory: true, url: this.buildFilterLinkUrl(link.href) });
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

    this.querySelectorAll('[data-native-filter]').forEach((input) => {
      input.checked = params.getAll(input.name).includes(input.value);
    });

    const sortSelect = this.querySelector('[name="sort_by"]');
    if (sortSelect && sortBy && [...sortSelect.options].some((option) => option.value === sortBy)) {
      sortSelect.value = sortBy;
    }

    return {
      hasFilterState: selectedTags.length > 0 || Boolean(sortBy) || [...params.keys()].some((key) => key.startsWith('filter.')),
    };
  }

  clearFilters() {
    this.querySelectorAll('[data-filter-tag]').forEach((input) => {
      input.checked = false;
    });
    this.querySelectorAll('[data-native-filter]').forEach((input) => {
      input.checked = false;
    });
    const sortSelect = this.querySelector('[name="sort_by"]');
    if (sortSelect) sortSelect.value = sortSelect.dataset.defaultSort || 'manual';
    this.render();
  }

  get selectedTags() {
    return [...this.querySelectorAll('[data-filter-tag]:checked')].map((input) => input.value);
  }

  get selectedNativeFilters() {
    return [...this.querySelectorAll('[data-native-filter]:checked')].map((input) => ({
      name: input.name,
      value: input.value,
    }));
  }

  get sortBy() {
    return this.querySelector('[name="sort_by"]')?.value || '';
  }

  buildFetchUrl() {
    if (this.dataset.filterSource === 'native') {
      const url = new URL(this.nativeFilterFetchBasePath, window.location.origin);
      if (this.usesCurrentSectionForNativeFilters) url.searchParams.set('section_id', this.dataset.sectionId);
      if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);
      this.selectedNativeFilters.forEach((filter) => {
        url.searchParams.append(filter.name, filter.value);
      });
      return url;
    }

    const basePath = this.dataset.collectionUrl || window.location.pathname;
    const tagPath = this.selectedTags.length ? `/${this.selectedTags.map(encodeURIComponent).join('+')}` : '';
    const url = new URL(`${basePath}${tagPath}`, window.location.origin);
    url.searchParams.set('section_id', this.dataset.sectionId);
    if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);
    return url;
  }

  buildShareUrl() {
    const url = new URL(this.dataset.shareUrl || this.dataset.sectionUrl || window.location.pathname, window.location.origin);
    if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);

    if (this.dataset.filterSource === 'native') {
      this.selectedNativeFilters.forEach((filter) => {
        url.searchParams.append(filter.name, filter.value);
      });
    } else if (this.selectedTags.length) {
      url.searchParams.set('filter_tags', this.selectedTags.join(','));
    }

    return url;
  }

  async render({ updateHistory = true, url = null } = {}) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.classList.add('is-loading');
    this.setStatus('Loading products');

    try {
      const requestUrl = url ? this.withSectionId(url) : this.buildFetchUrl();
      const response = await fetch(requestUrl.toString(), { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`Section request failed with ${response.status}`);
      const text = await response.text();
      const html = new DOMParser().parseFromString(text, 'text/html');
      const nextSection = this.findUpdatedSection(html);
      if (!nextSection) throw new Error('Updated collection section was not found');

      this.querySelector('[data-filterable-results]').innerHTML =
        nextSection.querySelector('[data-filterable-results]').innerHTML;
      this.querySelector('[data-filterable-count]').innerHTML =
        nextSection.querySelector('[data-filterable-count]').innerHTML;
      const filterGroups = this.querySelector('.filterable-collection__groups');
      const nextFilterGroups = nextSection.querySelector('.filterable-collection__groups');
      if (filterGroups && nextFilterGroups) filterGroups.innerHTML = nextFilterGroups.innerHTML;
      const activeFilters = this.querySelector('[data-active-filters]');
      const nextActiveFilters = nextSection.querySelector('[data-active-filters]');
      if (activeFilters && nextActiveFilters) activeFilters.innerHTML = nextActiveFilters.innerHTML;

      if (updateHistory) {
        const nextUrl = url && !this.usesCurrentSectionForNativeFilters ? this.buildHistoryUrlFrom(url) : url || this.buildShareUrl();
        nextUrl.searchParams.delete('section_id');
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

  withSectionId(url) {
    const nextUrl = new URL(url.toString());
    if (this.usesCurrentSectionForNativeFilters) nextUrl.searchParams.set('section_id', this.dataset.sectionId);
    return nextUrl;
  }

  buildFilterLinkUrl(href) {
    const linkUrl = new URL(href);
    if (this.dataset.filterSource !== 'native') return linkUrl;
    if (!this.usesCurrentSectionForNativeFilters) {
      const collectionUrl = new URL(this.dataset.collectionUrl || linkUrl.pathname, window.location.origin);
      collectionUrl.search = linkUrl.search;
      return collectionUrl;
    }

    const sectionUrl = new URL(this.dataset.sectionUrl || window.location.pathname, window.location.origin);
    sectionUrl.search = linkUrl.search;
    return sectionUrl;
  }

  get usesCurrentSectionForNativeFilters() {
    return this.dataset.filterSource !== 'native' || this.dataset.collectionTemplate === 'true';
  }

  get nativeFilterFetchBasePath() {
    if (this.usesCurrentSectionForNativeFilters) return this.dataset.sectionUrl || window.location.pathname;
    return this.dataset.collectionUrl || this.dataset.sectionUrl || window.location.pathname;
  }

  needsRemoteNativeFilters() {
    return (
      this.dataset.filterSource === 'native' &&
      this.dataset.collectionTemplate !== 'true' &&
      Boolean(this.dataset.collectionUrl) &&
      !this.querySelector('[data-native-filter]')
    );
  }

  async loadRemoteNativeFilters() {
    try {
      const url = new URL(this.dataset.collectionUrl, window.location.origin);
      if (this.sortBy) url.searchParams.set('sort_by', this.sortBy);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Filter request failed with ${response.status}`);
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextSection = this.findUpdatedSection(html);
      if (!nextSection) return;

      const filterGroups = this.querySelector('.filterable-collection__groups');
      const nextFilterGroups = nextSection.querySelector('.filterable-collection__groups');
      if (filterGroups && nextFilterGroups) filterGroups.innerHTML = nextFilterGroups.innerHTML;
    } catch (error) {
      console.error(error);
    }
  }

  findUpdatedSection(html) {
    return (
      html.querySelector(`filterable-collection[data-section-id="${this.dataset.sectionId}"]`) ||
      html.querySelector('filterable-collection')
    );
  }

  buildHistoryUrlFrom(url) {
    const historyUrl = new URL(this.dataset.shareUrl || this.dataset.sectionUrl || window.location.pathname, window.location.origin);
    historyUrl.search = new URL(url.toString()).search;
    return historyUrl;
  }
}

customElements.define('filterable-collection', FilterableCollection);
