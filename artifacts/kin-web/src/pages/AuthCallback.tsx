import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchProfileRouting } from '@/lib/authService';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { setSession, signIn } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: any = null;
    let activeSubscription: { unsubscribe: () => void } | null = null;

    async function handleAuth() {
      try {
        // 1. Check for PKCE authorization code in URL query params
        if (typeof window !== 'undefined' && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const errorParam = params.get('error_description') || params.get('error');

          if (errorParam) {
            if (active) setError(errorParam);
            setTimeout(() => {
              if (active) setLocation('/signin');
            }, 2500);
            return;
          }

          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.warn('[AuthCallback] exchangeCodeForSession error:', exchangeError.message);
            } else if (data.session && active) {
              await setSession(data.session);
              await signIn(data.session.access_token, data.session.user.id);
              const routing = await fetchProfileRouting(data.session.user.id);
              if (active) {
                if (routing.onboardingComplete) {
                  setLocation('/app');
                } else {
                  setLocation('/onboarding/personal');
                }
              }
              return;
            }
          }
        }

        // 2. Check for current session (e.g. from implicit hash #access_token)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[AuthCallback] getSession error:', sessionError.message);
        }

        if (session?.user && active) {
          await setSession(session);
          await signIn(session.access_token, session.user.id);
          const routing = await fetchProfileRouting(session.user.id);
          if (active) {
            if (routing.onboardingComplete) {
              setLocation('/app');
            } else {
              setLocation('/onboarding/personal');
            }
          }
          return;
        }

        // 3. Listen for onAuthStateChange in case token parsing is asynchronous
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user && active) {
            if (activeSubscription) {
              activeSubscription.unsubscribe();
              activeSubscription = null;
            }
            await setSession(newSession);
            await signIn(newSession.access_token, newSession.user.id);
            const routing = await fetchProfileRouting(newSession.user.id);
            if (active) {
              if (routing.onboardingComplete) {
                setLocation('/app');
              } else {
                setLocation('/onboarding/personal');
              }
            }
          }
        });
        activeSubscription = subscription;

        // 4. Fallback timeout if no session resolves within 4s
        timer = setTimeout(() => {
          if (active) {
            if (activeSubscription) {
              activeSubscription.unsubscribe();
              activeSubscription = null;
            }
            setLocation('/signin');
          }
        }, 4000);
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Authentication error');
          setTimeout(() => {
            if (active) setLocation('/signin');
          }, 2000);
        }
      }
    }

    handleAuth();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (activeSubscription) activeSubscription.unsubscribe();
    };
  }, [setSession, signIn, setLocation]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 bg-[#0D1117] text-[#F0EDE6] select-none">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-[#C9A84C] animate-spin" />
        <span className="text-sm font-medium text-[#8B949E]">
          {error || t('common.loading')}
        </span>
      </div>
    </div>
  );
}
