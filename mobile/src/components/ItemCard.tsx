import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../services/apiService';
import { ui } from '../ui';

export default function ItemCard({ item, onPress }: { item: Item; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
    <Text style={styles.title}>{[item.brand, item.model].filter(Boolean).join(' ') || item.sku || 'Tracked item'}</Text>
    <Text>{item.retailer.toUpperCase()} · {item.current_price == null ? 'Price pending' : `$${Number(item.current_price).toFixed(2)}`}</Text>
    <View style={ui.tags}>
      <Text style={[ui.tag, item.in_stock === true ? ui.tagStock : item.in_stock === false ? ui.tagUnavailable : undefined]}>
        {item.in_stock == null ? 'Stock unknown' : item.in_stock ? 'In Stock' : 'Out of Stock'}
      </Text>
      {!!item.last_check_error && item.in_stock != null && <Text style={ui.tag}>Last known</Text>}
    </View>
    <Text>{item.fulfillment === 'pickup' ? `Pickup near ${item.pickup_zip} · ${item.pickup_radius_miles} mi` : 'Online / shipping'}</Text>
    {item.fulfillment === 'pickup' && item.pickup_stores.map(store => <Text key={store.id}>
      {store.name} · {store.distance_miles.toFixed(1)} mi · {store.available ? 'Pickup available' : 'Unavailable for pickup'}
    </Text>)}
    {item.fulfillment === 'pickup' && item.last_checked_at && !item.last_check_error && item.pickup_stores.length === 0 && <Text>No returned stores within your radius.</Text>}
    <Text>Alerts: {[item.notify_stock && 'In stock', item.notify_price && 'Target price'].filter(Boolean).join(' + ')}</Text>
    <Text>Last checked: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString() : 'Not yet'}</Text>
    {!!item.last_check_error && <Text accessibilityRole="alert">Check failed: {item.last_check_error}{item.in_stock !== null ? ' (Showing last known stock.)' : ''}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 12, gap: 6 },
  title: { fontSize: 18, fontWeight: '600' },
});
