import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { KLogo } from "@/components/KLogo";
import { Colors } from "@/constants/colors";
import { useGetMe } from "@workspace/api-client-react";

import { useAuth } from "@/contexts/AuthContext";

export default function SeriousScreen() {
  const insets   = useSafeAreaInsets();
  const { token, isLoading: authLoading } = useAuth();

  const { data: profile } = useGetMe({
    query: { enabled: !authLoading && !!token },
  } as any);

  const tokens   = profile?.tokensRemaining ?? 0;
  const tabBarH  = Platform.OS === "ios" ? 80 : 64;
  const paddingT = insets.top + 16;
  const paddingB = tabBarH + insets.bottom + 24;

  return (
    <View style={[styles.container, { paddingTop: paddingT, paddingBottom: paddingB }]}>
      <View style={styles.header}>
        <KLogo size={24} color={Colors.gold} />
        <Text style={styles.headerTitle}>Serious</Text>
        {tokens > 0 && (
          <View style={styles.tokenBadge}>
            <Text style={styles.tokenCount}>{tokens}</Text>
          </View>
        )}
      </View>

      {tokens === 0 ? (
        <View style={styles.gateContent}>
          {/* Blurred profile circles teaser */}
          <View style={styles.blurredProfiles}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.blurCircle,
                  { marginLeft: i > 0 ? -16 : 0, zIndex: 3 - i },
                ]}
              />
            ))}
          </View>

          <Text style={styles.gateTitle}>
            Serious, marriage-minded people are waiting here.
          </Text>

          <Text style={styles.gateSubtitle}>
            3 Connection Tokens = 1,000 RWF
          </Text>

          <TouchableOpacity style={styles.tokenBtn} activeOpacity={0.85}>
            <View style={styles.momoDot} />
            <Text style={styles.tokenBtnText}>Get 3 Tokens via MTN MoMo</Text>
          </TouchableOpacity>

          <Text style={styles.gateFooter}>
            Tokens give you 3 respectful introductions.{"\n"}Not a subscription.
          </Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.comingSoon}>Your serious queue will appear here.</Text>
        </View>
      )}
    </View>
  );
}

const CIRCLE = 72;

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.night,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    marginBottom:  32,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   18,
    color:      Colors.bone,
    flex:       1,
  },
  tokenBadge: {
    backgroundColor: Colors.gold,
    borderRadius:    12,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  tokenCount: {
    fontFamily: "Inter_700Bold",
    fontSize:   13,
    color:      Colors.night,
  },
  gateContent: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             20,
  },
  blurredProfiles: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   8,
  },
  blurCircle: {
    width:           CIRCLE,
    height:          CIRCLE,
    borderRadius:    CIRCLE / 2,
    backgroundColor: Colors.inkRaised,
    borderWidth:     3,
    borderColor:     Colors.night,
  },
  gateTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize:   20,
    color:      Colors.bone,
    textAlign:  "center",
    lineHeight: 28,
  },
  gateSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      Colors.boneDim,
    textAlign:  "center",
  },
  tokenBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius:    999,
    marginTop:       8,
  },
  momoDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: Colors.night,
    opacity:         0.6,
  },
  tokenBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   15,
    color:      Colors.night,
  },
  gateFooter: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      Colors.boneDim,
    textAlign:  "center",
    lineHeight: 20,
  },
  center: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
  },
  comingSoon: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      Colors.boneDim,
    textAlign:  "center",
  },
});
