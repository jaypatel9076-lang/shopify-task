# Shopify Theme Developer Assignment

This repo uses Shopify Dawn as the Online Store 2.0 base theme and adds the two requested assignment features:

- Task 1: a reusable, configurable AJAX filterable collection section.
- Task 2: an AJAX cart drawer that opens after add-to-cart and supports live quantity/removal updates.

## Preview

1. Log in with Shopify CLI:

   ```bash
   shopify auth login
   ```

2. Start the theme preview against the development store:

   ```bash
   shopify theme dev --store jaypatel9076.myshopify.com
   ```

3. Open a collection page. The default collection template uses the new `filterable-collection` section.

## Task 1: Filterable Collection

The custom section lives in:

- `sections/filterable-collection.liquid`
- `assets/filterable-collection.js`
- `assets/section-filterable-collection.css`

The section supports:

- Theme editor tag-group blocks with comma-separated tag values.
- Configurable heading, products per page, desktop/mobile columns, image settings, and quick add.
- Tag filtering using Shopify collection tag URLs fetched through section rendering.
- Sorting by featured, price low-high, price high-low, and newest.
- AJAX updates with `section_id`, so the page does not reload.
- Query params for shareable state: `filter_tags` and `sort_by`.
- Accessible grouped controls, live status updates, keyboard-friendly inputs, lazy product images, and empty/loading states.

The default `templates/collection.json` includes two starter tag groups: Color and Size. These can be edited or replaced in the theme editor to match the store's real product tags.

## Task 2: AJAX Cart Drawer

Dawn already ships a strong cart drawer foundation, so this implementation keeps the theme idiomatic and uses Dawn's existing cart drawer components:

- `snippets/cart-drawer.liquid`
- `sections/cart-drawer.liquid`
- `assets/cart-drawer.js`
- `assets/cart.js`
- `assets/product-form.js`

The theme setting in `config/settings_data.json` is set to `cart_type: "drawer"`. Product forms submit with Ajax to `/cart/add.js`, request the cart drawer and cart bubble sections, render the updated drawer, and open it automatically. Quantity changes and removals use `/cart/change.js` and update drawer totals without a page reload.

## Key Decisions

- I used Dawn as the base to stay close to Shopify's current OS 2.0 conventions.
- I built Task 1 as a separate section instead of modifying Dawn's built-in collection grid, so it remains reusable and easy to add/remove in the theme editor.
- I reused Dawn's cart drawer for Task 2 because it is already accessible, section-rendered, and aligned with Shopify's Ajax cart API.
- Tag filtering uses Shopify's native collection tag route for correct server-side product results, while query params mirror state for sharing and hydration.

## Trade-offs

- The starter tag groups are examples. A merchant should update them to match real product tags in the store.
- Shopify's native tag filtering is path-based, so the implementation keeps the tag path and query params in sync rather than relying only on query params.
- With more time, I would add dedicated automated storefront tests for filter/sort combinations and cart drawer flows against a seeded development store.
