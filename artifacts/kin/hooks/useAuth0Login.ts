import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const AUTH0_DOMAIN    = process.env.EXPO_PUBLIC_AUTH0_DOMAIN    ?? '';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';
const BASE_URL        =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : 'https://kin-x81d.onrender.com');

// On web (Replit preview) use the hosted domain.
// On native builds use the custom scheme.
const redirectUri = Platform.OS === 'web'
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'localhost'}/callback`
  : AuthSession.makeRedirectUri({ scheme: 'kin', path: 'callback' });

export type Auth0LoginResult =
  | { success: true;  token: string; userId: string; isNewUser: boolean; onboardingComplete: boolean }
  | { success: false; error: string; code: 'cancelled' | 'not_configured' | 'auth_failed' | 'server_error' };

export function useAuth0Login(onResult: (result: Auth0LoginResult) => void) {
  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:    AUTH0_CLIENT_ID,
      redirectUri,
      scopes:      ['openid', 'profile', 'email'],
      usePKCE:     true,
    },
    discovery,
  );

  useEffect(() => {
    if (!response || !discovery) return;

    if (response.type === 'cancel' || response.type === 'dismiss') return;

    if (response.type === 'error') {
      onResult({ success: false, error: response.error?.message ?? 'Auth error', code: 'auth_failed' });
      return;
    }

    if (response.type === 'success') {
      const code = response.params['code'];
      if (!code || !request?.codeVerifier) {
        onResult({ success: false, error: 'Missing authorization code', code: 'auth_failed' });
        return;
      }

      AuthSession.exchangeCodeAsync(
        {
          clientId:    AUTH0_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery,
      )
        .then((tokens) => exchangeWithBackend(tokens.accessToken))
        .then(onResult)
        .catch(() => onResult({ success: false, error: 'Token exchange failed', code: 'auth_failed' }));
    }
  }, [response, discovery]);

  const login = useCallback(async () => {
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
      onResult({ success: false, error: 'Auth0 not configured', code: 'not_configured' });
      return;
    }
    await promptAsync();
  }, [request, promptAsync]);

  return { login, ready: !!request && !!discovery };
}

async function exchangeWithBackend(accessToken: string): Promise<Auth0LoginResult> {
  try {
    const res  = await fetch(`${BASE_URL}/api/auth/auth0`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ accessToken }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.message ?? 'Server error', code: 'server_error' };
    return {
      success:            true,
      token:              data.token,
      userId:             data.userId,
      isNewUser:          data.isNewUser,
      onboardingComplete: data.onboardingComplete,
    };
  } catch {
    return { success: false, error: 'Network error', code: 'server_error' };
  }
}
