import { useState } from 'react';
import { Button, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import Header from '../components/Header';
import { apiService, type Retailer } from '../services/apiService';
import { errorMessage, ui } from '../ui';

const retailers: Retailer[] = ['amazon', 'target', 'bestbuy', 'apple'];
export default function AddItemScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AddItem'>) {
  const [retailer, setRetailer] = useState<Retailer>('amazon');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [sku, setSku] = useState('');
  const [url, setUrl] = useState('');
  const [target, setTarget] = useState('');
  const [notifyStock, setNotifyStock] = useState(true);
  const [notifyPrice, setNotifyPrice] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState('50');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (![model, sku, url].some(value => value.trim())) { setError('Provide a model, SKU, or product URL.'); return; }
    if (pickup && (!url.trim() || !/^\d{5}$/.test(zip.trim()) || !Number.isInteger(Number(radius)) || Number(radius) < 1 || Number(radius) > 250)) {
      setError('Pickup requires a product URL, a five-digit ZIP code, and a radius from 1 to 250 miles.'); return;
    }
    if (!notifyStock && !notifyPrice) { setError('Select stock alerts, price alerts, or both.'); return; }
    if (notifyPrice && !target.trim()) { setError('Enter a target price for price alerts.'); return; }
    if (notifyPrice && (!Number.isFinite(Number(target)) || Number(target) < 0 || Number(target) > 9999999999.99)) {
      setError('Target price must be between 0 and 9,999,999,999.99.'); return;
    }
    if (url.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(url.trim()).protocol)) throw new Error(); }
      catch { setError('Product URL must start with http:// or https://.'); return; }
    }
    setBusy(true);
    try {
      await apiService.addItem({ retailer, fulfillment: pickup ? 'pickup' : 'shipping',
        ...(pickup ? { pickup_zip: zip.trim(), pickup_radius_miles: Number(radius) } : {}),
        notify_stock: notifyStock, notify_price: notifyPrice, ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}), ...(sku.trim() ? { sku: sku.trim() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}), ...(notifyPrice ? { target_price: Number(target) } : {}) });
      void apiService.checkDue().catch(cause => console.warn('Initial local inventory check failed:', errorMessage(cause)));
      navigation.goBack();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Header title="Track a product" />
    <Text>Monitor stock, a target price, or both. Set a Best Buy API key in Settings for Best Buy checks. Public-page checks can be blocked. Apple pickup needs the exact configuration URL including model, capacity, color, and carrier.</Text>
    <Text>Amazon accepts a full amazon.com/dp/ASIN URL, a 10-character ASIN, or an https://a.co/d/ share link.</Text>
    <Text>Target links with preselect track that selected variant. Target pages that load stock/price only through site JavaScript are not supported; the app will show an error, not guessed stock.</Text>
    <Text style={ui.label}>Retailer</Text>
    <View style={{ gap: 6 }}>{retailers.map(value => <Button key={value}
      title={`${value === retailer ? '✓ ' : ''}${value}`} onPress={() => { setRetailer(value); setPickup(false); }} disabled={busy} />)}</View>
    {([
      ['Brand', brand, setBrand], ['Model', model, setModel], ['SKU', sku, setSku],
      ['Product URL', url, setUrl],
    ] as const).map(([label, value, change]) => <View key={label} style={{ gap: 6 }}>
      <Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input}
        value={value} onChangeText={change} editable={!busy} autoCapitalize="none"
        keyboardType={label.startsWith('Target') ? 'decimal-pad' : label === 'Product URL' ? 'url' : 'default'} />
    </View>)}
    {retailer === 'apple' && <View>
      <Text style={ui.label}>Apple Store pickup (instead of shipping)</Text>
      <Switch accessibilityLabel="Apple Store pickup" value={pickup} onValueChange={setPickup} disabled={busy} />
      {pickup && <>
        <Text style={ui.label}>Pickup ZIP code</Text>
        <TextInput accessibilityLabel="Pickup ZIP code" style={ui.input} value={zip} onChangeText={setZip}
          keyboardType="number-pad" maxLength={5} editable={!busy} />
        <Text style={ui.label}>Search radius (miles)</Text>
        <TextInput accessibilityLabel="Search radius (miles)" style={ui.input} value={radius} onChangeText={setRadius}
          keyboardType="number-pad" editable={!busy} />
        <Text>Your ZIP is saved with this product and sent to Apple. No street address or GPS is collected. Alerts cover returned stores within this radius, measured from the ZIP area, not driving distance. Apple may limit results or block checks.</Text>
      </>}
    </View>}
    <View><Text style={ui.label}>Notify when in stock</Text>
      <Switch accessibilityLabel="Notify when in stock" value={notifyStock} onValueChange={setNotifyStock} disabled={busy} /></View>
    <View><Text style={ui.label}>Notify at target price</Text>
      <Switch accessibilityLabel="Notify at target price" value={notifyPrice} onValueChange={setNotifyPrice} disabled={busy} /></View>
    {notifyPrice && <View><Text style={ui.label}>Target price ($)</Text>
      <TextInput accessibilityLabel="Target price" style={ui.input} value={target} onChangeText={setTarget}
        editable={!busy} keyboardType="decimal-pad" /></View>}
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Button title={busy ? 'Adding…' : 'Add item'} disabled={busy} onPress={() => void submit()} />
  </ScrollView>;
}
