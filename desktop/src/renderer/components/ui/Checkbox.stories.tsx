import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Checkbox } from '../UI';

const meta = {
  title: 'Components/Forms/Checkbox', component: Checkbox, tags: ['autodocs'],
  args: { label: 'Stock alerts', disabled: false },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unchecked: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox'));
    await expect(canvas.getByRole('checkbox')).toBeChecked();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('checkbox')).not.toBeChecked();
  },
};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = {
  args: { label: 'Select all products', indeterminate: true, help: 'Some products are selected.' },
  play: async ({ canvas }) => { await expect(canvas.getByRole('checkbox')).toBePartiallyChecked(); },
};
export const WithHelpText: Story = { args: { help: 'Notify when matching stock becomes available.' } };
export const Error: Story = { args: { error: 'Select this option to continue.' } };
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox'));
    await expect(canvas.getByRole('checkbox')).not.toBeChecked();
  },
};
export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };
