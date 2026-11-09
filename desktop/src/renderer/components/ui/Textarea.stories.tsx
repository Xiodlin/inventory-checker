import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Textarea } from '../UI';

const meta = {
  title: 'Components/Forms/Textarea', component: Textarea, tags: ['autodocs'],
  args: { label: 'Notes', placeholder: 'Add optional product notes', rows: 4 },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Indigo model{Enter}256GB capacity');
    await expect(canvas.getByRole('textbox')).toHaveValue('Indigo model\n256GB capacity');
  },
};
export const Filled: Story = { args: { defaultValue: 'Compare only the Indigo model.' } };
export const WithHelpText: Story = { args: { maxLength: 500, help: 'Optional. Maximum 500 characters.' } };
export const Error: Story = {
  args: { error: 'Remove unsupported characters.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('textbox')).toHaveAccessibleDescription('Remove unsupported characters.');
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: 'Saving notes' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'Imported reference notes' } };
