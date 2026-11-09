import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Dialog, type DialogProps } from '../UI';
import { Button } from '../Button';

function DialogExample({ initiallyOpen = false, destructive = false, ...props }: DialogProps & { initiallyOpen?: boolean; destructive?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (initiallyOpen) ref.current?.showModal(); }, [initiallyOpen]);
  return <div className="ui-stack">
    <Button variant={destructive ? 'danger' : 'primary'} onClick={() => ref.current?.showModal()}>Open dialog</Button>
    {confirmed && <p role="status">Example action confirmed.</p>}
    <Dialog {...props} ref={ref}>
      {props.children}
      <div className="ui-row">
        <Button autoFocus variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={() => { setConfirmed(true); ref.current?.close(); }}>Confirm</Button>
      </div>
    </Dialog>
  </div>;
}
const meta = {
  title: 'Components/Feedback/Dialog', component: Dialog, tags: ['autodocs'],
  args: { title: 'Confirm example action?', description: 'This dialog changes only local story state.' },
  render: args => <DialogExample {...args} />,
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Native modal dialog opened with showModal() through its forwarded ref. The browser traps focus, supports Escape, and returns focus to the trigger. Put initial focus on the least destructive action.' } } },
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open dialog' });
    await userEvent.click(trigger);
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Confirm example action?');
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Example action confirmed.');
  },
};
export const Open: Story = { render: args => <DialogExample {...args} initiallyOpen /> };
export const Destructive: Story = {
  args: { title: 'Clear all example alerts?', description: 'This cannot be undone. Product monitoring is unchanged.' },
  render: args => <DialogExample {...args} destructive initiallyOpen />,
};
export const LongContent: Story = {
  args: { children: <div className="ui-stack">{Array.from({ length: 10 }, (_, index) => <p key={index}>Example detail {index + 1}: review these settings before continuing. This content scrolls inside the dialog on a small screen.</p>)}</div> },
  render: args => <DialogExample {...args} initiallyOpen />,
};
