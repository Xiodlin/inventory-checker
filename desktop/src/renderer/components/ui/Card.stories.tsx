import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Badge, Card, HelpText } from '../UI';
import { Button } from '../Button';

const meta = {
  title: 'Components/Display/Card', component: Card, tags: ['autodocs'],
  args: { title: 'Product overview', description: 'A surface grouping related information.', children: 'Card body content.' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Named article with a heading, optional description, body and footer. The card itself is not a button; give individual actions their own controls. Existing application product cards remain covered under Monitoring.' } } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas }) => { await expect(canvas.getByRole('article')).toHaveAccessibleName('Product overview'); },
};
export const Raised: Story = { args: { variant: 'raised' } };
export const Outlined: Story = { args: { variant: 'outlined' } };
const onCheck = fn();
export const WithActions: Story = {
  args: { footer: <div className="ui-row"><Button onClick={onCheck}>Check now</Button><Button variant="ghost">Edit</Button></div> },
  beforeEach: () => { onCheck.mockClear(); },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Check now' }));
    await expect(onCheck).toHaveBeenCalledOnce();
  },
};
export const Product: Story = {
  args: {
    title: 'MacBook Neo', description: '256GB / Indigo',
    children: <div className="ui-stack"><div className="ui-row"><Badge tone="success">In Stock</Badge><Badge tone="info">Lowest found: $1,999.00</Badge></div><HelpText>Example listing price, before tax and shipping.</HelpText></div>,
    footer: <Button variant="secondary">View example offers</Button>,
  },
};
export const LongContent: Story = { args: { title: 'A product with a longer descriptive title and several important model qualifiers', description: 'This example demonstrates wrapping on a narrow card rather than truncating important product details.', children: <p>Text remains available at small viewport widths. Card actions and labels can wrap without hiding product information.</p> } };
export const BusyAction: Story = { args: { footer: <Button loading>Checking…</Button> } };
