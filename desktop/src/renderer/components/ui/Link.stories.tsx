import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Link } from '../UI';

const meta = {
  title: 'Components/Navigation/Link', component: Link, tags: ['autodocs'],
  args: { href: '#example-reference', children: 'View example reference' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Native anchor for navigation, never an action button. Use descriptive text. New-tab examples explicitly disclose the behavior and set rel="noopener noreferrer". Links do not have a native disabled state; render text when navigation is unavailable.' } } },
} satisfies Meta<typeof Link>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ExternalNewTab: Story = {
  args: { href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer', children: 'View retailer (opens new tab)' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(canvas.getByRole('link')).toHaveAttribute('target', '_blank');
  },
};
export const LongLabel: Story = { args: { children: 'Read the full explanation of monitoring intervals, device sleep, and notification delivery' } };
export const KeyboardFocus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('link')).toHaveFocus();
    await expect(getComputedStyle(canvas.getByRole('link')).outlineStyle).toBe('solid');
  },
};
function InternalLink() {
  const id = useId();
  return <div className="ui-stack"><Link href={`#${id}`}>Jump to reference</Link><p id={id} tabIndex={-1}>Reference destination in this story.</p></div>;
}
export const InPageDestination: Story = { render: () => <InternalLink /> };
