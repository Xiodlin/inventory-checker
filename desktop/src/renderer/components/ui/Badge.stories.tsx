import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../UI';

const meta = {
  title: 'Components/Display/Badge', component: Badge, tags: ['autodocs'],
  args: { children: 'Stock unknown', tone: 'neutral' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Non-interactive status label. Meaning is always written out; color is supplemental. Example values do not infer stock, sale, or seller safety from a price.' } } },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Neutral: Story = {};
export const InStock: Story = { args: { tone: 'success', children: 'In Stock' } };
export const OutOfStock: Story = { args: { tone: 'error', children: 'Out of Stock' } };
export const OnSale: Story = { args: { tone: 'accent', children: 'On Sale' } };
export const LastKnown: Story = { args: { tone: 'warning', children: 'Last known' } };
export const VerifiedEvidence: Story = { args: { tone: 'info', children: 'Verified retailer page' } };
export const LowestPrice: Story = { args: { tone: 'info', children: 'Lowest found: $1,999.00' } };
export const AllTones: Story = {
  render: () => <div className="ui-row">
    <Badge>Stock unknown</Badge><Badge tone="success">In Stock</Badge><Badge tone="error">Out of Stock</Badge>
    <Badge tone="accent">On Sale</Badge><Badge tone="warning">Last known</Badge><Badge tone="info">Verified retailer page</Badge>
  </div>,
};
