import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStores } from "../api/products";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStores([]);
      setSelectedStore(null);
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      const data = await getStores();
      const storeList = Array.isArray(data) ? data : [];
      setStores(storeList);
      if (storeList.length > 0) {
        const savedId = localStorage.getItem("selected_store_id");
        const found = storeList.find((s) => String(s.id) === String(savedId));
        const active = found || storeList[0];
        setSelectedStore(active);
        localStorage.setItem("selected_store_id", String(active.id));
      } else {
        setSelectedStore(null);
        localStorage.removeItem("selected_store_id");
      }
      return storeList;
    } catch {
      setStores([]);
      setSelectedStore(null);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();

    // Re-check whenever window regains focus or storage changes (e.g. login)
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

  const handleSelectStore = (store) => {
    setSelectedStore(store);
    if (store?.id) {
      localStorage.setItem("selected_store_id", String(store.id));
    } else {
      localStorage.removeItem("selected_store_id");
    }
  };

  const currency = selectedStore?.country === "PK" || selectedStore?.country === "Pakistan" || selectedStore?.marketplace === "daraz" ? "PKR" : "AED";

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
      refreshStores: () => {},
      loading: false,
      currency: "PKR",
    };
  }
  return context;
}
