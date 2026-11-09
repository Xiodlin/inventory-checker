import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Input } from '../UI';

const meta = {
  title: 'Components/Forms/Input', component: Input, tags: ['autodocs'],
  args: { label: 'Product name', placeholder: 'MacBook Neo', disabled: false, readOnly: false, required: false },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Native single-line input with an explicit label, unique IDs, associated help/error text, and forwarded ref. Use type for search, URL, number, or password; never use a placeholder instead of a label.' } } },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Product name' });
    await userEvent.type(input, 'iPhone Duo');
    await expect(input).toHaveValue('iPhone Duo');
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};
export const Filled: Story = { args: { defaultValue: 'MacBook Neo' } };
export const WithHelpText: Story = {
  args: { help: 'Include the model, capacity, and color.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAccessibleDescription('Include the model, capacity, and color.');
  },
};
export const Required: Story = { args: { required: true, help: 'This field must be filled before saving.' } };
export const Error: Story = {
  args: { defaultValue: 'Ma', help: 'Use the product name.', error: 'Enter at least 3 characters.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('textbox')).toHaveAccessibleDescription('Use the product name. Enter at least 3 characters.');
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: 'Unavailable while saving' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'Reference only' } };
export const Search: Story = { args: { type: 'search', label: 'Search products', placeholder: 'Filter watchlist' } };
export const Number: Story = { args: { type: 'number', label: 'Check interval', min: 5, max: 10080, defaultValue: 15, help: 'Minutes, from 5 to 10,080.' } };
export const Url: Story = { args: { type: 'url', label: 'Example link', placeholder: 'https://store.example/product' } };
export const Password: Story = { args: { type: 'password', label: 'Secret', defaultValue: 'example-only', autoComplete: 'new-password' } };
export const KeyboardFocus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('textbox')).toHaveFocus();
    await expect(getComputedStyle(canvas.getByRole('textbox')).outlineStyle).toBe('solid');
  },
};
