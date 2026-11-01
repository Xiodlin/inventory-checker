export interface Item {
  id: string; user_id: string; retailer: 'amazon' | 'target' | 'bestbuy' | 'apple';
  brand: string | null; model: string | null; sku: string | null; url: string | null;
  target_price: number | null; current_price: number | null; in_stock: boolean | null;
  last_checked_at: string | null; last_check_error: string | null;
}
