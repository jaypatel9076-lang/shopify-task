class CustomCartDrawer extends HTMLElement {
  constructor() {
    super();
    this.cart = null;
    this.activeElement = null;
    this.isRendering = false;
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);
    this.onDocumentSubmit = this.onDocumentSubmit.bind(this);
  }

  connectedCallback() {
    this.addEventListener('keyup', this.onKeyUp);
    this.addEventListener('click', this.onClick);
    this.addEventListener('change', this.onChange);
    document.addEventListener('pointerdown', this.onDocumentPointerDown);
    document.addEventListener('submit', this.onDocumentSubmit, true);
    this.setHeaderCartIconAccessibility();
    this.refresh();
  }

  disconnectedCallback() {
    this.removeEventListener('keyup', this.onKeyUp);
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('change', this.onChange);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
    document.removeEventListener('submit', this.onDocumentSubmit, true);
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink || cartLink.dataset.customCartDrawerBound === 'true') return;

    cartLink.dataset.customCartDrawerBound = 'true';
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() !== 'SPACE') return;
      event.preventDefault();
      this.open(cartLink);
    });
  }

  onKeyUp(event) {
    if (event.code === 'Escape') this.close();
  }

  onClick(event) {
    if (event.target.closest('[data-custom-cart-close]')) {
      event.preventDefault();
      this.close();
      return;
    }

    const quantityButton = event.target.closest('[data-custom-cart-quantity-button]');
    if (quantityButton) {
      event.preventDefault();
      this.onQuantityButtonClick(quantityButton);
      return;
    }

    const removeButton = event.target.closest('[data-custom-cart-remove]');
    if (removeButton) {
      event.preventDefault();
      this.changeLine(removeButton.dataset.key, 0, removeButton);
    }
  }

  onChange(event) {
    const input = event.target.closest('[data-custom-cart-quantity-input]');
    if (!input) return;

    this.changeLine(input.dataset.key, Math.max(0, parseInt(input.value, 10) || 0), input);
  }

  onDocumentPointerDown(event) {
    if (!this.classList.contains('is-open')) return;
    if (event.target.closest('.custom-cart-drawer__panel')) return;
    if (event.target.closest('#cart-icon-bubble')) return;

    this.close();
  }

  onDocumentSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.closest('product-form')) return;

    const action = form.getAttribute('action') || '';
    const cartAddPath = this.dataset.cartUrl ? `${this.dataset.cartUrl}/add` : '/cart/add';
    if (!action.includes(cartAddPath) && !action.includes('/cart/add')) return;

    event.preventDefault();
    this.addFormToCart(form);
  }

  onQuantityButtonClick(button) {
    const input = this.querySelector(`[data-custom-cart-quantity-input][data-key="${CSS.escape(button.dataset.key)}"]`);
    if (!input) return;

    const nextQuantity = Math.max(0, (parseInt(input.value, 10) || 0) + Number(button.dataset.delta));
    input.value = nextQuantity;
    this.changeLine(button.dataset.key, nextQuantity, button);
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    this.refresh();
    this.classList.add('is-open');
    document.body.classList.add('overflow-hidden');

    const focusTarget = this.querySelector('.custom-cart-drawer__panel');
    if (typeof trapFocus === 'function') {
      trapFocus(this, focusTarget);
    } else {
      focusTarget?.focus();
    }
  }

  close() {
    this.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden');
    if (typeof removeTrapFocus === 'function') {
      removeTrapFocus(this.activeElement);
    } else {
      this.activeElement?.focus();
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  getSectionsToRender() {
    return [{ id: 'cart-icon-bubble' }];
  }

  renderContents(parsedState) {
    this.updateCartIconFromSections(parsedState?.sections);
    this.refresh().then(() => this.open());
  }

  async addFormToCart(form) {
    this.setActiveElement(document.activeElement);
    this.setLoading(true);
    this.setError('');

    try {
      const formData = new FormData(form);
      formData.append('sections', this.getSectionsToRender().map((section) => section.id));
      formData.append('sections_url', window.location.pathname);

      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];
      config.body = formData;

      const response = await fetch(window.routes?.cart_add_url || '/cart/add.js', config);
      const parsedState = await response.json();
      if (!response.ok || parsedState.status) {
        throw new Error(parsedState.description || parsedState.message || 'Unable to add item to cart');
      }

      this.renderContents(parsedState);
    } catch (error) {
      console.error(error);
      this.setError(error.message || window.cartStrings?.error || 'Unable to update cart. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async refresh() {
    if (this.isRendering) return Promise.resolve();
    this.isRendering = true;
    this.setLoading(true);
    this.setError('');

    try {
      const response = await fetch(`${this.dataset.cartUrl}.js`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Unable to load cart');
      this.cart = await response.json();
      this.renderCart();
      this.updateCartIcon();
    } catch (error) {
      console.error(error);
      this.setError(window.cartStrings?.error || 'Unable to update cart. Please try again.');
    } finally {
      this.isRendering = false;
      this.setLoading(false);
    }
  }

  async changeLine(key, quantity, sourceElement) {
    this.setError('');
    this.setLineLoading(key, true);
    this.setStatus(quantity === 0 ? 'Removing item' : 'Updating quantity');

    try {
      const response = await fetch(this.dataset.cartChangeUrl, {
        ...fetchConfig('javascript'),
        body: JSON.stringify({ id: key, quantity }),
      });
      const cart = await response.json();
      if (!response.ok || cart.errors) throw new Error(cart.errors || cart.description || 'Unable to update cart');

      this.cart = cart;
      this.renderCart();
      this.updateCartIcon();
      this.publishCartUpdate(cart);
      this.setStatus(quantity === 0 ? 'Item removed' : 'Cart updated');
      this.restoreFocus(sourceElement, key);
    } catch (error) {
      console.error(error);
      this.setError(error.message || window.cartStrings?.error || 'Unable to update cart. Please try again.');
      this.refresh();
    } finally {
      this.setLineLoading(key, false);
    }
  }

  renderCart() {
    if (!this.cart) return;

    this.classList.toggle('is-empty', this.cart.item_count === 0);
    this.querySelector('[data-custom-cart-count]').textContent = `${this.cart.item_count} ${this.cart.item_count === 1 ? 'item' : 'items'}`;
    this.querySelector('[data-custom-cart-total]').textContent = this.formatMoney(this.cart.total_price);
    this.querySelector('[data-custom-cart-empty]').hidden = this.cart.item_count !== 0;
    this.querySelector('[data-custom-cart-footer]').hidden = this.cart.item_count === 0;
    this.querySelector('[data-custom-cart-checkout]').disabled = this.cart.item_count === 0;
    this.querySelector('[data-custom-cart-items]').innerHTML = this.cart.items.map((item) => this.renderItem(item)).join('');
  }

  renderItem(item) {
    const image = item.featured_image?.url || item.image;
    const variantTitle = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';

    return `
      <article class="custom-cart-item" data-custom-cart-line="${this.escapeAttribute(item.key)}">
        <a class="custom-cart-item__media" href="${this.escapeAttribute(item.url)}" tabindex="-1" aria-hidden="true">
          ${image ? `<img src="${this.escapeAttribute(image)}&width=180" alt="${this.escapeAttribute(item.featured_image?.alt || item.product_title)}" loading="lazy" width="90" height="90">` : ''}
        </a>
        <div class="custom-cart-item__details">
          <a class="custom-cart-item__title" href="${this.escapeAttribute(item.url)}">${this.escapeHtml(item.product_title)}</a>
          ${variantTitle ? `<p class="custom-cart-item__variant">${this.escapeHtml(variantTitle)}</p>` : ''}
          <p class="custom-cart-item__price">${this.formatMoney(item.final_line_price ?? item.line_price)}</p>
          <div class="custom-cart-item__actions">
            <div class="custom-cart-quantity" aria-label="Quantity for ${this.escapeAttribute(item.product_title)}">
              <button type="button" class="custom-cart-quantity__button" data-custom-cart-quantity-button data-key="${this.escapeAttribute(item.key)}" data-delta="-1" aria-label="Decrease quantity">-</button>
              <input class="custom-cart-quantity__input" type="number" min="0" value="${item.quantity}" data-custom-cart-quantity-input data-key="${this.escapeAttribute(item.key)}" aria-label="Quantity">
              <button type="button" class="custom-cart-quantity__button" data-custom-cart-quantity-button data-key="${this.escapeAttribute(item.key)}" data-delta="1" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="custom-cart-item__remove link underlined-link" data-custom-cart-remove data-key="${this.escapeAttribute(item.key)}">Remove</button>
          </div>
          <span class="custom-cart-item__loader" data-custom-cart-line-loader data-key="${this.escapeAttribute(item.key)}" hidden>
            <span class="loading__spinner"></span>
          </span>
        </div>
      </article>
    `;
  }

  async updateCartIcon() {
    try {
      const response = await fetch(`${this.dataset.cartUrl}?section_id=cart-icon-bubble`);
      if (!response.ok) return;
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const section = parsed.querySelector('.shopify-section') || parsed.body;
      const cartIcon = document.getElementById('cart-icon-bubble');
      if (section && cartIcon) cartIcon.innerHTML = section.innerHTML;
    } catch (error) {
      console.error(error);
    }
  }

  updateCartIconFromSections(sections) {
    if (!sections?.['cart-icon-bubble']) return;
    const parsed = new DOMParser().parseFromString(sections['cart-icon-bubble'], 'text/html');
    const section = parsed.querySelector('.shopify-section') || parsed.body;
    const cartIcon = document.getElementById('cart-icon-bubble');
    if (section && cartIcon) cartIcon.innerHTML = section.innerHTML;
  }

  restoreFocus(sourceElement, key) {
    if (!this.classList.contains('is-open')) return;
    const replacement = key ? this.querySelector(`[data-custom-cart-quantity-input][data-key="${CSS.escape(key)}"]`) : null;
    if (replacement && Number(replacement.value) > 0) {
      replacement.focus();
      return;
    }

    const focusTarget = this.querySelector('[data-custom-cart-quantity-input]') || this.querySelector('[data-custom-cart-close]');
    focusTarget?.focus();
  }

  publishCartUpdate(cart) {
    if (typeof publish !== 'function' || !window.PUB_SUB_EVENTS?.cartUpdate) return;
    publish(PUB_SUB_EVENTS.cartUpdate, { source: 'custom-cart-drawer', cartData: cart });
  }

  setLoading(isLoading) {
    this.querySelector('[data-custom-cart-loading]').hidden = !isLoading;
    this.classList.toggle('is-loading', isLoading);
  }

  setLineLoading(key, isLoading) {
    const line = this.querySelector(`[data-custom-cart-line="${CSS.escape(key)}"]`);
    if (line) line.classList.toggle('is-loading', isLoading);
    this.querySelectorAll(`[data-custom-cart-line-loader][data-key="${CSS.escape(key)}"]`).forEach((loader) => {
      loader.hidden = !isLoading;
    });
  }

  setError(message) {
    this.querySelector('[data-custom-cart-error]').textContent = message;
  }

  setStatus(message) {
    this.querySelector('[data-custom-cart-status]').textContent = message;
  }

  formatMoney(cents) {
    const amount = Number(cents || 0) / 100;
    const currency = this.cart?.currency || window.Shopify?.currency?.active || 'USD';
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency }).format(amount);
    } catch (error) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeAttribute(value = '') {
    return this.escapeHtml(value);
  }
}

customElements.define('custom-cart-drawer', CustomCartDrawer);
