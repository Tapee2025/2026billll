import React, { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import FillInvoicePage from "@/pages/FillInvoicePage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import { LogOut, Settings as SettingsIcon, FileText } from "lucide-react";

function Header({ onLogout }) {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-foreground/70 hover:bg-secondary hover:text-foreground"
    }`;

  return (
    <header
      className="border-b border-border bg-card"
      data-testid="app-header"
    >
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex items-center gap-2" data-testid="main-nav">
          <NavLink to="/" end className={linkClass} data-testid="nav-fill">
            <FileText className="w-4 h-4" />
            Fill Invoice
          </NavLink>
          <NavLink
            to="/settings"
            className={linkClass}
            data-testid="nav-settings"
          >
            <SettingsIcon className="w-4 h-4" />
            Print Field Settings
          </NavLink>
        </nav>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </header>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  const handleLogin = () => setAuthenticated(true);

  const handleLogout = () => {
    setAuthenticated(false);
  };

  if (!authenticated) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <div className="App paper-bg">
      <BrowserRouter>
        <Header onLogout={handleLogout} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<FillInvoicePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
