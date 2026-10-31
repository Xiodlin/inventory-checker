import { useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (![model, sku, url].some(value => value.trim())) { setError('Provide a model, SKU, or product URL.'); return; }
    if (target.trim() && (!Number.isFinite(Number(target)) || Number(target) < 0 || Number(target) > 9999999999.99)) {
      setError('Target price must be between 0 and 9,999,999,999.99.'); return;
    }
    if (url.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(url.trim()).protocol)) throw new Error(); }
      catch { setError('Product URL must start with http:// or https://.'); return; }
    }
    setBusy(true);
    try {
      await apiService.addItem({ retailer, ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}), ...(sku.trim() ? { sku: sku.trim() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}), ...(target.trim() ? { target_price: Number(target) } : {}) });
      navigation.goBack();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Header title="Track a product" />
    <Text style={ui.label}>Retailer</Text>
    <View style={{ gap: 6 }}>{retailers.map(value => <Button key={value}
      title={`${value === retailer ? '✓ ' : ''}${value}`} onPress={() => setRetailer(value)} disabled={busy} />)}</View>
    {([
      ['Brand', brand, setBrand], ['Model', model, setModel], ['SKU', sku, setSku],
      ['Product URL', url, setUrl], ['Target price (optional)', target, setTarget],
    ] as const).map(([label, value, change]) => <View key={label} style={{ gap: 6 }}>
      <Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input}
        value={value} onChangeText={change} editable={!busy} autoCapitalize="none"
        keyboardType={label.startsWith('Target') ? 'decimal-pad' : label === 'Product URL' ? 'url' : 'default'} />
    </View>)}
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Button title={busy ? 'Adding…' : 'Add item'} disabled={busy} onPress={() => void submit()} />
  </ScrollView>;
}
