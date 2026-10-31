import { useRef, useState } from 'react';
import { errorMessage, request } from '../api';
import type { Item, PricePoint } from '../types';

const money = (value?: number | null) =>
  value == null ? 'Not checked' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function Dashboard({ items, token, onDelete }: {
  items: Item[]; token: string; onDelete(id: Item['id']): Promise<void>;
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
      const result = await request<PricePoint[]>(`/api/items/${encodeURIComponent(item.id)}/prices`, token);
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
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">YOUR INVENTORY</span><h2>Tracked products <span className="count">{items.length}</span></h2></div></div>
    {items.length === 0 ? <div className="empty"><span className="empty-icon">◇</span><h3>Your watchlist is ready</h3><p>Add your first product above to monitor inventory and prices.</p></div> :
      <div className="table-wrap"><table><thead><tr><th>Product</th><th>Retailer</th><th>Availability</th><th>Price / target</th><th>Actions</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td><strong>{item.model || item.sku || 'Product'}</strong><small>{item.brand || '—'}{item.sku ? ` · ${item.sku}` : ''}</small></td>
          <td className="retailer">{item.retailer === 'bestbuy' ? 'Best Buy' : item.retailer}</td>
          <td><span className={`badge ${item.in_stock ? 'success' : ''}`}>{item.in_stock == null ? 'Pending check' : item.in_stock ? 'In stock' : 'Out of stock'}</span></td>
          <td>{money(item.current_price)}<small>Target: {item.target_price == null ? '—' : money(item.target_price)}</small></td>
          <td><div className="actions"><button onClick={() => void details(item)}>Details</button><button className="danger" disabled={deleting === item.id} onClick={() => void remove(item)}>{deleting === item.id ? 'Removing…' : 'Remove'}</button></div></td>
        </tr>)}</tbody></table></div>}
    {selected && <div className="history">
      <div className="section-heading"><h3>{selected.model || selected.sku || 'Product'} · price history</h3><button onClick={() => { historyRequest.current++; setSelected(null); }}>Close details</button></div>
      <p className="muted">SKU: {selected.sku || '—'} · URL: {selected.url || '—'}</p>
      {loading ? <p role="status">Loading history…</p> : prices.length === 0 ? <p className="muted">No price checks recorded yet.</p> :
        <ul className="history-list">{prices.map((point, index) => <li key={index}><span>{point.recorded_at || point.checked_at || point.created_at || 'Recorded check'}</span><strong>{money(point.price)}</strong></li>)}</ul>}
    </div>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
