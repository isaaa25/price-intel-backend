import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStores } from "../api/products";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(() => {
    try {
      const saved = localStorage.getItem("selected_store");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStores([]);
      setSelectedStore(null);
      setLoading(false);
      localStorage.removeItem("selected_store");
      localStorage.removeItem("selected_store_id");
      return [];
    }

    setLoading(true);
    try {
      const data = await getStores();
      const storeList = Array.isArray(data) ? data : [];
      setStores(storeList);

      if (storeList.length > 0) {
        const savedId = localStorage.getItem("selected_store_id");
        // Check if saved store id matches any loaded store
        let active = storeList.find((s) => String(s.id) === String(savedId));

        // If not found, check if existing selectedStore in state matches any store in storeList
        if (!active && selectedStore?.id) {
          active = storeList.find((s) => String(s.id) === String(selectedStore.id));
        }

        // If still not found, default to the first store in the list
        if (!active) {
          active = storeList[0];
        }

        setSelectedStore(active);
        localStorage.setItem("selected_store_id", String(active.id));
        localStorage.setItem("selected_store", JSON.stringify(active));
      } else {
        setSelectedStore(null);
        localStorage.removeItem("selected_store_id");
        localStorage.removeItem("selected_store");
      }
      return storeList;
    } catch (err) {
      console.error("[StoreContext] Failed to fetch stores:", err);
      if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
        setStores([]);
        setSelectedStore(null);
        localStorage.removeItem("selected_store_id");
        localStorage.removeItem("selected_store");
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedStore?.id]);

  useEffect(() => {
    fetchStores();

    // Re-check whenever window regains focus, storage changes (e.g. login/logout), or auth state changes
    const handleSync = () => {
      fetchStores();
    };

    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("auth_state_changed", handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("auth_state_changed", handleSync);
    };
  }, [fetchStores]);

  // Fallback sync: if stores exist but no active store is selected, automatically select the first store
  useEffect(() => {
    if (stores.length > 0 && !selectedStore?.id) {
      const savedId = localStorage.getItem("selected_store_id");
      const active = stores.find((s) => String(s.id) === String(savedId)) || stores[0];
      setSelectedStore(active);
      localStorage.setItem("selected_store_id", String(active.id));
      localStorage.setItem("selected_store", JSON.stringify(active));
    }
  }, [stores, selectedStore]);

  const handleSelectStore = useCallback((store) => {
    if (!store) {
      setSelectedStore(null);
      localStorage.removeItem("selected_store_id");
      localStorage.removeItem("selected_store");
      return;
    }
    setSelectedStore(store);
    if (store?.id) {
      localStorage.setItem("selected_store_id", String(store.id));
      localStorage.setItem("selected_store", JSON.stringify(store));
    }
    window.dispatchEvent(new CustomEvent("store_changed", { detail: store }));
  }, []);

  const currency =
    selectedStore?.country === "PK" ||
    selectedStore?.country === "Pakistan" ||
    selectedStore?.marketplace === "daraz"
      ? "PKR"
      : "AED";

  return (
    <StoreContext.Provider
      value={{
        stores,
        selectedStore,
        setSelectedStore: handleSelectStore,
        refreshStores: fetchStores,
        loading,
        currency,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    return {
      stores: [],
      selectedStore: null,
      setSelectedStore: () => {},
      refreshStores: () => Promise.resolve([]),
      loading: false,
      currency: "PKR",
    };
  }
  return context;
}

