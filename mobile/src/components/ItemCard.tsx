import { Pressable, StyleSheet, Text } from 'react-native';
import type { Item } from '../services/apiService';

export default function ItemCard({ item, onPress }: { item: Item; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
    <Text style={styles.title}>{[item.brand, item.model].filter(Boolean).join(' ') || item.sku || 'Tracked item'}</Text>
    <Text>{item.retailer.toUpperCase()} · {item.current_price == null ? 'Price pending' : `$${Number(item.current_price).toFixed(2)}`}</Text>
    <Text>{item.in_stock == null ? 'Stock pending' : item.in_stock ? 'In stock' : 'Out of stock'}</Text>
    <Text>Last checked: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString() : 'Not yet'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 12, gap: 6 },
  title: { fontSize: 18, fontWeight: '600' },
});
