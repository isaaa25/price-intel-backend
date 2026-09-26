// src/mock/billingData.js
/**
 * FAKE / HARDCODED DATA ONLY — FRONTEND MOCK
 * Phase 1 Billing & Subscription Mock Data.
 * Will be replaced with real backend API in a future phase.
 */

export const BILLING_MOCK = {
  currentPlan: {
    name: "Professional",
    badge: "Active",
    price: "$49.00",
    interval: "month",
    description: "For growing businesses monitoring competitor prices.",
    nextBillingDate: "October 25, 2026",
    trackedProductsCount: 245,
    trackedProductsLimit: 500,
    priceChecksCount: 8420,
    priceChecksLimit: 10000,
  },
  usage: {
    trackedProducts: {
      used: 245,
      total: 500,
      percent: Math.round((245 / 500) * 100),
      label: "Tracked Products",
      unit: "products",
    },
    priceChecks: {
      used: 8420,
      total: 10000,
      percent: Math.round((8420 / 10000) * 100),
      label: "Price Checks",
      unit: "checks",
    },
  },
  paymentMethod: {
    brand: "Visa",
    last4: "4521",
    expiry: "08/28",
    isDefault: true,
  },
  billingHistory: [
    {
      id: "inv_001",
      date: "Sep 25, 2026",
      description: "Professional Plan",
      amount: "$49.00",
      status: "Paid",
    },
    {
      id: "inv_002",
      date: "Aug 25, 2026",
      description: "Professional Plan",
      amount: "$49.00",
      status: "Paid",
    },
    {
      id: "inv_003",
      date: "Jul 25, 2026",
      description: "Professional Plan",
      amount: "$49.00",
      status: "Paid",
    },
  ],
};
