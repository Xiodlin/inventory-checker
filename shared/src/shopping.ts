import { z } from 'zod';

export function isPublicShoppingURL(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname)
      && !url.hostname.includes(':') && !/\.(?:local|localhost|internal|test|invalid)$/i.test(url.hostname);
  } catch { return false; }
}
export const shoppingInput = z.object({
  product: z.string().trim().min(3).max(150).regex(/[a-z0-9]/i, 'Include a product name or model identifier'),
  variants: z.array(z.string().trim().min(1).max(80).regex(/[a-z0-9]/i, 'Variant phrases must include letters or numbers')).min(1).max(10),
  example_url: z.string().url().max(2048).refine(isPublicShoppingURL,
    'Use a public HTTPS example URL without credentials or a port').optional(),
}).strict();
export type ShoppingInput = z.infer<typeof shoppingInput>;
export interface ShoppingOffer {
  title: string; seller: string; url: string; price: string;
  availability: 'reported-in-stock' | 'reported-out-of-stock' | 'unknown';
  availability_text: string;
  match: 'text-match' | 'uncertain'; missing: string[];
  details?: string[];
  sale_text?: string;
  verification?: { status: 'verified' | 'failed' | 'unsupported' | 'skipped'; message: string;
    url?: string; in_stock?: boolean; price?: number | null };
}
export interface ShoppingSearch {
  id: string; input: ShoppingInput; checked_at: string;
  offers: ShoppingOffer[]; error: string | null;
}

export const offerSortOptions = [
  { value: 'source', label: 'Original order' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
] as const;
export const sellerFilterOptions = [
  { value: 'all', label: 'All sellers' },
  { value: 'verified', label: 'Verified retailer pages' },
  { value: 'recognized', label: 'Recognized domain or name' },
  { value: 'unassessed', label: 'Unassessed sellers' },
] as const;
export type OfferSort = typeof offerSortOptions[number]['value'];
export type SellerFilter = typeof sellerFilterOptions[number]['value'];
export interface OfferView { sort: OfferSort; seller: SellerFilter }
export const defaultOfferView: OfferView = { sort: 'source', seller: 'all' };

const retailerDomains = ['amazon.com', 'target.com', 'apple.com', 'bestbuy.com', 'walmart.com', 'ebay.com',
  'stockx.com', 'swappa.com', 'motorola.com'];
export function shoppingSellerEvidence(offer: ShoppingOffer) {
  let url: URL;
  try { url = new URL(offer.url); }
  catch { return { level: 'unassessed', label: 'Unassessed seller' }; }
  if (['google.com', 'www.google.com'].includes(url.hostname) && ['/url', '/aclk'].includes(url.pathname)) {
    const destination = url.pathname === '/url' ? url.searchParams.get('url') || url.searchParams.get('q') : url.searchParams.get('adurl');
    if (destination) {
      try { url = new URL(destination); }
      catch { return { level: 'unassessed', label: 'Unassessed seller' }; }
    }
  }
  const host = url.hostname.replace(/^www\./, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { level: 'unassessed', label: 'Unassessed seller' };
  }
  if (retailerDomains.includes(host)) {
    return offer.verification?.status === 'verified'
      ? { level: 'verified', label: 'Verified retailer page' }
      : { level: 'recognized', label: 'Recognized retailer domain' };
  }
  if (['google.com', 'www.google.com'].includes(url.hostname)
    && /^(?:amazon(?:\.com)?|target|apple(?: education store)?|best buy|walmart|ebay|stockx|swappa|motorola(?: - united states)?)$/i.test(offer.seller.trim())) {
    return { level: 'recognized', label: 'Recognized seller name only' };
  }
  return { level: 'unassessed', label: 'Unassessed seller' };
}

function shoppingListedPrice(offer: ShoppingOffer) {
  if (!/^\$\d[\d,]*(?:\.\d{2})?$/.test(offer.price)) return null;
  const price = Number(offer.price.replace(/[$,]/g, ''));
  return Number.isFinite(price) && price >= 0 ? price : null;
}
export function visibleShoppingOffers(offers: ShoppingOffer[], view: OfferView) {
  const filtered = offers.filter(offer => {
    const evidence = shoppingSellerEvidence(offer);
    return view.seller === 'all' || (view.seller === 'recognized' ? evidence.level !== 'unassessed' : evidence.level === view.seller);
  });
  if (view.sort === 'source') return filtered;
  return filtered.sort((a, b) => {
    const first = shoppingListedPrice(a), second = shoppingListedPrice(b);
    if (first == null) return second == null ? 0 : 1;
    if (second == null) return -1;
    return view.sort === 'price-asc' ? first - second : second - first;
  });
}

export function groupShoppingOffers(offers: ShoppingOffer[], sort: OfferSort = 'source') {
  const groups = new Map<string, { vendor: string; offers: ShoppingOffer[] }>();
  for (const offer of offers) {
    const name = offer.seller.trim().replace(/\s+/g, ' ') || 'Seller not identified';
    const normalized = name.toLowerCase();
    const vendor = /^apple(?: education store)?$/.test(normalized) ? 'Apple'
      : /^amazon(?:\.com)?$/.test(normalized) ? 'Amazon'
        : /^best\s*buy$/.test(normalized) ? 'Best Buy' : name;
    const key = vendor.toLowerCase();
    const group = groups.get(key);
    if (group) group.offers.push(offer);
    else groups.set(key, { vendor, offers: [offer] });
  }
  const result = Array.from(groups.values()).map(group => {
    const prices = group.offers.map(shoppingListedPrice).filter((price): price is number => price != null);
    return { ...group, lowestPrice: prices.length ? Math.min(...prices) : null };
  });
  if (sort === 'source') return result;
  return result.sort((a, b) => {
    if (a.lowestPrice == null) return b.lowestPrice == null ? 0 : 1;
    if (b.lowestPrice == null) return -1;
    return a.lowestPrice - b.lowestPrice;
  });
}

export function shoppingProductStatus(result: ShoppingSearch | null) {
  const offers = result?.offers.filter(offer => offer.match === 'text-match') ?? [];
  const stock = offers.map(offer => offer.verification?.status === 'verified'
    && typeof offer.verification.in_stock === 'boolean'
    ? offer.verification.in_stock ? 'in-stock' : 'out-of-stock'
    : offer.availability === 'reported-in-stock' ? 'in-stock'
      : offer.availability === 'reported-out-of-stock' ? 'out-of-stock' : 'unknown');
  const prices = offers.map(shoppingListedPrice).filter((price): price is number => price != null);
  return {
    stock: stock.includes('in-stock') ? 'in-stock'
      : stock.length && stock.every(value => value === 'out-of-stock') ? 'out-of-stock' : 'unknown',
    sale: offers.some(offer => Boolean(offer.sale_text)),
    lowestPrice: prices.length ? Math.min(...prices) : null,
  };
}
export const shoppingCardSchema = z.object({
  title: z.string().max(500), text: z.string().max(1600), url: z.string().max(10000),
  seller: z.string().max(200), price: z.string().max(30),
});
export const shoppingCardsSchema = z.array(shoppingCardSchema).max(100);

export function shoppingURL(input: ShoppingInput) {
  const url = new URL('https://www.google.com/search');
  url.search = new URLSearchParams({ q: [input.product, ...input.variants].join(' '), udm: '28', hl: 'en', gl: 'us' }).toString();
  return url;
}

export function isShoppingNavigation(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['www.google.com', 'google.com'].includes(url.hostname)
      && !url.port && !url.username && !url.password
      && (url.pathname === '/search' || url.pathname.startsWith('/shopping/product/'));
  } catch { return false; }
}

