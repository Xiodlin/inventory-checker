import { StyleSheet } from 'react-native';

export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f6fa' },
  content: { padding: 20, gap: 12 },
  input: { borderWidth: 1, borderColor: '#aab8c5', borderRadius: 8, padding: 12, backgroundColor: '#fff', color: '#16324f' },
  error: { color: '#a21919' },
  label: { fontWeight: '600', color: '#16324f' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.';
