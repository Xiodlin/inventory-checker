import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Disclosure } from '../UI';

const meta = {
  title: 'Components/Display/Disclosure', component: Disclosure, tags: ['autodocs'],
  args: { summary: 'Apple - 2 listings', children: <ul><li>$1,999.00 - Apple</li><li>$1,999.00 - Apple Education Store</li></ul> },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Native details/summary disclosure. Enter or Space on the summary toggles it. Keep links and actions in the body, not nested inside the summary.' } } },
} satisfies Meta<typeof Disclosure>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Collapsed: Story = {
  play: async ({ canvas, userEvent }) => {
    const summary = canvas.getByText('Apple - 2 listings');
    await expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    await expect(summary.closest('details')).toHaveAttribute('open');
    await expect(canvas.getByText('$1,999.00 - Apple Education Store')).toBeVisible();
    await userEvent.click(summary);
    await expect(summary.closest('details')).not.toHaveAttribute('open');
  },
};
export const Expanded: Story = { args: { open: true } };
export const HelpSection: Story = { args: { summary: 'How do check intervals work?', children: <p>Checks require this device to be awake and the application to be running. Missed checks resume when the app becomes available.</p> } };
export const Nested: Story = {
  args: { summary: 'Product details', open: true, children: <Disclosure summary="Seller evidence"><p>A recognized site is not a guarantee of seller safety.</p></Disclosure> },
};
