import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, localApi } from '../api';
import type { ShoppingInput, ShoppingOffer, ShoppingSearch, ShoppingWatch } from '../types';

export default function ShoppingDiscovery() {
  const [history, setHistory] = useState<ShoppingSearch[]>([]);
  const [selected, setSelected] = useState<ShoppingSearch>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [watches, setWatches] = useState<ShoppingWatch[]>([]);
  const [interval, setIntervalMinutes] = useState<number>();
  const [automatic, setAutomatic] = useState(true);
  async function refresh() {
    const [saved, settings] = await Promise.all([localApi().shoppingWatches(), localApi().settings()]);
    setWatches(saved); setIntervalMinutes(settings.check_interval_minutes); setAutomatic(settings.background_enabled);
  }
  useEffect(() => {
    void localApi().shoppingHistory().then(value => { setHistory(value); setSelected(value[0]); })
      .catch(failure => setError(errorMessage(failure)));
    void refresh().catch(failure => setError(errorMessage(failure)));
    return localApi().onChanged(() => { void refresh().catch(failure => setError(errorMessage(failure))); });
  }, []);
  async function save(input: ShoppingInput) {
    setBusy(true); setError('');
    try { await localApi().saveShoppingWatch(input); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try { await localApi().removeShoppingWatch(id); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
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
  const renderOffer = (offer: ShoppingOffer, index: number) => <li className="discovery-card" key={`${offer.url}-${index}`}>
    <h3>{offer.title}</h3>
    <div className="discovery-offer-meta"><span>{offer.seller}</span><strong className="discovery-price">{offer.price}</strong></div>
    <p className="discovery-availability"><span className={`badge${offer.availability === 'reported-in-stock' ? ' success' : ''}`}>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}</span> {offer.availability_text}</p>
    {!!offer.missing.length && <p className="muted">Not established: {offer.missing.join('; ')}</p>}
    <details className="discovery-link"><summary>Offer link</summary>
      <label>Copy this link into your browser<input readOnly value={offer.url} onClick={event => event.currentTarget.select()} /></label>
    </details>
  </li>;
  return <div className="discovery-layout">
    <section className="panel discovery-section" aria-labelledby="discovery-title">
    <span className="eyebrow">EXPERIMENTAL · GOOGLE-REPORTED</span><h2 id="discovery-title">Find this product</h2>
    <p className="muted">Search normal Google Shopping pages without a paid API key. Google receives your search and IP address. This app does not sign in, bypass CAPTCHA, or automate consent. A blocked or unreadable page produces an error.</p>
    <form onSubmit={event => void search(event)} className="discovery-form">
      <label>Product / model name<input name="product" required minLength={3} maxLength={150} placeholder="MacBook Neo" disabled={busy} /></label>
      <label>Required variant phrases (comma-separated)<input name="variants" required maxLength={800} placeholder="256GB, Indigo" disabled={busy} /></label>
      <label>Example link (optional reference only)<input name="example_url" type="url" maxLength={2048} placeholder="https://…" disabled={busy} /></label>
      <p className="muted discovery-help">Enter model and variant explicitly. The example link is saved for reference, not fetched or used to guess specifications. Matching checks offer titles for every required phrase; it does not verify model numbers or inventory. Accessories and used/refurbished listings are separated as uncertain.</p>
      <div className="discovery-actions">
      <button className="primary" disabled={busy}>{busy ? 'Searching Google…' : 'Search Google Shopping'}</button>
      <button type="button" disabled={busy} onClick={event => {
        const form = event.currentTarget.form;
        if (!form?.reportValidity()) return;
        const data = new FormData(form);
        const example = String(data.get('example_url') ?? '').trim();
        void save({ product: String(data.get('product')).trim(),
          variants: String(data.get('variants')).split(',').map(value => value.trim()).filter(Boolean),
          ...(example ? { example_url: example } : {}) });
      }}>Save search for stock alerts</button>
      </div>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    </section>
    {selected && <section className="panel discovery-section" aria-labelledby="discovery-results-title">
      <span className="eyebrow">SEARCH RESULTS</span><h2 id="discovery-results-title">Latest selected search</h2>
      <p className="muted">Search: {selected.input.product} · {selected.input.variants.join(', ')} · Checked {new Date(selected.checked_at).toLocaleString()}</p>
      {selected.error && <p role="alert" className="error">{selected.error}</p>}
      {!selected.error && <>
        <p role="status" className="muted">Found {selected.offers.length} readable offers. Missing results are not evidence of out-of-stock inventory.</p>
        <h3>Required text matches (not retailer-verified)<span className="count">{selected.offers.filter(offer => offer.match === 'text-match').length}</span></h3>
        <ul className="discovery-offers">{selected.offers.filter(offer => offer.match === 'text-match').map(renderOffer)}</ul>
        {!selected.offers.some(offer => offer.match === 'text-match') && <p>No offers confirmed every required phrase.</p>}
        <details className="discovery-uncertain"><summary>Uncertain matches ({selected.offers.filter(offer => offer.match === 'uncertain').length})</summary>
          <ul className="discovery-offers">{selected.offers.filter(offer => offer.match === 'uncertain').map(renderOffer)}</ul>
        </details>
      </>}
    </section>}
    <section className="panel discovery-section" aria-labelledby="discovery-alerts-title">
    <span className="eyebrow">AUTOMATIC MONITORING</span><h2 id="discovery-alerts-title">Saved search alerts<span className="count">{watches.length}</span></h2>
    <div className="discovery-monitor-status"><span className={`badge${automatic ? ' success' : ''}`}>{automatic ? 'Automatic checks enabled' : 'Automatic checks disabled'}</span><span>Every {interval ?? 'configured'} minutes · While running and awake</span></div>
    <details className="discovery-help"><summary>How search alerts work</summary>
      <p className="muted">Rechecks use the same interval as retailer checks, including searches with no matching offers. Only required-text matches explicitly reported in stock create alerts; uncertain or unknown offers do not. Repeated stock reports do not repeat alerts. Google errors retain the last successful result. Multiple due searches run one at a time, so checks may be delayed.</p>
    </details>
    {!watches.length && <p className="muted discovery-empty">No saved searches yet. Save a search above to start stock alerts.</p>}
    <ul className="discovery-offers">{watches.map(watch => <li className="discovery-card" key={watch.id}>
      <h3>{watch.input.product} · {watch.input.variants.join(', ')}</h3>
      <p>Last checked: {watch.last_checked_at ? new Date(watch.last_checked_at).toLocaleString() : 'Pending check'}</p>
      {watch.error && <p className="error" role="alert">{watch.error}</p>}
      <div className="discovery-actions">
      {watch.result && <button disabled={busy} onClick={() => setSelected(watch.result!)}>Review last successful result</button>}
      <button className="danger" disabled={busy} onClick={() => void remove(watch.id)}>Delete saved search</button>
      </div>
    </li>)}</ul>
    </section>
    <section className="panel discovery-section discovery-history" aria-labelledby="discovery-history-title">
    <span className="eyebrow">ON THIS DEVICE</span><h2 id="discovery-history-title">Search history</h2>
    {!!history.length && <label>Recent searches<select disabled={busy} value={selected?.id ?? ''} onChange={event => setSelected(history.find(value => value.id === event.target.value))}>
      <option value="" disabled>Select a search</option>
      {history.map(result => <option key={result.id} value={result.id}>{result.input.product} · {result.input.variants.join(', ')} · {new Date(result.checked_at).toLocaleString()}</option>)}
    </select></label>}
    <div className="discovery-actions">
    <button disabled={busy || !history.length} onClick={() => void clear()}>Clear shopping search history</button>
    </div>
    <details className="discovery-help"><summary>Storage and retention</summary>
      <p className="muted">Only the latest 20 search outcomes are kept in recent history. Saved searches and their latest successful results remain until deleted, separately from history. Alerts remain in Notifications. Browser cookies/cache are cleared afterward. Searches are not included in watchlist backups.</p>
    </details>
    </section>
  </div>;
}
