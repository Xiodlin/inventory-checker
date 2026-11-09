import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { installDesktopApiStub, sampleItems, sampleWatches } from '../../../.storybook/desktopApiStub';
import ShoppingDiscovery from './ShoppingDiscovery';
import Dashboard from './Dashboard';

const meta = {
  title: 'Monitoring/Tracked products',
  component: ShoppingDiscovery,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Unified generalized-search add flow and watchlist. All fixtures are local: no Google, retailer, credential, or operating-system requests.' } } },
} satisfies Meta<typeof ShoppingDiscovery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  beforeEach: () => { installDesktopApiStub({}, { watches: [] }); },
};
export const Pending: Story = {
  beforeEach: () => { installDesktopApiStub({ shoppingWatches: async () => [{ ...sampleWatches[0], result: null, last_checked_at: null }] }); },
  play: async ({ canvas }) => { await expect(await canvas.findByText('Stock unknown')).toBeVisible(); },
};
export const OutOfStock: Story = {
  beforeEach: () => {
    const watch = structuredClone(sampleWatches[0]);
    watch.result!.offers = watch.result!.offers.filter(offer => offer.match === 'text-match').map(offer => ({
      ...offer, availability: 'reported-out-of-stock', availability_text: 'Out of stock', verification: undefined, sale_text: undefined,
    }));
    installDesktopApiStub({ shoppingWatches: async () => [watch] });
  },
  play: async ({ canvas }) => { await expect(await canvas.findByText('Out of Stock')).toBeVisible(); },
};
export const UnknownStock: Story = {
  beforeEach: () => {
    const watch = structuredClone(sampleWatches[0]);
    watch.result!.offers = watch.result!.offers.map(offer => ({ ...offer, availability: 'unknown', verification: undefined, sale_text: undefined }));
    installDesktopApiStub({ shoppingWatches: async () => [watch] });
  },
};
export const RetainedAfterFailure: Story = {
  beforeEach: () => { installDesktopApiStub({ shoppingWatches: async () => [{ ...sampleWatches[0], error: 'Google requires verification. No bypass attempted.' }] }); },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Last known')).toBeVisible();
    await expect(canvas.getByText('Lowest found: $1,999.00')).toBeVisible();
  },
};
export const Paused: Story = {
  beforeEach: () => { installDesktopApiStub({ settings: async () => ({ notifications_enabled: false, background_enabled: false, check_interval_minutes: 30 }) }); },
};
export const NoMatches: Story = {
  beforeEach: () => {
    const watch = structuredClone(sampleWatches[0]); watch.result!.offers = [];
    installDesktopApiStub({ shoppingWatches: async () => [watch] });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Stock unknown');
    await userEvent.click(canvas.getByText('Details and latest offers'));
    await expect(canvas.getByText('No required-text matches for this filter.')).toBeVisible();
  },
};

