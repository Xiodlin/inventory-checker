import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import WebView from 'react-native-webview';
import { extractShoppingCards, isPublicShoppingURL, isShoppingNavigation, shoppingBlocked, shoppingURL } from '@inventory-checker/core';
import { shoppingBrowser } from '../services/shoppingBrowser';

export default function ShoppingBrowser() {
  const [request, setRequest] = useState(shoppingBrowser.current);
  const browser = useRef<WebView>(null);
  useEffect(() => {
    const unsubscribe = shoppingBrowser.subscribe(() => setRequest(shoppingBrowser.current()));
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') shoppingBrowser.cancel();
    });
    return () => { unsubscribe(); listener.remove(); shoppingBrowser.cancel(); };
  }, []);
  if (!request) return null;
  const fail = (error: string) => shoppingBrowser.finish(request.id, undefined, error);
  const script = `(() => {
    if (window.__inventoryShoppingProbe) return;
    window.__inventoryShoppingProbe = true;
    const extract = ${extractShoppingCards.toString()};
    const blocked = ${shoppingBlocked.toString()};
    let attempts = 0;
    const probe = () => {
      try {
        if (blocked(location.href, document.body?.innerText?.slice(0, 20000) ?? '')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Google requires verification or consent. Search stopped without bypassing it.' }));
          return;
        }
        const cards = extract();
        if (cards.length) { window.ReactNativeWebView.postMessage(JSON.stringify({ cards })); return; }
        if (++attempts < 12) setTimeout(probe, 1000);
        else window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'No readable shopping offers found. Google may have changed its layout or withheld results.' }));
      } catch (error) { window.ReactNativeWebView.postMessage(JSON.stringify({ error: String(error) })); }
    };
    probe();
  })(); true;`;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', width: 1024, height: 800, opacity: 0, zIndex: -1 }}>
    <WebView key={request.id} ref={browser} source={{ uri: shoppingURL(request.input).href }}
      incognito cacheEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
      javaScriptEnabled domStorageEnabled={false} geolocationEnabled={false}
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never" setSupportMultipleWindows allowsInlineMediaPlayback={false}
      mediaPlaybackRequiresUserAction mediaCapturePermissionGrantType="deny" originWhitelist={['*']}
      onShouldStartLoadWithRequest={navigation => {
        if (navigation.isTopFrame === false) return isPublicShoppingURL(navigation.url);
        if (navigation.url === 'about:blank') return true;
        if (AppState.currentState === 'active' && isShoppingNavigation(navigation.url)) return true;
        fail('Google redirected to verification, consent, or an unsupported page. Search stopped without bypassing it.');
        return false;
      }}
      onNavigationStateChange={navigation => {
        if (navigation.url && !isShoppingNavigation(navigation.url) && navigation.url !== 'about:blank') {
          browser.current?.stopLoading(); fail('Google left the allowed search page. No availability was inferred.');
        }
      }}
      onOpenWindow={() => fail('Google requested a separate window. Search stopped.')}
      onFileDownload={() => fail('Downloads are not allowed during shopping searches.')}
      onHttpError={event => fail(`Google returned HTTP ${event.nativeEvent.statusCode}. No availability was inferred.`)}
      onError={event => {
        if (event.nativeEvent.code !== -999) fail(`Google browser error: ${event.nativeEvent.description}`);
      }}
      onContentProcessDidTerminate={() => fail('Google browser process terminated. Search failed.')}
      onRenderProcessGone={() => fail('Google browser process terminated. Search failed.')}
      onLoadEnd={() => browser.current?.injectJavaScript(script)}
      onMessage={event => {
        if (!isShoppingNavigation(event.nativeEvent.url) || event.nativeEvent.data.length > 1024 * 1024) {
          fail('Google returned invalid shopping data.'); return;
        }
        try {
          const value: { cards?: unknown; error?: unknown } = JSON.parse(event.nativeEvent.data);
          shoppingBrowser.finish(request.id, value.cards,
            typeof value.error === 'string' ? value.error.slice(0, 500) : null);
        } catch (error) { fail(error instanceof Error ? error.message : 'Invalid shopping response'); }
      }} />
  </View>;
}
