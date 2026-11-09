import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import AddItem from './AddItem';

const meta = {
  title: 'Legacy/Direct add form',
  component: AddItem,
  tags: ['autodocs'],
  args: { onAdd: fn() },
} satisfies Meta<typeof AddItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SubmitsTrackedProduct: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Brand'), 'Sony');
    await userEvent.type(canvas.getByLabelText('Model'), 'WH-1000XM5');
    await userEvent.click(canvas.getByRole('button', { name: /add product/i }));
    await expect(args.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        retailer: 'amazon',
        brand: 'Sony',
        model: 'WH-1000XM5',
        notify_stock: true,
        notify_price: false,
      }),
    );
  },
};

export const RequiresProductIdentifier: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /add product/i }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Provide a product URL, SKU, or model.');
    await expect(args.onAdd).not.toHaveBeenCalled();
  },
};

export const ApplePickupFields: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByLabelText('Retailer'), 'apple');
    await userEvent.selectOptions(canvas.getByLabelText('Availability type'), 'pickup');
    await expect(canvas.getByLabelText('Pickup ZIP code')).toBeVisible();
    await expect(canvas.getByLabelText('Search radius (miles)')).toHaveValue(50);
  },
};

export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /add product/i });
    await expect(button).toHaveClass('ui-button--primary');
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};
