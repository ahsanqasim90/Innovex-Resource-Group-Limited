import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { isInnovexUrl, WORKSPACE_URL } from "./config";

const COLOURS = {
  navy: "#063f4f",
  teal: "#0b8179",
  aqua: "#7ad9d2",
  gold: "#f6b72f",
  ink: "#173f48",
  muted: "#688087",
  surface: "#f4f8f8",
  white: "#ffffff",
  danger: "#b43b35"
};

export default function WorkspaceScreen() {
  const webView = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WORKSPACE_URL);
  const [appHidden, setAppHidden] = useState(false);

  const goBack = useCallback(() => {
    if (canGoBack) webView.current?.goBack();
  }, [canGoBack]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      goBack();
      return true;
    });
    const state = AppState.addEventListener("change", (next) => setAppHidden(next !== "active"));
    return () => {
      back.remove();
      state.remove();
    };
  }, [canGoBack, goBack]);

  function onNavigationStateChange(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    setCurrentUrl(nav.url);
    setOffline(false);
  }

  function allowNavigation(request: { url: string }) {
    if (request.url === "about:blank" || request.url.startsWith("blob:") || isInnovexUrl(request.url)) return true;
    Linking.openURL(request.url).catch(() => undefined);
    return false;
  }

  const atLogin = currentUrl.includes("/admin/login");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>I</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.eyebrow}>INNOVEX</Text>
          <Text style={styles.title}>Workspace</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={!canGoBack}
            onPress={goBack}
            style={({ pressed }) => [styles.iconButton, !canGoBack && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open workspace home"
            onPress={() => webView.current?.injectJavaScript(`window.location.assign('${WORKSPACE_URL}'); true;`)}
            style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
          >
            <Text style={styles.homeText}>Home</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload"
            onPress={() => webView.current?.reload()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.reloadText}>↻</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <WebView
          ref={webView}
          source={{ uri: WORKSPACE_URL }}
          style={styles.webView}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={allowNavigation}
          onLoadStart={() => { setLoading(true); setOffline(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setOffline(true); }}
          onHttpError={(event: { nativeEvent: { statusCode: number } }) => {
            if (event.nativeEvent.statusCode >= 500) setOffline(true);
          }}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          allowsLinkPreview={false}
          pullToRefreshEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction
          setSupportMultipleWindows={false}
          applicationNameForUserAgent="InnovexWorkspace-iOS/1.0"
          injectedJavaScriptBeforeContentLoaded={`
            (function () {
              document.documentElement.dataset.innovexMobileApp = 'ios';
              window.__INNOVEX_MOBILE_APP__ = { platform: 'ios', version: '1.0.0' };
            })(); true;
          `}
        />

        {loading && !offline && (
          <View pointerEvents="none" style={styles.loadingBar}>
            <ActivityIndicator color={COLOURS.teal} size="small" />
            <Text style={styles.loadingText}>Opening secure workspace…</Text>
          </View>
        )}

        {offline && (
          <View style={styles.errorPanel}>
            <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
            <Text style={styles.errorTitle}>Workspace unavailable</Text>
            <Text style={styles.errorCopy}>Check your internet connection, then try opening Innovex again.</Text>
            <Pressable onPress={() => webView.current?.reload()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {appHidden && <View style={styles.privacyShield}><Text style={styles.privacyTitle}>Innovex Workspace</Text><Text style={styles.privacyCopy}>Protected while the app is in the background</Text></View>}
      </View>

      {!offline && (
        <View style={styles.securityBar}>
          <View style={styles.securityDot} />
          <Text style={styles.securityText}>{atLogin ? "Secure sign in" : "Secure Innovex session"}</Text>
          <Text style={styles.securityDomain}>innovexresourcegroup.co.uk</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLOURS.navy },
  header: { minHeight: 60, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", backgroundColor: COLOURS.navy, borderBottomColor: "rgba(255,255,255,.1)", borderBottomWidth: StyleSheet.hairlineWidth },
  brandMark: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.white },
  brandLetter: { color: COLOURS.teal, fontWeight: "900", fontSize: 18 },
  brandCopy: { marginLeft: 9, flex: 1 },
  eyebrow: { color: COLOURS.aqua, fontSize: 8, letterSpacing: 2, fontWeight: "900" },
  title: { color: COLOURS.white, fontSize: 16, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(255,255,255,.06)" },
  homeButton: { height: 36, paddingHorizontal: 12, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.teal },
  homeText: { color: COLOURS.white, fontSize: 12, fontWeight: "800" },
  iconText: { color: COLOURS.white, fontSize: 27, lineHeight: 29, fontWeight: "500" },
  reloadText: { color: COLOURS.white, fontSize: 21, fontWeight: "600" },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  content: { flex: 1, backgroundColor: COLOURS.surface },
  webView: { flex: 1, backgroundColor: COLOURS.surface },
  loadingBar: { position: "absolute", top: 13, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: COLOURS.white, shadowColor: "#00181e", shadowOpacity: 0.16, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  loadingText: { color: COLOURS.ink, fontSize: 12, fontWeight: "700" },
  errorPanel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 34, backgroundColor: COLOURS.surface },
  errorIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fee5e3" },
  errorIconText: { color: COLOURS.danger, fontSize: 28, fontWeight: "900" },
  errorTitle: { marginTop: 18, color: COLOURS.ink, fontSize: 23, fontWeight: "900" },
  errorCopy: { marginTop: 8, maxWidth: 290, color: COLOURS.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  retryButton: { marginTop: 23, minWidth: 150, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 13, alignItems: "center", backgroundColor: COLOURS.gold },
  retryText: { color: COLOURS.navy, fontSize: 14, fontWeight: "900" },
  privacyShield: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.navy },
  privacyTitle: { color: COLOURS.white, fontSize: 25, fontWeight: "900" },
  privacyCopy: { marginTop: 7, color: "#a4c2c5", fontSize: 12 },
  securityBar: { minHeight: 32, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: COLOURS.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#d7e4e5" },
  securityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLOURS.teal },
  securityText: { color: COLOURS.ink, fontSize: 10, fontWeight: "800" },
  securityDomain: { marginLeft: "auto", color: COLOURS.muted, fontSize: 9 }
});
