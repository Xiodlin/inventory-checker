import { useCallback, useState, type ReactNode } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ShoppingWatch } from '@inventory-checker/core';
import { localRuntime } from '../services/localRuntime';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';
import CollapsibleSection from './CollapsibleSection';

export default function ShoppingDiscovery({ existingProducts, existingCount = 0 }: {
  existingProducts?: ReactNode; existingCount?: number;
}) {
  const { revision } = useSession();
  const [product, setProduct] = useState('');
  const [variants, setVariants] = useState('');
  const [example, setExample] = useState('');
  const [watches, setWatches] = useState<ShoppingWatch[]>([]);
  const [interval, setIntervalMinutes] = useState<number>();
  const [automatic, setAutomatic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    const { store, shopping } = await localRuntime();
    const [saved, settings] = await Promise.all([shopping.watches(), store.settings()]);
    setWatches(saved); setIntervalMinutes(settings.check_interval_minutes); setAutomatic(settings.background_enabled);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh().catch(failure => setError(errorMessage(failure)));
  }, [refresh, revision]));
  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <CollapsibleSection title="Add product · monitor offers across retailers">
      <Text>Describe the product and required variant. Google receives your search and IP address. Google's coverage does not include every retailer or product.</Text>
      <Text style={ui.label}>Product / model name</Text>
      <TextInput style={ui.input} value={product} onChangeText={setProduct} maxLength={150} editable={!busy} placeholder="MacBook Neo" />
      <Text style={ui.label}>Required variant phrases, comma-separated</Text>
      <TextInput style={ui.input} value={variants} onChangeText={setVariants} maxLength={800} editable={!busy} placeholder="256GB, Indigo" />
      <Text style={ui.label}>Example link (optional reference only)</Text>
      <TextInput style={ui.input} value={example} onChangeText={setExample} maxLength={2048} editable={!busy} autoCapitalize="none" />
      <Text>The link is saved, not fetched. Only required-text matches explicitly reported in stock create alerts. Availability is Google-reported, not retailer-verified.</Text>
      <Button title={busy ? 'Saving…' : 'Add product'} disabled={busy} onPress={() => {
        setMessage('');
        void action(async () => {
          await (await localRuntime()).shopping.save({ product,
            variants: variants.split(',').map(value => value.trim()).filter(Boolean),
            ...(example.trim() ? { example_url: example.trim() } : {}) });
          setProduct(''); setVariants(''); setExample('');
          setMessage('Product saved. Latest offers will appear in watchlist details after a check.');
        });
      }} />
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    </CollapsibleSection>
    {!!error && <Text style={ui.error} accessibilityRole="alert">{error}</Text>}
    <CollapsibleSection title={`Tracked products (${watches.length + existingCount})`} initiallyOpen>
      <Text>{automatic ? 'Automatic search checks enabled' : 'Automatic search checks paused'} · Every {interval ?? 'configured'} minutes. Google checks run only while the app is open and active.</Text>
      {!watches.length && !existingCount && <Text>No products yet. Add one above to start monitoring.</Text>}
      {watches.map(watch => <View key={watch.id} style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: '#aab8c5', borderRadius: 8 }}>
        <Text style={ui.label}>{watch.input.product} · {watch.input.variants.join(', ')}</Text>
        <Text>Google Shopping · Last checked: {watch.last_checked_at ? new Date(watch.last_checked_at).toLocaleString() : 'Pending check'}</Text>
        {!!watch.error && <Text style={ui.error}>{watch.error}</Text>}
        <CollapsibleSection title="Details and latest offers">
          {watch.result ? <>
            <Text>Last successful observation: {new Date(watch.result.checked_at).toLocaleString()}. Missing offers do not prove out-of-stock inventory.</Text>
            <Text style={ui.label}>Required text matches (not retailer-verified)</Text>
            {!watch.result.offers.some(offer => offer.match === 'text-match') && <Text>No offers established every required phrase.</Text>}
            {watch.result.offers.map((offer, index) => <CollapsibleSection key={index}
              title={`${offer.match === 'uncertain' ? 'Uncertain: ' : ''}${offer.title} · ${offer.price}`}>
              <Text>{offer.seller} · {offer.price}</Text>
              <Text>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}: {offer.availability_text}</Text>
              {!!offer.missing.length && <Text>Not established: {offer.missing.join('; ')}</Text>}
              {offer.details?.map((detail, index) => <Text key={index}>{detail}</Text>)}
              {offer.verification && <Text>
                {offer.verification.status === 'verified' ? `Retailer page: ${offer.verification.in_stock ? 'In stock' : 'Out of stock'}` : 'Retailer verification'}: {offer.verification.message}
                {offer.verification.price != null && ` Price: $${offer.verification.price.toFixed(2)}`}
              </Text>}
              <CollapsibleSection title="Offer link"><Text selectable>{offer.url}</Text></CollapsibleSection>
            </CollapsibleSection>)}
          </> : <Text>No successful check yet.</Text>}
          {!!watch.input.example_url && <Text selectable>Reference: {watch.input.example_url}</Text>}
        </CollapsibleSection>
        <Button title="Remove product" disabled={busy} onPress={() => void action(async () => {
          await (await localRuntime()).shopping.remove(watch.id);
        })} />
      </View>)}
      {existingProducts}
      <CollapsibleSection title="Monitoring and storage details">
        <Text>Searches with no matches keep checking. Google checks cannot run while suspended or sleeping; due searches catch up on reopening, one at a time. Errors retain last successful offers. Unchanged stock reports do not repeat alerts. Existing retailer products retain direct checks. Saved products remain until removed; searches are not in backups, and alerts remain in Notifications.</Text>
      </CollapsibleSection>
    </CollapsibleSection>
  </View>;
}
