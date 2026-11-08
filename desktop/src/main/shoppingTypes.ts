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
}
export interface ShoppingSearch {
  id: string; input: ShoppingInput; checked_at: string;
  offers: ShoppingOffer[]; error: string | null;
}

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
      /^(?:in stock online|in stock|pick\s*up today|pickup today)[.!]?$/i.test(line));
    const negative = card.text.split('\n').map(line => line.trim()).find(line =>
      /^(?:out of stock|not in stock|sold out|currently unavailable)[.!]?$/i.test(line));
    const key = `${url.href}|${card.title}|${card.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      title: card.title, seller: card.seller || 'Seller not identified', url: url.href, price: card.price,
      availability: positive && !negative ? 'reported-in-stock' : negative && !positive ? 'reported-out-of-stock' : 'unknown',
      availability_text: positive && !negative ? positive : negative && !positive ? negative : 'No unambiguous stock label',
      match: missing.length ? 'uncertain' : 'text-match', missing,
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
  for (const element of document.querySelectorAll('[data-docid], [data-product-id], .sh-dgr__content, .sh-dlr__list-result, [role="listitem"]')) {
    if (visible(element)) cards.add(element);
  }
  for (const anchor of document.querySelectorAll('a[href]')) {
    if (!visible(anchor)) continue;
    let parent: Element | null = anchor;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      const text = (parent as HTMLElement).innerText ?? '';
      if (text.length > 1600) break;
      if (/\$\d/.test(text) && parent.querySelector('h3, h4, [role="heading"]')) {
        cards.add(parent); break;
      }
    }
  }
  const result: ShoppingCard[] = [];
  for (const card of cards) {
    const text = (card as HTMLElement).innerText?.trim() ?? '';
    if (!text || text.length > 1600) continue;
    const prices = [...text.matchAll(/\$\d[\d,]*(?:\.\d{2})?/g)].map(match => match[0]);
    if (!prices.length || new Set(prices).size !== 1) continue;
    const headings = [...card.querySelectorAll('h3, h4, [role="heading"]')].filter(visible);
    if (headings.length !== 1) continue;
    const title = (headings[0] as HTMLElement).innerText.trim();
    const anchor = headings[0].closest('a[href]') ?? card.querySelector('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) continue;
    const url = new URL(anchor.href);
    if (['www.google.com', 'google.com'].includes(url.hostname) && url.pathname === '/url') {
      const destination = url.searchParams.get('url') ?? url.searchParams.get('q');
      if (!destination) continue;
      try { url.href = new URL(destination).href; } catch { continue; }
    }
    const seller = text.split('\n').map(line => line.trim()).find(line =>
      /^(?:Target|Best Buy|Walmart|Apple|Amazon(?:\.com)?|Costco|B&H|Newegg|Micro Center|Adorama|GameStop|DoorDash)$/i.test(line)) ?? '';
    result.push({ title, text: text.slice(0, 1600), url: url.href, seller, price: prices[0] });
    if (result.length >= 100) break;
  }
  return result;
}
