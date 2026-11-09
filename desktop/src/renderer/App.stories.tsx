import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import type { NotificationTarget } from '@inventory-checker/core';
import { installDesktopApiStub, sampleNotifications } from '../../.storybook/desktopApiStub';
import App from './App';

const meta = {
  title: 'Application/Desktop dashboard',
  component: App,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

export const UnifiedDashboard: Story = {};
export const DesignSystemApplied: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    const workspace = canvasElement.querySelector<HTMLElement>('.workspace')!;
    const check = canvas.getByRole('button', { name: 'Check now' });
    await expect(check).toHaveClass('ui-button--primary');
    await expect(canvas.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toHaveClass('ui-button');
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    workspace.style.setProperty('--action-primary-bg', 'rgb(100, 40, 120)');
    workspace.style.setProperty('--bg-surface', 'rgb(20, 30, 40)');
    try {
      await waitFor(() => expect(getComputedStyle(check).backgroundColor).toBe('rgb(100, 40, 120)'));
      await expect(getComputedStyle(workspace.querySelector('.panel')!).backgroundColor).toBe('rgb(20, 30, 40)');
    } finally {
      workspace.style.removeProperty('--action-primary-bg');
      workspace.style.removeProperty('--bg-surface');
    }
    await userEvent.click(canvas.getByRole('button', { name: /Settings/ }));
    await expect(canvas.getByLabelText('Desktop notifications')).toHaveAccessibleDescription('Receive native alerts while the app is running in the tray.');
    await expect(canvas.getByLabelText('Check interval (minutes)')).toBeRequired();
    await expect(canvas.getByRole('button', { name: 'Save preferences' })).toHaveAttribute('type', 'submit');
  },
};
export const EmptyDevice: Story = {
  beforeEach: () => { installDesktopApiStub({ items: async () => [], shoppingWatches: async () => [], notifications: async () => [] }); },
};
export const CheckNowFeedback: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: 'Check now' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('Checked 4 products: 3 succeeded, 1 failed.');
  },
};
export const DismissAndClearNotifications: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /♧ Notifications/ }));
    await userEvent.click(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: `Dismiss ${sampleNotifications[0].title}` })).not.toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[1].title}` })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('button', { name: `Dismiss ${sampleNotifications[1].title}` })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear notifications' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Delete all notifications' }));
    await expect(await canvas.findByText("You're all caught up")).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Clear notifications' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /♧ Notifications/ })).not.toHaveTextContent(/[0-9]/);
  },
};
export const NotificationToDirectProduct: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /♧ Notifications/ }));
    await userEvent.click(canvas.getByRole('button', { name: `Open product for ${sampleNotifications[0].title}` }));
    await waitFor(() => expect(canvas.getByText('WH-1000XM5', { selector: 'strong' }).closest('tr')).toHaveClass('notification-target'));
  },
};
export const NotificationToShoppingProduct: Story = {
  beforeEach: () => { installDesktopApiStub({ notifications: async () => [{
    ...sampleNotifications[0], title: 'Google reports stock: MacBook Neo', target: { kind: 'shopping', id: 'watch-1' },
  }] }); },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /♧ Notifications/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open product for Google reports stock: MacBook Neo' }));
    await waitFor(() => expect(canvas.getByText('Details and latest offers').closest('details')).toHaveAttribute('open'));
    await expect(canvas.getByRole('heading', { name: 'MacBook Neo · 256GB, Indigo' }).closest('li')).toHaveClass('notification-target');
  },
};
export const RemovedProductNotification: Story = {
  beforeEach: () => { installDesktopApiStub({ notifications: async () => [{
    ...sampleNotifications[0], target: { kind: 'shopping', id: 'removed-watch' },
  }] }); },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /♧ Notifications/ }));
    await userEvent.click(canvas.getByRole('button', { name: `Open product for ${sampleNotifications[0].title}` }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('has been removed');
  },
};
export const LegacyNotification: Story = {
  beforeEach: () => { installDesktopApiStub({ notifications: async () => [{ ...sampleNotifications[0], target: null }] }); },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /♧ Notifications/ }));
    await userEvent.click(canvas.getByRole('button', { name: `Open product for ${sampleNotifications[0].title}` }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('older notification has no product link');
  },
};
let bannerClick: ((target: NotificationTarget | null) => void) | undefined;
export const SimulatedSystemBanner: Story = {
  beforeEach: () => {
    bannerClick = undefined;
    installDesktopApiStub({ onNotificationOpen: callback => { bannerClick = callback; return () => { bannerClick = undefined; }; } });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Lowest found: $1,999.00');
    await userEvent.click(canvas.getByRole('button', { name: /⚙ Settings/ }));
    bannerClick?.({ kind: 'shopping', id: 'watch-1' });
    await waitFor(() => expect(canvas.getByText('Details and latest offers').closest('details')).toHaveAttribute('open'));
  },
};
export const StorageFailure: Story = {
  beforeEach: () => { installDesktopApiStub({ items: async () => { throw new Error('Local database cannot be opened'); } }); },
};
