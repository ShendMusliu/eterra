// src/App.tsx
import React, { Suspense } from "react";
import AppRouter from "./routes/AppRouter";
import LanguageSwitcherFAB from "./components/LanguageSwitcherFAB";
import Loader from "./components/Loader";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <>
      <Suspense fallback={<Loader variant="fullscreen" />}>
        <AppRouter />
        {/* Floating, auto-hiding language switcher (mobile-first) */}
        <LanguageSwitcherFAB />
      </Suspense>
      <Toaster />
    </>
  );
}
