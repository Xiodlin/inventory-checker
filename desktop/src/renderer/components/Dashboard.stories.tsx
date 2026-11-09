import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { sampleItems } from '../../../.storybook/desktopApiStub';
import Dashboard from './Dashboard';

const meta = {
  title: 'Legacy/Direct retailer products',
  component: Dashboard,
  tags: ['autodocs'],
  args: { items: sampleItems, onDelete: fn() },
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TrackedProducts: Story = {};

export const Empty: Story = { args: { items: [] } };

export const PickupItemOnly: Story = {
  args: { items: sampleItems.filter(item => item.fulfillment === 'pickup') },
};

export const PriceHistoryDetails: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: 'Details' })[0]);
    // Price history arrives asynchronously from the desktop bridge stub.
    await expect(await canvas.findByText(/stock and price history/i)).toBeVisible();
    await expect(await canvas.findByText('$348.00')).toBeVisible();
  },
};

export const RemovesItem: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: 'Remove' })[0]);
    await expect(args.onDelete).toHaveBeenCalledWith(sampleItems[0].id);
  },
};
