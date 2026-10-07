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
  gold: "#f6b72f",
  ink: "#173f48",
  muted: "#688087",
  surface: "#f4f8f8",
  white: "#ffffff",
  danger: "#b43b35"
};

const MOBILE_POLISH_SCRIPT = `
  (function () {
    document.documentElement.dataset.innovexMobileApp = 'true';
    window.__INNOVEX_MOBILE_APP__ = { platform: 'native', version: '1.0.0' };
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    if (!document.getElementById('innovex-native-mobile-polish')) {
      var style = document.createElement('style');
      style.id = 'innovex-native-mobile-polish';
      style.textContent = [
        'html,body,#root{max-width:100%;min-width:0;overflow-x:hidden}',
        '.admin-main-v2,.admin-content-v2,.admin-content-v2>*{min-width:0;max-width:100%}',
        '@media(max-width:700px){',
        '.admin-content-v2{padding:10px!important}',
        'input,select,textarea{font-size:16px!important}',
        '.modal,.dialog,[role="dialog"]{max-width:100vw!important}',
        '.workspace-section-hero,.ats-hero,.dashboard-hero-v2{border-radius:16px!important}',
        '}'
      ].join('');
      (document.head || document.documentElement).appendChild(style);
    }
  })(); true;
`;

export default function WorkspaceScreen() {
  const webView = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
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
    setOffline(false);
  }

  function allowNavigation(request: { url: string }) {
    if (request.url === "about:blank" || request.url.startsWith("blob:") || isInnovexUrl(request.url)) return true;
    Linking.openURL(request.url).catch(() => undefined);
    return false;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
          applicationNameForUserAgent="InnovexWorkspace/1.0"
          injectedJavaScriptBeforeContentLoaded={MOBILE_POLISH_SCRIPT}
          injectedJavaScript={MOBILE_POLISH_SCRIPT}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLOURS.navy },
  content: { flex: 1, minWidth: 0, backgroundColor: COLOURS.surface },
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
  privacyCopy: { marginTop: 7, color: "#a4c2c5", fontSize: 12 }
});