export function shoppingBlocked(url: string, text: string) {
  return /\/sorry(?:\/|$)/.test(new URL(url).pathname)
    || /unusual traffic|verify (?:that )?you are human|not a robot|before you continue to google/i.test(text);
}

export interface ShoppingCard { title: string; text: string; url: string; seller: string; price: string }

const normalized = (value: string) => value.toLowerCase().normalize('NFKC')
  .replace(/(\d+)\s+(gb|tb|inch)\b/g, '$1$2').replace(/[^a-z0-9]+/g, ' ').trim();
function contains(text: string, phrase: string) {
  return ` ${normalized(text)} `.includes(` ${normalized(phrase)} `);
}
export function matchShoppingCards(cards: ShoppingCard[], input: ShoppingInput): ShoppingOffer[] {
  const offers: ShoppingOffer[] = [];
  const seen = new Set<string>();
  for (const card of cards.slice(0, 100)) {
    if (!card.title || card.title.length > 500 || !/^\$\d[\d,]*(?:\.\d{2})?$/.test(card.price)) continue;
    let url: URL;
    try { url = new URL(card.url); } catch { continue; }
    if (!isPublicShoppingURL(url.href)) continue;
    const missing = [input.product, ...input.variants].filter(phrase => !contains(card.title, phrase));
    const accessory = /\b(case|shell|cover|sleeve|protector|charger|adapter|replacement|skin)\b/i.test(card.title);
    const condition = /\b(refurbished|renewed|used|pre[- ]owned|open[- ]box)\b/i.test(card.text);
    if (accessory) missing.push('Product, not an accessory');
    if (condition) missing.push('New condition not established');
    const positive = card.text.split('\n').map(line => line.trim()).find(line =>
      /^(?:in stock(?: online)?|(?:pick\s*up|pickup)(?: today| tomorrow| available)|available for (?:pickup|pick up)|only \d+ left in stock)[.!]?$/i.test(line));
    const negative = card.text.split('\n').map(line => line.trim()).find(line =>
      /^(?:out of stock|not in stock|sold out|currently unavailable)[.!]?$/i.test(line));
    const sale = card.text.split('\n').map(line => line.trim()).find(line =>
      /^(?:on sale|sale|sale price(?:\s*[:·-]?\s*\$\d[\d,]*(?:\.\d{2})?)?|\d{1,2}% off|save (?:\d{1,2}%|\$\d[\d,]*(?:\.\d{2})?))[.!]?$/i.test(line));
    const key = `${url.href}|${card.title}|${card.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      title: card.title, seller: card.seller || 'Seller not identified', url: url.href, price: card.price,
      availability: positive && !negative ? 'reported-in-stock' : negative && !positive ? 'reported-out-of-stock' : 'unknown',
      availability_text: positive && !negative ? positive : negative && !positive ? negative : 'No unambiguous stock label',
      match: missing.length ? 'uncertain' : 'text-match', missing,
      ...(sale ? { sale_text: sale } : {}),
      details: card.text.split('\n').map(line => line.trim()).filter(line =>
        /delivery|shipping|returns?|pick\s*up|pickup|in store|refurbished|renewed|pre[- ]owned|open[- ]box|sold by/i.test(line)
        && line !== card.title).slice(0, 8),
    });
  }
  return offers;
}

// Runs in the isolated search page; reads visible cards only and never clicks them.
export function extractShoppingCards(): ShoppingCard[] {
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const cards = new Set<Element>();
  const candidates = document.querySelectorAll('[data-docid], [data-product-id], .sh-dgr__content, .sh-dlr__list-result, [role="listitem"]');
  for (let index = 0; index < candidates.length; index++) {
    const element = candidates[index];
    if (visible(element)) cards.add(element);
  }
  const anchors = document.querySelectorAll('a[href]');
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (!visible(anchor)) continue;
    let parent: Element | null = anchor;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      const text = (parent as HTMLElement).innerText || '';
      if (text.length > 1600) break;
      if (/\$\d/.test(text) && parent.querySelector('h3, h4, [role="heading"]')) {
        cards.add(parent); break;
      }
    }
  }
  const result: ShoppingCard[] = [];
  const groups = Array.from(cards);
  for (let index = 0; index < groups.length; index++) {
    const card = groups[index];
    if (groups.some(parent => parent !== card && parent.contains(card)
      && ((parent as HTMLElement).innerText || '').length <= 1600
      && Array.from(parent.querySelectorAll('h3, h4, [role="heading"]')).filter(visible).length === 1
      && new Set(((parent as HTMLElement).innerText || '').match(/\$\d[\d,]*(?:\.\d{2})?/g) || []).size === 1)) continue;
    const text = ((card as HTMLElement).innerText || '').trim();
    if (!text || text.length > 1600) continue;
    const prices = text.match(/\$\d[\d,]*(?:\.\d{2})?/g) || [];
    const price = prices[0];
    if (!price || new Set(prices).size !== 1) continue;
    const headings = Array.from(card.querySelectorAll('h3, h4, [role="heading"]')).filter(visible);
    if (headings.length !== 1) continue;
    const title = (headings[0] as HTMLElement).innerText.trim();
    const anchor = headings[0].closest('a[href]') || card.querySelector('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) continue;
    const url = new URL(anchor.href);
    if (['www.google.com', 'google.com'].includes(url.hostname) && url.pathname === '/url') {
      const destination = url.searchParams.get('url') || url.searchParams.get('q');
      if (!destination) continue;
      try { url.href = new URL(destination).href; } catch { continue; }
    }
    const sellerLabels = Array.from(card.querySelectorAll('[aria-label^="From "]')).filter(visible)
      .map(element => (element.getAttribute('aria-label') || '').slice(5).trim());
    const seller = new Set(sellerLabels).size === 1 ? sellerLabels[0] : text.split('\n').map(line => line.trim()).find(line =>
      /^(?:Target|Best Buy|Walmart|Apple|Amazon(?:\.com)?|Costco|B&H|Newegg|Micro Center|Adorama|GameStop|DoorDash)$/i.test(line)) || '';
    result.push({ title, text: text.slice(0, 1600), url: url.href, seller: seller || '', price });
    if (result.length >= 100) break;
  }
  return result;
}
