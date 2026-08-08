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
