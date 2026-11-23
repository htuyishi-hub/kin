import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation, getCurrentLanguage } from '@workspace/i18n';
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
        // 1. Check if Supabase client already parsed and established a session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        let session = existingSession;

        // 1b. Check for implicit grant tokens in hash fragment
        if (!session && typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            try {
              const { data } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data?.session) {
                session = data.session;
              }
            } catch {}
          }
        }

        // 2. If no session yet, check for PKCE code in query params
        if (!session && typeof window !== 'undefined' && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const errorParam = params.get('error_description') || params.get('error');

          if (errorParam) {
            if (active) setError(errorParam);
            timer = setTimeout(() => {
              if (active) setLocation('/signin');
            }, 2500);
            return;
          }

          const code = params.get('code');
          if (code) {
            try {
              const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              if (data?.session) {
                session = data.session;
              } else if (exchangeError) {
                console.warn('[AuthCallback] exchangeCodeForSession error:', exchangeError.message);
              }
            } catch {
              // Might have already been exchanged
            }
          }
        }

        // If session is obtained now, process it
        if (session?.user && active) {
          if (timer) clearTimeout(timer);
          await setSession(session);
          await signIn(session.access_token, session.user.id);
          try {
            await supabase.from('profiles').upsert(
              { id: session.user.id, language: getCurrentLanguage() },
              { onConflict: 'id' }
            );
          } catch {
            // non-fatal
          }
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

        // 3. Listen for onAuthStateChange
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user && active) {
            if (activeSubscription) {
              activeSubscription.unsubscribe();
              activeSubscription = null;
            }
            if (timer) clearTimeout(timer);
            await setSession(newSession);
            await signIn(newSession.access_token, newSession.user.id);
            try {
              await supabase.from('profiles').upsert(
                { id: newSession.user.id, language: getCurrentLanguage() },
                { onConflict: 'id' }
              );
            } catch {}
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

        // 4. Timeout fallback only if still unauthenticated after 5s
        timer = setTimeout(() => {
          if (active) {
            if (activeSubscription) {
              activeSubscription.unsubscribe();
              activeSubscription = null;
            }
            setLocation('/signin');
          }
        }, 5000);
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Authentication error');
          timer = setTimeout(() => {
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
