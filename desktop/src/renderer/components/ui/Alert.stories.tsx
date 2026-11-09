import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Alert } from '../UI';
import { Button } from '../Button';

const meta = {
  title: 'Components/Feedback/Alert', component: Alert, tags: ['autodocs'],
  args: { tone: 'info', title: 'Monitoring paused', children: 'Checks resume when enabled.' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Static feedback is not a live region by default. Choose role="status" for newly appearing routine updates or role="alert" for urgent errors. Tone alone does not determine announcement behavior.' } } },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Info: Story = {};
export const Success: Story = { args: { tone: 'success', title: 'Saved', children: 'Your preferences were saved on this device.' } };
export const Warning: Story = { args: { tone: 'warning', title: 'Last known observation', children: 'The latest check failed. These results may be stale.' } };
export const Error: Story = { args: { tone: 'error', title: 'Check failed', children: 'The retailer blocked this request. Retry later.' } };
export const WithAction: Story = { args: { tone: 'error', title: 'Could not save', children: <div className="ui-stack"><p>Your changes have not been saved.</p><Button variant="secondary">Retry example</Button></div> } };
export const PoliteStatus: Story = {
  args: { tone: 'success', title: 'Check completed', role: 'status', children: 'Two matching offers were found.' },
  play: async ({ canvas }) => { await expect(canvas.getByRole('status')).toHaveTextContent('Two matching offers'); },
};
export const UrgentError: Story = {
  args: { tone: 'error', title: 'Save failed', role: 'alert', children: 'Keep this form open and try again.' },
};
