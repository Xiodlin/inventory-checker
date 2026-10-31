import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Button, Linking, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import Header from '../components/Header';
import ItemCard from '../components/ItemCard';
import { apiService, type Item, type Price } from '../services/apiService';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';

export default function ItemDetailsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ItemDetails'>) {
  const { revision } = useSession();
  const [item, setItem] = useState<Item>();
  const [prices, setPrices] = useState<Price[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [nextItem, history] = await Promise.all([apiService.item(route.params.id), apiService.prices(route.params.id)]);
      setItem(nextItem); setPrices(history);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [route.params.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));
  const remove = () => Alert.alert('Delete tracked item?', 'This removes the item and its price history.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      setBusy(true);
      void apiService.deleteItem(route.params.id).then(() => navigation.goBack())
        .catch(cause => setError(errorMessage(cause))).finally(() => setBusy(false));
    } },
  ]);
  const openProduct = async () => {
    try {
      if (!item?.url || !['http:', 'https:'].includes(new URL(item.url).protocol)) throw new Error('Unsupported product URL.');
      await Linking.openURL(item.url);
    } catch (cause) { setError(errorMessage(cause)); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}>
    <Header title="Product details" />
    {busy && <ActivityIndicator />}
    {!!error && <Text style={ui.error}>{error}</Text>}
    {item && <>
      <ItemCard item={item} onPress={() => {}} />
      <Text>SKU: {item.sku || 'Not provided'}</Text>
      <Text>Target price: {item.target_price == null ? 'Not set' : `$${Number(item.target_price).toFixed(2)}`}</Text>
      {!!item.url && <Button title="Open retailer page" onPress={() => void openProduct()} />}
    </>}
    <Text style={ui.label}>Price history</Text>
    {!prices.length && <Text>No prices recorded yet.</Text>}
    {prices.map((price, index) => <Text key={index}>
      ${Number(price.price).toFixed(2)} · {price.checked_at || price.recorded_at ? new Date(price.checked_at ?? price.recorded_at!).toLocaleString() : 'Recorded'}
    </Text>)}
    <Button title="Refresh" onPress={() => void load()} disabled={busy} />
    <Button title="Delete item" color="#a21919" onPress={remove} disabled={busy || !item} />
  </ScrollView>;
}
