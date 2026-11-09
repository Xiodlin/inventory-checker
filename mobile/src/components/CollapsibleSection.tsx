import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ui } from '../ui';

export default function CollapsibleSection({ title, children, initiallyOpen = false, revealKey }: {
  title: string; children: ReactNode; initiallyOpen?: boolean; revealKey?: number;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => { if (revealKey != null) setOpen(true); }, [revealKey]);
  return <View style={{ borderWidth: 1, borderColor: '#aab8c5', borderRadius: 8, padding: 12 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={ui.label}>{open ? '−' : '+'} {title}</Text>
    </Pressable>
    <View style={{ display: open ? 'flex' : 'none', gap: 12, paddingTop: 12 }}>{children}</View>
  </View>;
}
