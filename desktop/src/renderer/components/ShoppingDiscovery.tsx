import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage, localApi } from '../api';
import type { ShoppingOffer, ShoppingWatch } from '../types';
import { shoppingProductStatus, shoppingSellerEvidence, visibleShoppingOffers, groupShoppingOffers, defaultOfferView,
  offerSortOptions, sellerFilterOptions, type OfferView } from '@inventory-checker/core/src/shopping';

export default function ShoppingDiscovery({ existingProducts, existingCount = 0 }: {
  existingProducts?: ReactNode; existingCount?: number;
}) {
  const [watches, setWatches] = useState<ShoppingWatch[]>([]);
  const [views, setViews] = useState<Record<string, OfferView>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [interval, setIntervalMinutes] = useState<number>();
  const [automatic, setAutomatic] = useState(true);
  async function refresh() {
    const [saved, settings] = await Promise.all([localApi().shoppingWatches(), localApi().settings()]);
    setWatches(saved); setIntervalMinutes(settings.check_interval_minutes); setAutomatic(settings.background_enabled);
  }
  useEffect(() => {
    void refresh().catch(failure => setError(errorMessage(failure)));
    return localApi().onChanged(() => { void refresh().catch(failure => setError(errorMessage(failure))); });
  }, []);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const example = String(data.get('example_url') ?? '').trim();
    setBusy(true); setError(''); setMessage('');
    try {
      await localApi().saveShoppingWatch({
        product: String(data.get('product')).trim(),
        variants: String(data.get('variants')).split(',').map(value => value.trim()).filter(Boolean),
        ...(example ? { example_url: example } : {}),
      });
      await refresh(); form.reset();
      setMessage('Product saved. Its latest offers will appear in watchlist details after a check.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try { await localApi().removeShoppingWatch(id); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const renderOffer = (offer: ShoppingOffer, index: number) => <li className="discovery-card" key={`${offer.url}-${index}`}>
    <h3>{offer.title}</h3>
    <div className="discovery-offer-meta"><span>{offer.seller}</span><strong className="discovery-price">{offer.price}</strong></div>
    <p className="seller-evidence"><span className="badge">{shoppingSellerEvidence(offer).label}</span></p>
    <p className="discovery-availability"><span className={`badge${offer.availability === 'reported-in-stock' ? ' success' : ''}`}>{offer.availability === 'unknown' ? 'Availability unknown' : 'Google-reported availability'}</span> {offer.availability_text}</p>
    {offer.sale_text && <p><span className="badge sale">On Sale</span> <span className="muted">{offer.sale_text} · Google-reported</span></p>}
    {!!offer.missing.length && <p className="muted">Not established: {offer.missing.join('; ')}</p>}
    {!!offer.details?.length && <ul className="muted">{offer.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
    {offer.verification && <p className={offer.verification.status === 'failed' ? 'error' : 'muted'}>
      <strong>{offer.verification.status === 'verified' ? `Retailer page: ${offer.verification.in_stock ? 'In stock' : 'Out of stock'}` : 'Retailer verification'}</strong>: {offer.verification.message}
      {offer.verification.price != null && ` Price: $${offer.verification.price.toFixed(2)}`}
    </p>}
    <details className="discovery-link"><summary>Offer link</summary>
      <label>Copy this link into your browser<input readOnly value={offer.url} onClick={event => event.currentTarget.select()} /></label>
    </details>
  </li>;
  const renderVendors = (offers: ShoppingOffer[]) => <div className="vendor-groups">
    {groupShoppingOffers(offers).map(group => <details className="vendor-group" key={group.vendor.toLowerCase()}>
      <summary>{group.vendor}<span className="count">{group.offers.length} {group.offers.length === 1 ? 'listing' : 'listings'}</span></summary>
      <ul className="discovery-offers">{group.offers.map(renderOffer)}</ul>
    </details>)}
  </div>;
  return <div className="discovery-layout">
    <details className="panel discovery-section discovery-collapse">
      <summary id="discovery-title">Add product<span className="discovery-summary-meta">Monitor offers across retailers</span></summary>
      <div className="discovery-section-body">
        <p className="muted">Describe the product and required variant. Google receives your search and IP address. Results depend on Google's coverage; not every retailer or product is included.</p>
        <form onSubmit={event => void add(event)} className="discovery-form">
          <label>Product / model name<input name="product" required minLength={3} maxLength={150} placeholder="MacBook Neo" disabled={busy} /></label>
          <label>Required variant phrases (comma-separated)<input name="variants" required maxLength={800} placeholder="256GB, Indigo" disabled={busy} /></label>
          <label>Example link (optional reference only)<input name="example_url" type="url" maxLength={2048} placeholder="https://…" disabled={busy} /></label>
          <p className="muted discovery-help">The example link is saved, not fetched or used to infer specifications. Only required-text matches explicitly reported in stock create alerts. Availability is Google-reported, not retailer-verified.</p>
          <div className="discovery-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button></div>
        </form>
        {!!message && <p role="status" className="saved">{message}</p>}
      </div>
    </details>
    {!!error && <p role="alert" className="error">{error}</p>}
    <section className="panel discovery-section" aria-labelledby="watchlist-title">
      <h2 id="watchlist-title">Tracked products<span className="count">{watches.length + existingCount}</span></h2>
      <div className="discovery-monitor-status"><span className={`badge${automatic ? ' success' : ''}`}>{automatic ? 'Automatic search checks enabled' : 'Automatic search checks paused'}</span><span>Every {interval ?? 'configured'} minutes · While running and awake</span></div>
      {!watches.length && !existingCount && <p className="muted">No products yet. Add a product above to start monitoring.</p>}
      <ul className="discovery-offers">{watches.map(watch => {
        const status = shoppingProductStatus(watch.result);
        const view = views[watch.id] ?? defaultOfferView;
        const offers = visibleShoppingOffers(watch.result?.offers ?? [], view);
        return <li className="discovery-card" key={watch.id}>
        <h3>{watch.input.product} · {watch.input.variants.join(', ')}</h3>
        <div className="product-tags" aria-label="Product status">
          <span className={`badge${status.stock === 'in-stock' ? ' success' : status.stock === 'out-of-stock' ? ' unavailable' : ''}`}>
            {status.stock === 'in-stock' ? 'In Stock' : status.stock === 'out-of-stock' ? 'Out of Stock' : 'Stock unknown'}
          </span>
          {status.sale && <span className="badge sale">On Sale</span>}
          {status.lowestPrice != null && <span className="badge" title="Lowest Google-listed price among required-text matches in the last successful search. Includes unknown or out-of-stock offers; excludes tax and shipping.">
            Lowest found: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(status.lowestPrice)}
          </span>}
          {watch.error && watch.result && <span className="badge">Last known</span>}
        </div>
        <p className="muted">Google Shopping · Last checked: {watch.last_checked_at ? new Date(watch.last_checked_at).toLocaleString() : 'Pending check'}</p>
        {watch.error && <p role="alert" className="error">{watch.error}</p>}
        <details className="watch-details"><summary>Details and latest offers</summary>
          {watch.result ? <>
            <p className="muted">Last successful observation: {new Date(watch.result.checked_at).toLocaleString()}. Missing offers are not proof of out-of-stock inventory.</p>
            <div className="offer-controls">
              <label>Sort offers<select value={view.sort} onChange={event => {
                const option = offerSortOptions.find(option => option.value === event.target.value);
                if (option) setViews(current => ({ ...current, [watch.id]: { ...view, sort: option.value } }));
              }}>{offerSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Seller confidence<select value={view.seller} onChange={event => {
                const option = sellerFilterOptions.find(option => option.value === event.target.value);
                if (option) setViews(current => ({ ...current, [watch.id]: { ...view, seller: option.value } }));
              }}>{sellerFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <p className="muted">Evidence labels are not legitimacy ratings or safety guarantees. Seller names on opaque Google links are unverified; recognized marketplaces do not establish individual sellers' reliability. Filters only change this view, not monitoring or product tags.</p>
            <h3>Required text matches (not retailer-verified)</h3>
            {renderVendors(offers.filter(offer => offer.match === 'text-match'))}
            {!offers.some(offer => offer.match === 'text-match') && <p className="muted">No required-text matches for this filter.</p>}
            <details className="discovery-uncertain"><summary>Uncertain matches ({offers.filter(offer => offer.match === 'uncertain').length})</summary>
              {renderVendors(offers.filter(offer => offer.match === 'uncertain'))}
            </details>
          </> : <p className="muted">No successful check yet.</p>}
          {watch.input.example_url && <p className="muted discovery-reference">Reference: {watch.input.example_url}</p>}
        </details>
        <div className="discovery-actions"><button className="danger" disabled={busy} onClick={() => void remove(watch.id)}>Remove product</button></div>
      </li>;
      })}</ul>
      {existingProducts}
      <details className="discovery-help"><summary>Monitoring and storage details</summary>
        <p className="muted">Lowest found is the lowest Google-listed price among required-text matches in the last successful search, including unknown or out-of-stock offers. It excludes tax and shipping and is not an all-time low or a guarantee of purchasability.</p>
        <p className="muted">Stock tags summarize required-text matches: any reported or verified in-stock offer gives In Stock; Out of Stock requires every matching offer to explicitly be out of stock. Missing or inconclusive offers stay unknown. Retailer verification takes precedence for each offer. On Sale requires an explicit source discount label, not a price drop. Tags describe the last successful observation, not guaranteed live inventory. Searches with no matches keep checking. Errors retain last successful offers. Unchanged stock reports do not repeat alerts. Due searches run one at a time and may be delayed. Existing retailer products retain their direct checks. Saved products stay until removed and searches are not in watchlist backups; alerts remain in Notifications.</p>
      </details>
    </section>
  </div>;
}
