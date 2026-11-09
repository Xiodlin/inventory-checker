import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Components/Actions/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Save preferences', onClick: fn(), variant: 'primary', size: 'md', loading: false, disabled: false },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Token-based button primitive. Native button semantics; defaults to type="button". Loading blocks duplicate activation and exposes aria-busy; disabled does not show a loading cursor. These primitives are available for adoption and do not replace production controls automatically.' } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Save preferences' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'danger', children: 'Delete notification' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancel' } };
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(getComputedStyle(button).cursor).toBe('default');
  },
};
export const Loading: Story = {
  args: { loading: true, children: 'Saving preferences…' },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const KeyboardFocus: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    const button = canvas.getByRole('button');
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).outlineStyle).toBe('solid');
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Hover: Story = {
  render: args => <Button {...args} data-preview-state="hover">Hover preview</Button>,
};
export const Pressed: Story = {
  render: args => <Button {...args} data-preview-state="pressed">Pressed preview</Button>,
};
export const FocusVisible: Story = {
  render: args => <Button {...args} data-preview-state="focus">Focus preview</Button>,
};
export const HoverAndPress: Story = {
  parameters: { docs: { description: { story: 'Static pseudo-state previews use the same CSS declarations as native :hover and :active. Storybook synthetic pointer events do not set browser pseudo-classes.' } } },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    const initial = getComputedStyle(button).backgroundColor;
    button.setAttribute('data-preview-state', 'hover');
    await new Promise(resolve => setTimeout(resolve, 180));
    const hovered = getComputedStyle(button).backgroundColor;
    await expect(hovered).not.toBe(initial);
    button.setAttribute('data-preview-state', 'pressed');
    await new Promise(resolve => setTimeout(resolve, 180));
    await expect(getComputedStyle(button).backgroundColor).not.toBe(hovered);
    button.removeAttribute('data-preview-state');
  },
};
export const StateMatrix: Story = {
  render: () => <div className="ui-stack">
    <h1>Button states</h1>
    <p>Hover, pressed and focus columns are static visual previews. Use a pointer or keyboard to try the native states.</p>
    {(['primary', 'secondary', 'danger', 'ghost'] as const).map(variant => <section className="ui-state" key={variant}>
      <h2>{variant}</h2><div className="ui-row">
        <Button variant={variant}>Default</Button>
        <Button variant={variant} data-preview-state="hover">Hover</Button>
        <Button variant={variant} data-preview-state="pressed">Pressed</Button>
        <Button variant={variant} data-preview-state="focus">Focus visible</Button>
        <Button variant={variant} disabled>Disabled</Button>
        <Button variant={variant} loading>Loading</Button>
      </div>
    </section>)}
  </div>,
};
export const SizesAndIcons: Story = {
  render: () => <div className="ui-row">
    <Button size="sm">Compact</Button><Button size="md">Default</Button><Button size="lg">Large</Button>
    <Button><span aria-hidden="true">+</span> Add product</Button>
    <Button variant="ghost" aria-label="Close dialog"><span aria-hidden="true">×</span></Button>
  </div>,
};
