import React, { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MobileShell } from "@/components/layout/MobileShell";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

// Mobile Screen Replicas (Code-split)
const WelcomeScreen = lazy(() => import("@/pages/WelcomeScreen"));
const EmailScreen = lazy(() => import("@/pages/EmailScreen"));
const SignInScreen = lazy(() => import("@/pages/SignInScreen"));
const ForgotAccountScreen = lazy(() => import("@/pages/ForgotAccountScreen"));
const OtpScreen = lazy(() => import("@/pages/OtpScreen"));
const OnboardingPersonal = lazy(() => import("@/pages/OnboardingPersonal"));
const OnboardingOccupation = lazy(() => import("@/pages/OnboardingOccupation"));
const OnboardingUr = lazy(() => import("@/pages/OnboardingUr"));
const OnboardingInvite = lazy(() => import("@/pages/OnboardingInvite"));
const OnboardingWaiting = lazy(() => import("@/pages/OnboardingWaiting"));
const AppScreen = lazy(() => import("@/pages/AppScreen"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));

// Marketing & Fallback Pages (Code-split)
const Home = lazy(() => import("@/pages/home"));
const Terms = lazy(() => import("@/pages/terms"));
const DownloadPage = lazy(() => import("@/pages/DownloadPage"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function Router() {
  const [location, setLocation] = useLocation();
  const isMarketingHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "kinn.ink" || window.location.hostname === "www.kinn.ink");

  const hasAuthParams =
    typeof window !== "undefined" &&
    (window.location.search.includes("code=") ||
     window.location.search.includes("error=") ||
     window.location.hash.includes("access_token="));

  useEffect(() => {
    if (hasAuthParams && (location === "/" || location === "/welcome")) {
      setLocation("/auth/callback" + window.location.search + window.location.hash);
    }
  }, [hasAuthParams, location, setLocation]);

  const isMarketingRoute =
    !hasAuthParams &&
    (location === "/landing" ||
     location === "/terms" ||
     location === "/download" ||
     (isMarketingHost && location === "/"));

  if (isMarketingRoute) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/landing" component={Home} />
            <Route path="/terms" component={Terms} />
            <Route path="/download" component={DownloadPage} />
          </Switch>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <MobileShell>
      <Switch>
        <Route path="/" component={WelcomeScreen} />
        <Route path="/welcome" component={WelcomeScreen} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/callback" component={AuthCallback} />
        <Route path="/signup" component={EmailScreen} />
        <Route path="/signin" component={SignInScreen} />
        <Route path="/forgot-account" component={ForgotAccountScreen} />
        <Route path="/otp" component={OtpScreen} />
        <Route path="/onboarding/personal" component={OnboardingPersonal} />
        <Route path="/onboarding/occupation" component={OnboardingOccupation} />
        <Route path="/onboarding/ur" component={OnboardingUr} />
        <Route path="/onboarding/invite" component={OnboardingInvite} />
        <Route path="/onboarding/waiting" component={OnboardingWaiting} />
        <Route path="/app" component={AppScreen} />
        <Route component={NotFound} />
      </Switch>
    </MobileShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Suspense fallback={<div className="min-h-screen bg-[#0D1117]" />}>
              <Router />
            </Suspense>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;