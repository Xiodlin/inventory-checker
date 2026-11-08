import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { sampleNotifications } from '../../../.storybook/desktopApiStub';
import NotificationPanel from './NotificationPanel';

const meta = {
  component: NotificationPanel,
  tags: ['ai-generated'],
  args: { notifications: sampleNotifications, onRead: fn() },
} satisfies Meta<typeof NotificationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedReadStates: Story = {
  play: async ({ args, canvas, userEvent }) => {
    // Only unread notifications expose a "Mark read" action.
    const markReadButtons = canvas.getAllByRole('button', { name: 'Mark read' });
    await expect(markReadButtons).toHaveLength(2);
    await userEvent.click(markReadButtons[0]);
    await expect(args.onRead).toHaveBeenCalledWith(sampleNotifications[0].id);
  },
};

export const Empty: Story = { args: { notifications: [] } };

export const DeliveryFailure: Story = {
  args: { notifications: sampleNotifications.filter(alert => alert.delivery_error) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Device alert not delivered: Notifications are disabled at the OS level',
    );
  },
};
