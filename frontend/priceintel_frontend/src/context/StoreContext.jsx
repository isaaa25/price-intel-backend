import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStores } from "../api/products";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
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
    } catch {
      setStores([]);
      setSelectedStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
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
