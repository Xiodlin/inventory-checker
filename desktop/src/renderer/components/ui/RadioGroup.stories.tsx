import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { RadioGroup } from '../UI';

const meta = {
  title: 'Components/Forms/Radio Group', component: RadioGroup, tags: ['autodocs'],
  args: {
    label: 'Price direction',
    options: [{ value: 'ascending', label: 'Low to high' }, { value: 'descending', label: 'High to low' }],
  },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unselected: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Low to high' }));
    await userEvent.click(canvas.getByRole('radio', { name: 'High to low' }));
    await expect(canvas.getByRole('radio', { name: 'High to low' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Low to high' })).not.toBeChecked();
  },
};
export const Selected: Story = { args: { defaultValue: 'ascending' } };
export const WithHelpText: Story = { args: { help: 'Changes the listing order inside each vendor group.' } };
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'ascending' },
  play: async ({ canvas }) => {
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).toBeDisabled();
  },
};
export const DisabledOption: Story = {
  args: { options: [{ value: 'ascending', label: 'Low to high' }, { value: 'descending', label: 'High to low', disabled: true }] },
};
