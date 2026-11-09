import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { IconButton } from '../Button';

const meta = {
  title: 'Components/Actions/Icon Button', component: IconButton, tags: ['autodocs'],
  args: { label: 'Add product', icon: '+', onClick: fn(), variant: 'secondary' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Icon-only action with a required accessible label and a minimum 44px hit target. The icon is decorative; use a visible text button when the action would otherwise be ambiguous.' } } },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Add product' });
    await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Close: Story = { args: { label: 'Close dialog', icon: '×', variant: 'ghost' } };
export const Destructive: Story = { args: { label: 'Delete product', icon: '×', variant: 'danger' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = {
  args: { loading: true, label: 'Adding product' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Adding product' })).toBeDisabled();
    await expect(canvas.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  },
};
export const FocusVisible: Story = { render: args => <IconButton {...args} data-preview-state="focus" /> };
