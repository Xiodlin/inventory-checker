import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api';
import type { NewItem } from '../types';

export default function AddItem({ onAdd }: { onAdd(item: NewItem): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notifyStock, setNotifyStock] = useState(true);
  const [notifyPrice, setNotifyPrice] = useState(false);
  const [retailer, setRetailer] = useState<NewItem['retailer']>('amazon');
  const [fulfillment, setFulfillment] = useState<NewItem['fulfillment']>('shipping');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const item: NewItem = {
      retailer, fulfillment,
      notify_stock: notifyStock, notify_price: notifyPrice,
    };
    for (const key of ['brand', 'model', 'sku', 'url'] as const) {
      const value = String(values.get(key) || '').trim();
      if (value) item[key] = value;
    }
    if (fulfillment === 'pickup') {
      const zip = String(values.get('pickup_zip') || '').trim();
      const radius = Number(values.get('pickup_radius_miles'));
      if (!item.url || !/^\d{5}$/.test(zip) || !Number.isInteger(radius) || radius < 1 || radius > 250) {
        setError('Pickup tracking requires a product URL, a five-digit ZIP code, and a radius from 1 to 250 miles.'); return;
      }
      item.pickup_zip = zip;
      item.pickup_radius_miles = radius;
    }
    if (!item.url && !item.sku && !item.model) {
      setError('Provide a product URL, SKU, or model.'); return;
    }
    const target = values.get('target_price');
    if (!notifyStock && !notifyPrice) { setError('Select stock alerts, price alerts, or both.'); return; }
    if (notifyPrice) {
      if (!target) { setError('Enter a target price for price alerts.'); return; }
      item.target_price = Number(target);
    }
    setBusy(true); setError('');
    try { await onAdd(item); form.reset(); setNotifyStock(true); setNotifyPrice(false); setRetailer('amazon'); setFulfillment('shipping'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">WATCHLIST</span><h2>Track a product</h2></div></div>
    <p className="muted">Monitor stock, a target price, or both. Set a Best Buy API key in Settings for Best Buy checks. Public-page checks can be blocked. For Apple pickup, use the exact configuration URL, including model, capacity, color, and carrier.</p>
    <p className="muted">Amazon accepts a full amazon.com/dp/ASIN URL, a 10-character ASIN, or an https://a.co/d/ share link.</p>
    <p className="muted">Target links with preselect track that selected variant. Target pages that load stock/price only through site JavaScript are not supported; the app will show an error, not guessed stock.</p>
    <form onSubmit={submit} className="add-form">
      <label>Retailer<select name="retailer" value={retailer} disabled={busy} onChange={event => {
        const value = event.target.value;
        if (value === 'amazon' || value === 'target' || value === 'bestbuy' || value === 'apple') {
          setRetailer(value); setFulfillment('shipping');
        }
      }}><option value="amazon">Amazon</option><option value="target">Target</option><option value="bestbuy">Best Buy</option><option value="apple">Apple</option></select></label>
      <label>Brand<input name="brand" maxLength={120} placeholder="e.g. Apple" /></label>
      <label>Model<input name="model" maxLength={200} placeholder="Product name" /></label>
      <label>SKU<input name="sku" maxLength={120} placeholder="Optional product identifier" /></label>
      <label className="wide">Product URL<input name="url" type="url" maxLength={2048} placeholder="https://…" /></label>
      {retailer === 'apple' && <>
        <label>Availability type<select value={fulfillment} disabled={busy} onChange={event => {
          if (event.target.value === 'shipping' || event.target.value === 'pickup') setFulfillment(event.target.value);
        }}><option value="shipping">Online / shipping</option><option value="pickup">Apple Store pickup</option></select></label>
        {fulfillment === 'pickup' && <>
          <label>Pickup ZIP code<input name="pickup_zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required disabled={busy} autoComplete="postal-code" placeholder="Five-digit US ZIP" /></label>
          <label>Search radius (miles)<input name="pickup_radius_miles" type="number" min="1" max="250" step="1" defaultValue="50" required disabled={busy} /></label>
          <p className="muted wide">Your ZIP is saved with this product and sent to Apple to find nearby pickup stores. No street address or GPS is collected. Alerts cover available stores returned by Apple within this radius, measured from the ZIP area, not driving distance. Apple may limit results or block checks.</p>
        </>}
      </>}
      <label className="toggle"><input type="checkbox" checked={notifyStock} onChange={event => setNotifyStock(event.target.checked)} disabled={busy} />Notify when in stock</label>
      <label className="toggle"><input type="checkbox" checked={notifyPrice} onChange={event => setNotifyPrice(event.target.checked)} disabled={busy} />Notify at target price</label>
      <label>Target price ($)<input name="target_price" type="number" min="0" max="9999999999.99" step="0.01" placeholder="Required for price alerts" required={notifyPrice} disabled={!notifyPrice || busy} /></label>
      <button className="primary add-submit" disabled={busy}>{busy ? 'Adding…' : '+ Add product'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
