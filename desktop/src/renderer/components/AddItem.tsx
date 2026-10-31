import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api';
import type { NewItem } from '../types';

export default function AddItem({ onAdd }: { onAdd(item: NewItem): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const item: NewItem = { retailer: values.get('retailer') as NewItem['retailer'] };
    for (const key of ['brand', 'model', 'sku', 'url'] as const) {
      const value = String(values.get(key) || '').trim();
      if (value) item[key] = value;
    }
    if (!item.url && !item.sku && !item.model) {
      setError('Provide a product URL, SKU, or model.'); return;
    }
    const target = values.get('target_price');
    if (target) item.target_price = Number(target);
    setBusy(true); setError('');
    try { await onAdd(item); form.reset(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">WATCHLIST</span><h2>Track a product</h2></div></div>
    <p className="muted">Add a product to your list. Live retailer checks depend on backend adapter availability.</p>
    <form onSubmit={submit} className="add-form">
      <label>Retailer<select name="retailer"><option value="amazon">Amazon</option><option value="target">Target</option><option value="bestbuy">Best Buy</option><option value="apple">Apple</option></select></label>
      <label>Brand<input name="brand" maxLength={120} placeholder="e.g. Apple" /></label>
      <label>Model<input name="model" maxLength={200} placeholder="Product name" /></label>
      <label>SKU<input name="sku" maxLength={120} placeholder="Optional product identifier" /></label>
      <label className="wide">Product URL<input name="url" type="url" maxLength={2048} placeholder="https://…" /></label>
      <label>Target price ($)<input name="target_price" type="number" min="0" step="0.01" placeholder="Optional" /></label>
      <button className="primary add-submit" disabled={busy}>{busy ? 'Adding…' : '+ Add product'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
