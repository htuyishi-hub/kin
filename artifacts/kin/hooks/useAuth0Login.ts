import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

const AUTH0_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? "";

const AUTH0_CLIENT_ID =
  process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? "";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "https://kin-x81d.onrender.com");


const redirectUri =
  Platform.OS === "web"
    ? `${window.location.origin}/callback`
    : AuthSession.makeRedirectUri({
        scheme: "kin",
        path: "callback",
      });


export type Auth0LoginResult =
  | {
      success: true;
      token: string;
      userId: string;
      isNewUser: boolean;
      onboardingComplete: boolean;
    }
  | {
      success: false;
      error: string;
      code:
        | "cancelled"
        | "not_configured"
        | "auth_failed"
        | "server_error";
    };


export function useAuth0Login(
  onResult: (result: Auth0LoginResult) => void
) {
  const discovery = AuthSession.useAutoDiscovery(
    `https://${AUTH0_DOMAIN}`
  );


  const [request, response, promptAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: AUTH0_CLIENT_ID,
        redirectUri,
        scopes: [
          "openid",
          "profile",
          "email",
        ],
        usePKCE: true,
      },
      discovery
    );


  useEffect(() => {
    async function handleResponse() {
      if (!response || !discovery) return;


      if (
        response.type === "cancel" ||
        response.type === "dismiss"
      ) {
        onResult({
          success: false,
          error: "Cancelled",
          code: "cancelled",
        });

        return;
      }


      if (response.type === "error") {
        onResult({
          success:false,
          error:
            response.error?.message ??
            "Auth error",
          code:"auth_failed",
        });

        return;
      }


      if (response.type === "success") {

        const code =
          response.params.code;


        const savedVerifier =
          await AsyncStorage.getItem(
            "auth0_code_verifier"
          );


        const verifier =
          request?.codeVerifier ??
          savedVerifier;


        if (!code || !verifier) {

          onResult({
            success:false,
            error:"Missing authorization code",
            code:"auth_failed",
          });

          return;
        }


        try {

          const tokens =
            await AuthSession.exchangeCodeAsync(
              {
                clientId:
                  AUTH0_CLIENT_ID,

                code,

                redirectUri,

                extraParams:{
                  code_verifier:
                    verifier,
                },
              },

              discovery
            );


          const result =
            await exchangeWithBackend(
              tokens.accessToken
            );


          await AsyncStorage.removeItem(
            "auth0_code_verifier"
          );


          onResult(result);


        } catch {

          onResult({
            success:false,
            error:"Token exchange failed",
            code:"auth_failed",
          });

        }
      }
    }


    handleResponse();

  }, [
    response,
    discovery,
    request,
  ]);



  const login = useCallback(
    async () => {

      if (
        !AUTH0_DOMAIN ||
        !AUTH0_CLIENT_ID
      ) {

        onResult({
          success:false,
          error:"Auth0 not configured",
          code:"not_configured",
        });

        return;
      }



      if (request?.codeVerifier) {

        await AsyncStorage.setItem(
          "auth0_code_verifier",
          request.codeVerifier
        );

      }


      await AsyncStorage.setItem(
        "auth0_redirect_uri",
        redirectUri
      );


      await promptAsync();

    },

    [
      request,
      promptAsync,
    ]
  );



  return {
    login,
    ready:
      !!request &&
      !!discovery,
  };
}



async function exchangeWithBackend(
  accessToken:string
):Promise<Auth0LoginResult>{

  try {

    const res =
      await fetch(
        `${BASE_URL}/api/auth/auth0`,
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              accessToken,
            }),
        }
      );


    const data =
      await res.json();



    if(!res.ok){

      return {
        success:false,
        error:
          data.message ??
          "Server error",
        code:"server_error",
      };

    }



    return {

      success:true,

      token:
        data.token,

      userId:
        data.userId,

      isNewUser:
        data.isNewUser,

      onboardingComplete:
        data.onboardingComplete,
    };


  } catch {

    return {
      success:false,
      error:"Network error",
      code:"server_error",
    };

  }
}