export const AddsAndRemovesProduct: Story = {
  ...Empty,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('No products yet. Add a product above to start monitoring.');
    await userEvent.click(canvas.getByText('Add product', { selector: 'summary' }));
    await userEvent.type(canvas.getByLabelText('Product / model name'), 'iPhone Duo');
    await userEvent.type(canvas.getByLabelText('Required variant phrases (comma-separated)'), '256GB');
    await userEvent.click(canvas.getByRole('button', { name: 'Add product' }));
    await expect(await canvas.findByRole('heading', { name: 'iPhone Duo · 256GB' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove product' }));
    await expect(await canvas.findByText('No products yet. Add a product above to start monitoring.')).toBeVisible();
  },
};
export const SaveFailure: Story = {
  beforeEach: () => { installDesktopApiStub({ saveShoppingWatch: async () => { throw new Error('Local storage is unavailable'); } }); },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('Add product', { selector: 'summary' }));
    await userEvent.type(canvas.getByLabelText('Product / model name'), 'iPhone Duo');
    await userEvent.type(canvas.getByLabelText('Required variant phrases (comma-separated)'), '256GB');
    await userEvent.click(canvas.getByRole('button', { name: 'Add product' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Local storage is unavailable');
  },
};
export const VendorSortingAndConfidence: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByText('Details and latest offers'));
    const root = canvas.getByText('Details and latest offers').parentElement!;
    const vendors = () => [...root.querySelectorAll(':scope > .vendor-groups > details')];
    await userEvent.selectOptions(canvas.getByLabelText('Sort offers'), 'price-desc');
    await waitFor(() => expect(vendors().map(group => group.querySelector('summary')!.textContent)).toEqual([
      'Apple2 listings', 'eBay3 listings', 'Unassessed shop1 listing',
    ]));
    const ebay = vendors()[1];
    await userEvent.click(within(ebay as HTMLElement).getByText('eBay', { selector: 'summary' }));
    await expect([...ebay.querySelectorAll('.discovery-price')].map(node => node.textContent)).toEqual(['$2,989.00', '$2,599.00', '$2,099.00']);
    await userEvent.selectOptions(canvas.getByLabelText('Sort offers'), 'price-asc');
    await expect([...ebay.querySelectorAll('.discovery-price')].map(node => node.textContent)).toEqual(['$2,099.00', '$2,599.00', '$2,989.00']);
    await userEvent.selectOptions(canvas.getByLabelText('Seller confidence'), 'verified');
    await expect(vendors()).toHaveLength(1);
    await userEvent.click(within(vendors()[0] as HTMLElement).getByText('Apple', { selector: 'summary' }));
    await expect(canvas.getByText('Verified retailer page')).toBeVisible();
    await expect(canvas.getByText('Free returns')).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText('Seller confidence'), 'unassessed');
    await expect(vendors()).toHaveLength(1);
    await expect(vendors()[0]).toHaveTextContent('Unassessed shop');
  },
};
export const UncertainOffersAndCopyLink: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByText('Details and latest offers'));
    await userEvent.click(canvas.getByText('Uncertain matches (1)'));
    await userEvent.click(canvas.getByText('Target', { selector: 'summary' }));
    const uncertain = canvas.getByText('Uncertain matches (1)').closest('details')!;
    await userEvent.click(within(uncertain).getByText('Offer link', { selector: 'summary' }));
    const link = within(uncertain).getByLabelText('Copy this link into your browser');
    await userEvent.click(link);
    await expect((link as HTMLInputElement).selectionEnd).toBe((link as HTMLInputElement).value.length);
  },
};
export const MultipleProductsIndependentFilters: Story = {
  beforeEach: () => {
    const second = structuredClone(sampleWatches[0]); second.id = 'watch-2'; second.input = { product: 'Second product', variants: ['256GB'] };
    installDesktopApiStub({ shoppingWatches: async () => [sampleWatches[0], second] });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Second product · 256GB' });
    for (const summary of canvas.getAllByText('Details and latest offers')) await userEvent.click(summary);
    const filters = canvas.getAllByLabelText('Seller confidence');
    await userEvent.selectOptions(filters[0], 'verified');
    await expect(filters[1]).toHaveValue('all');
  },
};
export const CompactViewport: Story = {
  globals: { viewport: { value: 'tablet', isRotated: false } },
  parameters: { viewport: { options: { tablet: { name: 'Compact desktop', styles: { width: '900px', height: '820px' }, type: 'tablet' } } } },
  play: async ({ canvas }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    const root = canvas.getByText('Add product', { selector: 'summary' }).closest('details')!;
    await expect(root.getBoundingClientRect().height).toBeLessThan(90);
    await expect(root.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(root.ownerDocument.documentElement.clientWidth);
  },
};
export const LegacyProductsInUnifiedList: Story = {
  args: { existingCount: sampleItems.length, existingProducts: <Dashboard embedded items={sampleItems} onDelete={async () => {}} /> },
};
