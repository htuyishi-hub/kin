import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MobileShell } from "@/components/layout/MobileShell";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

// Mobile Screen Replicas
import WelcomeScreen from "@/pages/WelcomeScreen";
import EmailScreen from "@/pages/EmailScreen";
import SignInScreen from "@/pages/SignInScreen";
import ForgotAccountScreen from "@/pages/ForgotAccountScreen";
import OtpScreen from "@/pages/OtpScreen";
import OnboardingPersonal from "@/pages/OnboardingPersonal";
import OnboardingOccupation from "@/pages/OnboardingOccupation";
import OnboardingUr from "@/pages/OnboardingUr";
import OnboardingVouch from "@/pages/OnboardingVouch";
import OnboardingPrompts from "@/pages/OnboardingPrompts";
import OnboardingWaiting from "@/pages/OnboardingWaiting";
import AppScreen from "@/pages/AppScreen";

// Marketing & Fallback Pages
import Home from "@/pages/home";
import Terms from "@/pages/terms";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const isMarketingRoute = location === "/landing" || location === "/terms";

  if (isMarketingRoute) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1">
          <Switch>
            <Route path="/landing" component={Home} />
            <Route path="/terms" component={Terms} />
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
        <Route path="/signup" component={EmailScreen} />
        <Route path="/signin" component={SignInScreen} />
        <Route path="/forgot-account" component={ForgotAccountScreen} />
        <Route path="/otp" component={OtpScreen} />
        <Route path="/onboarding/personal" component={OnboardingPersonal} />
        <Route path="/onboarding/occupation" component={OnboardingOccupation} />
        <Route path="/onboarding/ur" component={OnboardingUr} />
        <Route path="/onboarding/vouch" component={OnboardingVouch} />
        <Route path="/onboarding/prompts" component={OnboardingPrompts} />
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
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;