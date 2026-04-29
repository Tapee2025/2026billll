import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import FillInvoicePage from "@/pages/FillInvoicePage";
import SettingsPage from "@/pages/SettingsPage";
import { Printer, Settings as SettingsIcon, FileText } from "lucide-react";

function Header() {
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1
              className="text-lg font-bold tracking-tight"
              data-testid="app-title"
            >
              Invoice Overlay Printer
            </h1>
            <p className="text-xs text-muted-foreground mono">
              A4 · Pre-printed invoice filler
            </p>
          </div>
        </div>
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
      </div>
    </header>
  );
}

function App() {
  return (
    <div className="App paper-bg">
      <BrowserRouter>
        <Header />
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
