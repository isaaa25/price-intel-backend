// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import Competitors from "./pages/Competitors";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";   // <-- Import Reports
import Account from "./pages/Account";   // <-- Import Account
import Settings from "./pages/Settings";
import Help from "./pages/help";         // <-- Import Help

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/add" element={<AddProduct />} />
        <Route path="/competitors" element={<Competitors />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />   {/* <-- New Route */}
        <Route path="/account" element={<Account />} />   {/* <-- New Route */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />         {/* <-- New Route */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
