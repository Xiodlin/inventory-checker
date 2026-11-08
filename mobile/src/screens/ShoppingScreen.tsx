import { useCallback, useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ShoppingInput, ShoppingSearch, ShoppingWatch } from '@inventory-checker/core';
import { localRuntime } from '../services/localRuntime';
import { shoppingBrowser } from '../services/shoppingBrowser';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';

export default function ShoppingScreen() {
  const { revision } = useSession();
  const [product, setProduct] = useState('');
  const [variants, setVariants] = useState('');
  const [example, setExample] = useState('');
  const [watches, setWatches] = useState<ShoppingWatch[]>([]);
  const [selected, setSelected] = useState<ShoppingSearch>();
  const [interval, setIntervalMinutes] = useState<number>();
  const [automatic, setAutomatic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const refresh = useCallback(async () => {
    const { store, shopping } = await localRuntime();
    const [saved, settings] = await Promise.all([shopping.watches(), store.settings()]);
    setWatches(saved); setIntervalMinutes(settings.check_interval_minutes); setAutomatic(settings.background_enabled);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh().catch(failure => setError(errorMessage(failure)));
  }, [refresh, revision]));
  const input = (): ShoppingInput => ({ product, variants: variants.split(',').map(value => value.trim()).filter(Boolean),
    ...(example.trim() ? { example_url: example.trim() } : {}) });
  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}>
    <Text style={ui.label}>Find this product · experimental</Text>
    <Text>Google receives your search and IP address. No API key or server is required. Blocked or unreadable pages are errors, not evidence of no stock.</Text>
    <Text style={ui.label}>Product / model name</Text>
    <TextInput style={ui.input} value={product} onChangeText={setProduct} maxLength={150} editable={!busy} placeholder="MacBook Neo" />
    <Text style={ui.label}>Required variant phrases, comma-separated</Text>
    <TextInput style={ui.input} value={variants} onChangeText={setVariants} maxLength={800} editable={!busy} placeholder="256GB, Indigo" />
    <Text style={ui.label}>Example link (optional reference only)</Text>
    <TextInput style={ui.input} value={example} onChangeText={setExample} maxLength={2048} editable={!busy} autoCapitalize="none" />
    <Text>The example URL is saved, not fetched. Specify the model and variants explicitly. Required title text is not proof of an exact SKU.</Text>
    <Button title={busy ? 'Working…' : 'Search Google Shopping'} disabled={busy} onPress={() => void action(async () => {
      setSelected(undefined); setUncertain(false);
      setSelected(await shoppingBrowser.search(input()));
    })} />
    <Button title="Save search for stock alerts" disabled={busy} onPress={() => void action(async () => {
      await (await localRuntime()).shopping.save(input());
    })} />
    {!!error && <Text style={ui.error} accessibilityRole="alert">{error}</Text>}
    {selected && <View style={{ gap: 10 }}>
      <Text style={ui.label}>{selected.input.product} · {selected.input.variants.join(', ')}</Text>
      <Text>Checked: {new Date(selected.checked_at).toLocaleString()}</Text>
      {selected.error ? <Text style={ui.error}>{selected.error}</Text> : <>
        <Text>Required text matches (not retailer-verified). Missing results do not prove out-of-stock inventory.</Text>
        {!selected.offers.some(offer => offer.match === 'text-match') && <Text>No offers established every required phrase.</Text>}
        {selected.offers.filter(offer => offer.match === 'text-match' || uncertain).map((offer, index) => <View key={index} style={{ gap: 4 }}>
          <Text style={ui.label}>{offer.title}</Text><Text>{offer.seller} · {offer.price}</Text>
          <Text>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}: {offer.availability_text}</Text>
          {!!offer.missing.length && <Text>Uncertain: {offer.missing.join('; ')}</Text>}
          <Text selectable>Offer link (copy): {offer.url}</Text>
        </View>)}
        <Button title={uncertain ? 'Hide uncertain matches' : 'Show uncertain matches'} onPress={() => setUncertain(value => !value)} />
      </>}
    </View>}
    <Text style={ui.label}>Saved search alerts</Text>
    <Text>Checks use the same {interval ?? 'configured'}-minute timer as retailer checks. {automatic ? 'Automatic checks enabled.' : 'Automatic checks disabled in Settings.'} Google searches run ONLY while this app is open and active. They cannot run during mobile background/sleep. Due searches catch up one at a time when you reopen the app.</Text>
    <Text>Searches with no matches keep checking. Only required-text matches explicitly reported in stock create alerts. Uncertain or unknown offers do not; unchanged stock reports do not repeat alerts. Errors retain the last successful result.</Text>
    {watches.map(watch => <View key={watch.id} style={{ gap: 8 }}>
      <Text style={ui.label}>{watch.input.product} · {watch.input.variants.join(', ')}</Text>
      <Text>Last checked: {watch.last_checked_at ? new Date(watch.last_checked_at).toLocaleString() : 'Pending check'}</Text>
      {!!watch.error && <Text style={ui.error}>{watch.error}</Text>}
      {watch.result && <Button title="Review last successful result" disabled={busy} onPress={() => { setSelected(watch.result!); setUncertain(false); }} />}
      <Button title="Delete saved search" disabled={busy} onPress={() => void action(async () => {
        await (await localRuntime()).shopping.remove(watch.id);
      })} />
    </View>)}
    <Text>Saved searches and their last successful results stay on this device until deleted and are not included in watchlist backups. Alerts remain in Notifications. The search browser uses a separate private session, not your browser login.</Text>
  </ScrollView>;
}
