import { createRoot } from "react-dom/client";
import { initI18n, type SupportedLanguage } from "@workspace/i18n";
import App from "./App";
import "./index.css";

// Initialize language from localStorage or browser locale
const savedLang = localStorage.getItem("kin_language");
if (savedLang === "en" || savedLang === "rw") {
  initI18n(savedLang as SupportedLanguage);
} else {
  const browserLang = navigator.language?.slice(0, 2);
  initI18n(browserLang === "rw" ? "rw" : "en");
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
