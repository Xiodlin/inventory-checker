import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Badge, Table } from '../UI';

const heading = <thead><tr><th scope="col">Vendor</th><th scope="col">Listed price (USD)</th><th scope="col">Stock</th></tr></thead>;
const rows = <tbody><tr><th scope="row">Apple</th><td>$1,999.00</td><td><Badge tone="success">In Stock</Badge></td></tr><tr><th scope="row">eBay</th><td>$2,099.00</td><td><Badge>Stock unknown</Badge></td></tr></tbody>;
const meta = {
  title: 'Components/Data/Table', component: Table, tags: ['autodocs'],
  args: { caption: 'Example retailer offers', children: <>{heading}{rows}</> },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Native table with caption and scoped headers. The named wrapper can receive keyboard focus so a wide table can scroll without widening the whole page. Use tables for comparable data, not layout.' } } },
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toHaveAccessibleName('Example retailer offers');
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(3);
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(2);
  },
};
export const Empty: Story = { args: { children: <>{heading}<tbody><tr><td colSpan={3}>No offers match the current filters.</td></tr></tbody></> } };
export const NarrowContainer: Story = { render: args => <div style={{ maxWidth: 280 }}><Table {...args} /></div> };
export const KeyboardScrollable: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('region')).toHaveFocus();
  },
};
