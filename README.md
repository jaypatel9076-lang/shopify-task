# Shopify Theme Developer Assignment

This repo uses Shopify Dawn as the Online Store 2.0 base theme and adds:

- A reusable AJAX filterable collection section.
- A custom AJAX cart drawer selectable from the Cart settings in the theme customizer.

## Preview

1. Log in with Shopify CLI:

   ```bash
   shopify auth login
   ```

2. Start the theme preview:

   ```bash
   shopify theme dev --store jaypatel9076.myshopify.com
   ```

3. In the theme customizer, set **Theme settings > Cart > Type** to **Custom AJAX drawer**.

4. Preview the homepage or a collection page. The `filterable-collection` section is included on both the homepage and collection template.

## Filterable Collection

Files:

- `sections/filterable-collection.liquid`
- `assets/filterable-collection.js`
- `assets/section-filterable-collection.css`

The section is built as an Online Store 2.0 section with schema settings for collection source, heading, labels, filters, sorting, quick add, product card display, columns, color scheme, and spacing.

Filtering is dynamic and based on Shopify product data/filter values instead of hard-coded section blocks. The filter values are driven through product setup/metafields and product tags, so the merchant does not need to add the same filter values manually in every page instance of the section. Once the product metafield/tag data is configured, the filterable section can be reused on the homepage, collection page, or other templates without duplicating filter configuration in the customizer.

## Custom AJAX Cart Drawer

Files:

- `snippets/custom-ajax-cart-drawer.liquid`
- `assets/custom-ajax-cart-drawer.js`
- `assets/custom-ajax-cart-drawer.css`

The custom drawer is separate from Dawn's default cart drawer. Dawn's drawer files remain available, and the new drawer is selected through the existing Cart type setting with a new **Custom AJAX drawer** option.

The drawer:

- Opens after add-to-cart without a full page reload.
- Uses Shopify Ajax Cart APIs such as `/cart.js`, `/cart/add.js`, and `/cart/change.js`.
- Shows product image, title, variant, price, quantity controls, remove action, and live total.
- Closes with the close button, Escape key, or outside click.
- Updates the cart bubble and drawer contents live.

## Key Decisions

- Kept both features as isolated theme components instead of editing Dawn's main collection grid or default cart drawer.
- Used OS 2.0 schema settings for merchant-controlled labels, layout, quick add, color scheme, and drawer copy.
- Used Shopify's server-rendered product cards for the filterable collection so image loading, quick add, prices, and responsive card behavior stay close to Dawn conventions.
- Made the custom cart drawer its own web component so it can work independently from Dawn's drawer implementation while still integrating with Dawn product forms.
- Removed the old duplicate customizer filter setup by relying on product metafield/tag data as the source of truth.

## Trade-offs

- Homepage native filters require fetching the selected collection route because Shopify only exposes some filter data on collection URLs.
- The custom drawer formats prices client-side with `Intl.NumberFormat`; for complex multi-currency formatting, a server-rendered price fragment could be more exact.
- Quick add for multi-variant products still uses Dawn's quick-add modal flow.

## Improvements With More Time

- Add richer handling for line item properties, selling plans, discounts, and unit prices in the custom drawer.
- Move more text to locale files for full translation coverage instead of only schema/customizer settings.
