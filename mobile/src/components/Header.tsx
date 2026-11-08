import { Image, StyleSheet, Text, View } from 'react-native';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.header}><View style={styles.brand}><Image source={require('../../../assets/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors /><Text style={styles.title}>{title}</Text></View>{subtitle && <Text>{subtitle}</Text>}</View>;
}
const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 10 },
  title: { fontSize: 26, fontWeight: '700', color: '#16324f' },
});
