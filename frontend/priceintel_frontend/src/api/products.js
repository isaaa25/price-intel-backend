import apiRequest from "./client";

/**
 * Fetch all stores belonging to the logged-in user.
 * Backend: GET /stores/
 * Returns: StoreResponse[]  { id, marketplace, country, store_name, store_url, is_active }
 */
export function getStores() {
  return apiRequest("/stores/");
}

/**
 * Fetch all tracked products belonging to the logged-in user.
 * Backend: GET /products/
 * Returns: ProductResponse[]
 */
export function getProducts() {
  return apiRequest("/products/");
}

/**
 * Fetch products filtered by a specific store.
 * Backend: GET /products/?store_id=<storeId>
 * @param {string|number} storeId
 * Returns: ProductResponse[]
 */
export function getProductsByStore(storeId) {
  return apiRequest(`/products/?store_id=${encodeURIComponent(storeId)}`);
}

/**
 * Create a new tracked product under a store.
 * Backend: POST /products/
 * @param {{ store_id: string, title: string, own_url: string, own_cost: number, category: string|null }} payload
 * Returns: ProductResponse { id, store_id, title, own_url, own_cost, category, search_keyword, is_active }
 */
export function createProduct(payload) {
  return apiRequest("/products/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a tracked product by ID.
 * Backend: DELETE /products/{productId}
 */
export function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, {
    method: "DELETE",
  });
}

/**
 * Fetch pricing KPIs for a single product.
 * Backend: GET /products/{productId}/kpis
 * Returns: { own_price, cheapest_competitor, num_competitors, is_cheapest }
 */
export function getProductKpis(productId) {
  return apiRequest(`/products/${productId}/kpis`);
}

/**
 * Fetch a single product by ID.
 * Backend: GET /products/{productId}
 * Returns: ProductResponse
 */
export function getProduct(productId) {
  return apiRequest(`/products/${productId}`);
}

/**
 * Fetch competitor listings for a product (with latest price).
 * Backend: GET /products/{productId}/competitors
 * Returns: Array of { id, url, platform, name, image_url, latest_price, last_scraped_at }
 */
export function getProductCompetitors(productId) {
  return apiRequest(`/products/${productId}/competitors`);
}

/**
 * Fetch portfolio health for a specific store.
 * Backend: GET /products/portfolio/health?store_id=<storeId>
 * @param {string|number} storeId
 * Returns: PortfolioHealthResponsex
 */
export function getPortfolioHealth(storeId) {
  return apiRequest(`/products/portfolio/health?store_id=${encodeURIComponent(storeId)}`);
}