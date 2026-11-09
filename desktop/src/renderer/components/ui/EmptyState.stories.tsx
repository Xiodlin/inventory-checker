import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '../UI';
import { Button } from '../Button';

const meta = {
  title: 'Components/Display/Empty State', component: EmptyState, tags: ['autodocs'],
  args: { title: 'No tracked products', children: 'Add a product to begin monitoring stock and prices.' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithAction: Story = { args: { action: <Button>Add example product</Button> } };
export const NoResults: Story = { args: { title: 'No matching offers', children: 'Try a broader query or remove a seller filter.', action: <Button variant="secondary">Reset example filters</Button> } };
export const Notifications: Story = { args: { title: 'No notifications', children: 'New stock and price alerts will appear here.' } };
