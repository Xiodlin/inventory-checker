import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { sampleNotifications } from '../../../.storybook/desktopApiStub';
import NotificationPanel from './NotificationPanel';

const meta = {
  title: 'Monitoring/Notifications',
  component: NotificationPanel,
  tags: ['autodocs'],
  args: { notifications: sampleNotifications, onRead: fn(), onClear: fn(), onDismiss: fn(), onOpen: fn() },
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

export const Empty: Story = {
  args: { notifications: [] },
  play: async ({ canvas }) => {
    const clear = canvas.getByRole('button', { name: 'Clear notifications' });
    await expect(clear).toBeDisabled();
    await expect(getComputedStyle(clear).cursor).toBe('default');
  },
};

export const DismissFailure: Story = {
  args: { notifications: sampleNotifications.filter(alert => !alert.delivery_error),
    onDismiss: fn(async () => { throw new Error('Could not delete notification'); }) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Could not delete notification');
  },
};

export const IndividualActions: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: `Open product for ${sampleNotifications[0].title}` }));
    await expect(args.onOpen).toHaveBeenCalledWith(sampleNotifications[0]);
    await userEvent.click(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` }));
    await expect(args.onDismiss).toHaveBeenCalledWith(sampleNotifications[0].id);
  },
};

export const ClearsWithConfirmation: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
    await expect(args.onClear).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onClear).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Delete all notifications' }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const ClearFailure: Story = {
  args: { notifications: [sampleNotifications[0]], onClear: fn(async () => { throw new Error('Could not clear local alerts'); }) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Delete all notifications' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Could not clear local alerts');
    await expect(canvas.getByRole('button', { name: 'Delete all notifications' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` })).toBeVisible();
  },
};

let finishClear: (() => void) | undefined;
export const ClearingInProgress: Story = {
  args: { onClear: fn(() => new Promise<void>(resolve => { finishClear = resolve; })) },
  play: async ({ canvas, userEvent }) => {
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Delete all notifications' }));
      await expect(canvas.getByRole('button', { name: 'Clearing…' })).toBeDisabled();
      await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      await expect(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` })).toBeDisabled();
    } finally { finishClear?.(); finishClear = undefined; }
  },
};

export const DeliveryFailure: Story = {
  args: { notifications: sampleNotifications.filter(alert => alert.delivery_error) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Device alert not delivered: Notifications are disabled at the OS level',
    );
  },
};
