import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Select } from '../UI';

const options = <><option value="">Choose an order</option><option value="ascending">Price: low to high</option><option value="descending">Price: high to low</option><option value="rating" disabled>Rating (unavailable)</option></>;
const meta = {
  title: 'Components/Forms/Select', component: Select, tags: ['autodocs'],
  args: { label: 'Sort offers', children: options, defaultValue: '' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox'), 'descending');
    await expect(canvas.getByRole('combobox')).toHaveValue('descending');
    await expect(canvas.getByRole('option', { name: 'Rating (unavailable)' })).toBeDisabled();
  },
};
export const Selected: Story = { args: { defaultValue: 'ascending' } };
export const WithHelpText: Story = { args: { help: 'Groups remain ordered by their lowest price.' } };
export const Error: Story = {
  args: { required: true, error: 'Choose a price order.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveAccessibleDescription('Choose a price order.');
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: 'ascending' } };
