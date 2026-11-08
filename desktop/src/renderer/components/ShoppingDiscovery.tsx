import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, localApi } from '../api';
import type { ShoppingOffer, ShoppingSearch } from '../types';

export default function ShoppingDiscovery() {
  const [history, setHistory] = useState<ShoppingSearch[]>([]);
  const [selected, setSelected] = useState<ShoppingSearch>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void localApi().shoppingHistory().then(value => { setHistory(value); setSelected(value[0]); })
      .catch(failure => setError(errorMessage(failure)));
  }, []);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSelected(undefined);
    const data = new FormData(event.currentTarget);
    const variants = String(data.get('variants')).split(',').map(value => value.trim()).filter(Boolean);
    if (!variants.length) { setError('Specify at least one variant or exact model identifier.'); return; }
    const example = String(data.get('example_url') ?? '').trim();
    setBusy(true);
    try {
      const result = await localApi().shoppingSearch({
        product: String(data.get('product')).trim(), variants,
        ...(example ? { example_url: example } : {}),
      });
      setSelected(result); setHistory(await localApi().shoppingHistory());
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setError('');
    try { await localApi().clearShoppingHistory(); setHistory([]); setSelected(undefined); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const renderOffer = (offer: ShoppingOffer, index: number) => <li key={`${offer.url}-${index}`}>
    <h3>{offer.title}</h3>
    <p>{offer.seller} · {offer.price}</p>
    <p><strong>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}</strong>: {offer.availability_text}</p>
    {!!offer.missing.length && <p className="muted">Not established: {offer.missing.join('; ')}</p>}
    <p className="muted discovery-url">Offer link (copy into your browser): {offer.url}</p>
  </li>;
  return <section className="panel">
    <span className="eyebrow">EXPERIMENTAL · MANUAL ONLY</span><h2>Find this product</h2>
    <p className="muted">Search normal Google Shopping pages without a paid API key. Google receives your search and IP address. This app does not sign in, bypass CAPTCHA, or automate consent. A blocked or unreadable page produces an error.</p>
    <form onSubmit={event => void search(event)} className="discovery-form">
      <label>Product / model name<input name="product" required minLength={3} maxLength={150} placeholder="MacBook Neo" disabled={busy} /></label>
      <label>Required variant phrases (comma-separated)<input name="variants" required maxLength={800} placeholder="256GB, Indigo" disabled={busy} /></label>
      <label>Example link (optional reference only)<input name="example_url" type="url" maxLength={2048} placeholder="https://…" disabled={busy} /></label>
      <p className="muted">Enter model and variant explicitly. The example link is saved for reference, not fetched or used to guess specifications. Matching checks offer titles for every required phrase; it does not verify model numbers or inventory. Accessories and used/refurbished listings are separated as uncertain.</p>
      <button className="primary" disabled={busy}>{busy ? 'Searching Google…' : 'Search Google Shopping'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {selected && <div>
      <p className="muted">Search: {selected.input.product} · {selected.input.variants.join(', ')} · Checked {new Date(selected.checked_at).toLocaleString()}</p>
      {selected.error && <p role="alert" className="error">{selected.error}</p>}
      {!selected.error && <>
        <p role="status" className="muted">Found {selected.offers.length} readable offers. Missing results are not evidence of out-of-stock inventory.</p>
        <h3>Required text matches (not retailer-verified)</h3>
        <ul className="discovery-offers">{selected.offers.filter(offer => offer.match === 'text-match').map(renderOffer)}</ul>
        {!selected.offers.some(offer => offer.match === 'text-match') && <p>No offers confirmed every required phrase.</p>}
        <details><summary>Uncertain matches ({selected.offers.filter(offer => offer.match === 'uncertain').length})</summary>
          <ul className="discovery-offers">{selected.offers.filter(offer => offer.match === 'uncertain').map(renderOffer)}</ul>
        </details>
      </>}
    </div>}
    <p className="muted">Only the latest 20 searches/results are saved on this device, including reference URLs. Search browser cookies/cache are cleared afterward. No automatic monitoring, native stock alerts, or watchlist changes are triggered. Shopping history is not included in watchlist backups.</p>
    {!!history.length && <label>Recent searches<select disabled={busy} value={selected?.id ?? ''} onChange={event => setSelected(history.find(value => value.id === event.target.value))}>
      <option value="" disabled>Select a search</option>
      {history.map(result => <option key={result.id} value={result.id}>{result.input.product} · {result.input.variants.join(', ')} · {new Date(result.checked_at).toLocaleString()}</option>)}
    </select></label>}
    <button disabled={busy || !history.length} onClick={() => void clear()}>Clear shopping search history</button>
  </section>;
}
