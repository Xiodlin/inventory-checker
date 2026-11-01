import { StyleSheet, Text, View } from 'react-native';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.header}><Text style={styles.title}>{title}</Text>{subtitle && <Text>{subtitle}</Text>}</View>;
}
const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#16324f' },
});
