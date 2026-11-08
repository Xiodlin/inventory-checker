import { useCallback, useState, type ReactNode } from 'react';
import { Button, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { shoppingProductStatus, shoppingSellerEvidence, visibleShoppingOffers, groupShoppingOffers, defaultOfferView,
  offerSortOptions, sellerFilterOptions, type OfferView, type ShoppingWatch } from '@inventory-checker/core';
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
  const [views, setViews] = useState<Record<string, OfferView>>({});
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
      {watches.map(watch => {
        const status = shoppingProductStatus(watch.result);
        const view = views[watch.id] ?? defaultOfferView;
        const offers = visibleShoppingOffers(watch.result?.offers ?? [], view);
        return <View key={watch.id} style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: '#aab8c5', borderRadius: 8 }}>
        <Text style={ui.label}>{watch.input.product} · {watch.input.variants.join(', ')}</Text>
        <View style={ui.tags} accessibilityLabel="Product status">
          <Text style={[ui.tag, status.stock === 'in-stock' ? ui.tagStock : status.stock === 'out-of-stock' ? ui.tagUnavailable : undefined]}>
            {status.stock === 'in-stock' ? 'In Stock' : status.stock === 'out-of-stock' ? 'Out of Stock' : 'Stock unknown'}
          </Text>
          {status.sale && <Text style={[ui.tag, ui.tagSale]}>On Sale</Text>}
          {status.lowestPrice != null && <Text style={ui.tag}>
            Lowest found: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(status.lowestPrice)}
          </Text>}
          {!!watch.error && !!watch.result && <Text style={ui.tag}>Last known</Text>}
        </View>
        <Text>Google Shopping · Last checked: {watch.last_checked_at ? new Date(watch.last_checked_at).toLocaleString() : 'Pending check'}</Text>
        {!!watch.error && <Text style={ui.error}>{watch.error}</Text>}
        <CollapsibleSection title="Details and latest offers">
          {watch.result ? <>
            <Text>Last successful observation: {new Date(watch.result.checked_at).toLocaleString()}. Missing offers do not prove out-of-stock inventory.</Text>
            <CollapsibleSection title="Sort offers & seller confidence">
              <Text style={ui.label}>Sort offers</Text>
              <View style={ui.tags}>{offerSortOptions.map(option => <Pressable key={option.value}
                accessibilityRole="button" accessibilityState={{ selected: view.sort === option.value }}
                style={{ minHeight: 44, justifyContent: 'center' }}
                onPress={() => setViews(current => ({ ...current, [watch.id]: { ...view, sort: option.value } }))}>
                <Text style={[ui.tag, view.sort === option.value && ui.tagStock]}>{option.label}</Text>
              </Pressable>)}</View>
              <Text style={ui.label}>Seller confidence</Text>
              <View style={ui.tags}>{sellerFilterOptions.map(option => <Pressable key={option.value}
                accessibilityRole="button" accessibilityState={{ selected: view.seller === option.value }}
                style={{ minHeight: 44, justifyContent: 'center' }}
                onPress={() => setViews(current => ({ ...current, [watch.id]: { ...view, seller: option.value } }))}>
                <Text style={[ui.tag, view.seller === option.value && ui.tagStock]}>{option.label}</Text>
              </Pressable>)}</View>
              <Text>Evidence labels are not legitimacy ratings or safety guarantees. Names on opaque Google links are unverified; recognized marketplaces do not establish individual sellers' reliability. Filters change this view only, not monitoring or product tags.</Text>
            </CollapsibleSection>
            <Text style={ui.label}>Required text matches (not retailer-verified)</Text>
            {!offers.some(offer => offer.match === 'text-match') && <Text>No required-text matches for this filter.</Text>}
            {groupShoppingOffers(offers).map(group => <CollapsibleSection key={group.vendor.toLowerCase()}
              title={`${group.vendor} · ${group.offers.length} ${group.offers.length === 1 ? 'listing' : 'listings'}`}>
            {group.offers.map(offer => <CollapsibleSection key={`${offer.url}-${offer.title}-${offer.price}`}
              title={`${offer.match === 'uncertain' ? 'Uncertain: ' : ''}${offer.title} · ${offer.price}`}>
              <Text>{offer.seller} · {offer.price}</Text>
              <Text style={ui.tag}>{shoppingSellerEvidence(offer).label}</Text>
              <Text>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}: {offer.availability_text}</Text>
              {!!offer.sale_text && <Text style={[ui.tag, ui.tagSale]}>On Sale · {offer.sale_text} · Google-reported</Text>}
              {!!offer.missing.length && <Text>Not established: {offer.missing.join('; ')}</Text>}
              {offer.details?.map((detail, index) => <Text key={index}>{detail}</Text>)}
              {offer.verification && <Text>
                {offer.verification.status === 'verified' ? `Retailer page: ${offer.verification.in_stock ? 'In stock' : 'Out of stock'}` : 'Retailer verification'}: {offer.verification.message}
                {offer.verification.price != null && ` Price: $${offer.verification.price.toFixed(2)}`}
              </Text>}
              <CollapsibleSection title="Offer link"><Text selectable>{offer.url}</Text></CollapsibleSection>
            </CollapsibleSection>)}
            </CollapsibleSection>)}
          </> : <Text>No successful check yet.</Text>}
          {!!watch.input.example_url && <Text selectable>Reference: {watch.input.example_url}</Text>}
        </CollapsibleSection>
        <Button title="Remove product" disabled={busy} onPress={() => void action(async () => {
          await (await localRuntime()).shopping.remove(watch.id);
        })} />
      </View>;
      })}
      {existingProducts}
      <CollapsibleSection title="Monitoring and storage details">
        <Text>Lowest found is the lowest Google-listed price among required-text matches in the last successful search, including unknown or out-of-stock offers. It excludes tax and shipping and is not an all-time low or a guarantee of purchasability.</Text>
        <Text>Stock tags summarize required-text matches. Any reported or verified in-stock offer gives In Stock; Out of Stock requires every matching offer to explicitly be out of stock. Otherwise stock stays unknown. Retailer verification takes precedence for each offer. On Sale requires an explicit source discount label, not a price drop. Tags show the last successful observation, not guaranteed live inventory.</Text>
        <Text>Searches with no matches keep checking. Google checks cannot run while suspended or sleeping; due searches catch up on reopening, one at a time. Errors retain last successful offers. Unchanged stock reports do not repeat alerts. Existing retailer products retain direct checks. Saved products remain until removed; searches are not in backups, and alerts remain in Notifications.</Text>
      </CollapsibleSection>
    </CollapsibleSection>
  </View>;
}
