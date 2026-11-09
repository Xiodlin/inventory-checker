import { useEffect, useRef, type ReactNode, type ComponentRef } from 'react';
import { View } from 'react-native';
export type ProductView = ComponentRef<typeof View>;

export default function NotificationCardFocus({ active, request, onReveal, children }: {
  active: boolean; request?: number; onReveal?: (view: ProductView) => void; children: ReactNode;
}) {
  const ref = useRef<ProductView>(null);
  const height = useRef(0);
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => { if (ref.current && height.current > 0) onReveal?.(ref.current); });
    return () => cancelAnimationFrame(frame);
  }, [active, request, onReveal]);
  return <View ref={ref} collapsable={false}
    onLayout={event => {
      height.current = event.nativeEvent.layout.height;
      if (active && ref.current && height.current > 0) onReveal?.(ref.current);
    }}
    style={active ? { borderWidth: 2, borderColor: '#2875d2', borderRadius: 10, padding: 4 } : undefined}>
    {children}
  </View>;
}
