import { useRef, useState } from 'react';
import { errorMessage, localApi } from '../api';
import type { Item, PricePoint } from '../types';
import { Button } from './Button';
import { Alert, Badge, EmptyState, Spinner } from './UI';

const money = (value?: number | null) =>
  value == null ? 'Not checked' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function Dashboard({ items, onDelete, embedded = false }: {
  items: Item[]; onDelete(id: Item['id']): Promise<void>; embedded?: boolean;
}) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Item['id'] | null>(null);
  const historyRequest = useRef(0);
  async function details(item: Item) {
    const current = ++historyRequest.current;
    setSelected(item); setLoading(true); setError(''); setPrices([]);
    try {
      const result = await localApi().prices(item.id);
      if (current === historyRequest.current) setPrices(result);
    }
    catch (failure) { if (current === historyRequest.current) setError(errorMessage(failure)); }
    finally { if (current === historyRequest.current) setLoading(false); }
  }
  async function remove(item: Item) {
    setDeleting(item.id); setError('');
    try { await onDelete(item.id); if (selected?.id === item.id) setSelected(null); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setDeleting(null); }
  }
  return <section className={embedded ? 'existing-products' : 'panel'}>
    {!embedded && <div className="section-heading"><div><span className="eyebrow">YOUR INVENTORY</span><h2>Tracked products <span className="count">{items.length}</span></h2></div></div>}
    {items.length === 0 ? <EmptyState title="Your watchlist is ready">Add your first product above to monitor inventory and prices.</EmptyState> :
      <div className="table-wrap" role="region" aria-label="Direct-retailer products" tabIndex={0}><table aria-label="Direct-retailer products"><thead><tr><th scope="col">Product</th><th scope="col">Retailer</th><th scope="col">Availability</th><th scope="col">Price / target</th><th scope="col">Actions</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id} id={`product-item-${item.id}`} tabIndex={-1}>
          <td><strong>{item.model || item.sku || 'Product'}</strong><small>{item.brand || '—'}{item.sku ? ` · ${item.sku}` : ''}</small></td>
          <td className="retailer">{item.retailer === 'bestbuy' ? 'Best Buy' : item.retailer}</td>
          <td><div className="product-tags"><Badge tone={item.in_stock === true ? 'success' : item.in_stock === false ? 'error' : 'neutral'}>{item.in_stock == null ? 'Stock unknown' : item.in_stock ? 'In Stock' : 'Out of Stock'}</Badge>
            {item.last_check_error && item.in_stock != null && <Badge tone="warning">Last known</Badge>}</div>
            <small>{item.fulfillment === 'pickup' ? `Pickup near ${item.pickup_zip} · ${item.pickup_radius_miles} mi` : 'Online / shipping'}</small>
            {item.fulfillment === 'pickup' && item.pickup_stores.map(store => <small key={store.id}>{store.name} · {store.distance_miles.toFixed(1)} mi · {store.available ? 'Pickup available' : 'Unavailable for pickup'}</small>)}
            {item.fulfillment === 'pickup' && item.last_checked_at && !item.last_check_error && item.pickup_stores.length === 0 && <small>No returned stores within your radius.</small>}
            <small>Alerts: {[item.notify_stock && 'In stock', item.notify_price && 'Target price'].filter(Boolean).join(' + ')}</small>
            <small>Last checked: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString() : 'Not yet'}</small>
            {item.last_check_error && <small role="alert">Check failed: {item.last_check_error}{item.in_stock != null ? ' (Showing last known stock.)' : ''}</small>}
          </td>
          <td>{item.current_price == null ? 'Price unavailable' : money(item.current_price)}<small>Target: {!item.notify_price || item.target_price == null ? '—' : money(item.target_price)}</small></td>
          <td><div className="actions"><Button variant="secondary" onClick={() => void details(item)}>Details</Button><Button variant="danger" loading={deleting === item.id} onClick={() => void remove(item)}>{deleting === item.id ? 'Removing…' : 'Remove'}</Button></div></td>
        </tr>)}</tbody></table></div>}
    {selected && <div className="history">
      <div className="section-heading"><h3>{selected.model || selected.sku || 'Product'} · stock and price history</h3><Button variant="ghost" onClick={() => { historyRequest.current++; setSelected(null); }}>Close details</Button></div>
      <p className="muted">SKU: {selected.sku || '—'} · URL: {selected.url || '—'}</p>
      {loading ? <Spinner label="Loading history…" /> : prices.length === 0 ? <p className="muted">No checks recorded yet.</p> :
        <ul className="history-list">{prices.map(point => <li key={point.id}><span>{point.checked_at}</span><span>{selected.fulfillment === 'pickup' ? point.in_stock ? 'Pickup available' : 'No pickup availability' : point.in_stock ? 'In stock' : 'Out of stock'}
          {point.pickup_stores?.filter(store => store.available).map(store => <small key={store.id}>{store.name} · {store.distance_miles.toFixed(1)} mi</small>)}
        </span><strong>{point.price == null ? 'Price unavailable' : money(point.price)}</strong></li>)}</ul>}
    </div>}
    {error && <Alert role="alert" tone="error" title={error} />}
  </section>;
}
