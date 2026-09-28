import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  const fetchPromiseRef = useRef(null);

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

    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    setLoading(true);
    const promise = (async () => {
      try {
        const data = await getStores();
        const storeList = Array.isArray(data) ? data : [];
        setStores((prevStores) => {
          if (
            prevStores.length === storeList.length &&
            prevStores.every((s, i) => s.id === storeList[i]?.id && s.name === storeList[i]?.name)
          ) {
            return prevStores;
          }
          return storeList;
        });

        if (storeList.length > 0) {
          const savedId = localStorage.getItem("selected_store_id");
          const found = storeList.find((s) => String(s.id) === String(savedId));
          const active = found || storeList[0];
          setSelectedStore((prev) => {
            if (
              prev &&
              String(prev.id) === String(active.id) &&
              prev.name === active.name &&
              prev.country === active.country &&
              prev.marketplace === active.marketplace
            ) {
              return prev;
            }
            return active;
          });
          localStorage.setItem("selected_store_id", String(active.id));
          localStorage.setItem("selected_store", JSON.stringify(active));
        } else {
          setSelectedStore(null);
          localStorage.removeItem("selected_store_id");
          localStorage.removeItem("selected_store");
        }
        return storeList;
      } catch {
        setStores([]);
        setSelectedStore(null);
        return [];
      } finally {
        setLoading(false);
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = promise;
    return promise;
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
      localStorage.setItem("selected_store", JSON.stringify(store));
    } else {
      localStorage.removeItem("selected_store_id");
      localStorage.removeItem("selected_store");
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
