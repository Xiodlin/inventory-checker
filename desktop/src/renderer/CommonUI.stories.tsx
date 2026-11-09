import { useId, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from './components/Button';
import { Input } from './components/UI';

function CommonUI({ children }: { children: ReactNode }) {
  return <main className="ui-kit">{children}</main>;
}
const meta = {
  title: 'Patterns/Common UI',
  component: CommonUI,
  tags: ['autodocs'],
  args: { children: null },
  parameters: { docs: { description: { component: 'Token-based reference patterns for native form controls, validation, feedback, disclosure, dialogs, tables and navigation. These are isolated reference examples, not a production UI migration. No live data or external services.' } } },
} satisfies Meta<typeof CommonUI>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InputStates: Story = {
  render: () => <CommonUI><h1>Input states</h1><div className="ui-grid">
    <label className="ui-field">Default<input placeholder="Product name" /></label>
    <label className="ui-field">Filled<input defaultValue="MacBook Neo" /></label>
    <label className="ui-field">Disabled<input disabled value="Not editable" readOnly /></label>
    <label className="ui-field">Read only<input readOnly value="Reference only" /></label>
    <Input label="Invalid" error="Enter at least 3 characters." defaultValue="2" />
    <label className="ui-field">Search<input type="search" placeholder="Search products" /></label>
    <label className="ui-field">Interval<input type="number" defaultValue={15} min={5} max={10080} /></label>
    <label className="ui-field">Notes<textarea placeholder="Optional notes" /></label>
  </div></CommonUI>,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Default');
    await userEvent.type(input, 'iPhone Duo');
    await expect(input).toHaveValue('iPhone Duo');
    await expect(canvas.getByLabelText('Disabled')).toBeDisabled();
    await expect(canvas.getByLabelText('Read only')).toHaveAttribute('readonly');
    await expect(canvas.getByLabelText('Invalid')).toHaveAttribute('aria-invalid', 'true');
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

function SelectionExample() {
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [direction, setDirection] = useState('ascending');
  const id = useId();
  return <CommonUI><h1>Selection controls</h1><div className="ui-stack">
    <label className="ui-field">Sort offers<select defaultValue="ascending"><option value="ascending">Price: low to high</option><option value="descending">Price: high to low</option></select></label>
    <label className="ui-field">Disabled select<select disabled><option>All sellers</option></select></label>
    <label className="ui-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Stock alerts</label>
    <label className="ui-check"><input type="checkbox" disabled />Unavailable preference</label>
    <label className="ui-check"><input type="checkbox" role="switch" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Automatic checks</label>
    <fieldset><legend>Price direction</legend>{['ascending', 'descending'].map(value => <label className="ui-check" key={value}>
      <input type="radio" name={`${id}-direction`} value={value} checked={direction === value} onChange={() => setDirection(value)} />{value}
    </label>)}</fieldset>
  </div></CommonUI>;
}
export const SelectionControls: Story = {
  render: () => <SelectionExample />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByLabelText('Sort offers'), 'descending');
    await expect(canvas.getByLabelText('Sort offers')).toHaveValue('descending');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Stock alerts' }));
    await expect(canvas.getByRole('checkbox', { name: 'Stock alerts' })).not.toBeChecked();
    await userEvent.click(canvas.getByRole('switch'));
    await expect(canvas.getByRole('switch')).toBeChecked();
    await userEvent.click(canvas.getByRole('radio', { name: 'descending' }));
    await expect(canvas.getByRole('radio', { name: 'descending' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'ascending' })).not.toBeChecked();
  },
};

function ValidationExample() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const invalid = submitted && name.trim().length < 3;
  return <CommonUI><form className="ui-state" noValidate onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
    <h1>Form validation</h1>
    <label className="ui-field" htmlFor={id}>Product name
      <input id={id} value={name} onChange={event => setName(event.target.value)} required
        aria-invalid={invalid || undefined} aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`} />
    </label>
    <p id={`${id}-help`}>Use at least 3 characters.</p>
    {invalid && <div id={`${id}-error`} className="ui-feedback ui-feedback--error" role="alert">Enter a product name with at least 3 characters.</div>}
    {submitted && !invalid && <div className="ui-feedback ui-feedback--success" role="status">Example saved locally in this story.</div>}
    <Button type="submit">Save example</Button>
  </form></CommonUI>;
}
export const ValidationAndRecovery: Story = {
  render: () => <ValidationExample />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save example' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('at least 3 characters');
    await expect(canvas.getByLabelText('Product name')).toHaveAccessibleDescription(/at least 3 characters/);
    await userEvent.type(canvas.getByLabelText('Product name'), 'MacBook Neo');
    await userEvent.click(canvas.getByRole('button', { name: 'Save example' }));
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.getByRole('status')).toHaveTextContent('Example saved');
  },
};

export const AlertsAndBadges: Story = {
  render: () => <CommonUI><h1>Feedback and status</h1><div className="ui-stack">
    {[
      ['success', 'Saved', 'Your preferences were saved.'],
      ['warning', 'Last known observation', 'The latest check failed; these results may be stale.'],
      ['error', 'Check failed', 'The retailer blocked this request. Retry later.'],
      ['info', 'Monitoring paused', 'Checks resume when enabled.'],
    ].map(([state, title, body]) => <section key={state} className={`ui-feedback ui-feedback--${state}`} aria-label={title}>
      <strong>{title}</strong><p>{body}</p>
    </section>)}
    <div className="ui-row">{['In Stock', 'Out of Stock', 'Stock unknown', 'On Sale', 'Last known', 'Verified retailer page'].map(label => <span className="ui-chip" key={label}>{label}</span>)}</div>
    <p>Static examples do not announce themselves as live alerts. Dynamic validation uses alert/status semantics.</p>
  </div></CommonUI>,
};

export const CardsAndDisclosures: Story = {
  render: () => <CommonUI><h1>Cards and disclosure</h1><div className="ui-grid">
    <article className="ui-state"><h2>MacBook Neo</h2><p>256GB / Indigo</p><span className="ui-chip">Lowest found: $1,999.00</span>
      <details><summary>Apple - 2 listings</summary><ul><li>$1,999.00 - Apple</li><li>$1,999.00 - Apple Education Store</li></ul></details>
    </article>
    <article className="ui-state"><h2>Empty watchlist</h2><p>Add a product to begin monitoring stock and prices.</p><Button disabled>Example only</Button></article>
  </div></CommonUI>,
  play: async ({ canvas, userEvent }) => {
    const summary = canvas.getByText('Apple - 2 listings');
    await expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    await expect(canvas.getByText('$1,999.00 - Apple Education Store')).toBeVisible();
    await userEvent.click(summary);
    await expect(summary.closest('details')).not.toHaveAttribute('open');
  },
};

function DialogExample() {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [deleted, setDeleted] = useState(false);
  return <CommonUI><h1>Confirmation dialog</h1>
    <Button variant="danger" onClick={() => dialog.current?.showModal()}>Clear example alerts</Button>
    {deleted && <p role="status">Example alerts cleared.</p>}
    <dialog ref={dialog} className="ui-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <h2 id={`${id}-title`}>Clear all example alerts?</h2>
      <p id={`${id}-description`}>This example affects only story state. Product monitoring is unchanged.</p>
      <div className="ui-row">
        <Button autoFocus variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
        <Button variant="danger" onClick={() => { setDeleted(true); dialog.current?.close(); }}>Confirm clear</Button>
      </div>
    </dialog>
  </CommonUI>;
}
export const ConfirmationDialog: Story = {
  render: () => <DialogExample />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Clear example alerts' });
    await userEvent.click(trigger);
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Clear all example alerts?');
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm clear' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Example alerts cleared.');
  },
};

function TabsExample() {
  const [tab, setTab] = useState(0);
  const id = useId();
  const labels = ['Offers', 'History', 'Alerts'];
  return <CommonUI><h1>Tabs and links</h1>
    <div className="ui-row" role="tablist" aria-label="Product details">
      {labels.map((label, index) => <Button key={label} role="tab" id={`${id}-tab-${index}`}
        aria-selected={tab === index} aria-controls={`${id}-panel-${index}`} tabIndex={tab === index ? 0 : -1}
        variant={tab === index ? 'primary' : 'ghost'} onClick={() => setTab(index)}
        onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % labels.length
            : event.key === 'ArrowLeft' ? (index + labels.length - 1) % labels.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1 : null;
          if (next == null) return;
          event.preventDefault(); setTab(next);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
        }}>{label}</Button>)}
    </div>
    {labels.map((label, index) => <div key={label} role="tabpanel" id={`${id}-panel-${index}`}
      aria-labelledby={`${id}-tab-${index}`} hidden={tab !== index} tabIndex={0}><p>{label} content</p></div>)}
    <a href="#example-link-target">Jump to example reference</a>
    <p id="example-link-target">Reference destination within this story.</p>
  </CommonUI>;
}
export const TabsAndLinks: Story = {
  render: () => <TabsExample />,
  play: async ({ canvas, userEvent }) => {
    const offers = canvas.getByRole('tab', { name: 'Offers' });
    await userEvent.click(offers);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveFocus();
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('History content');
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('tab', { name: 'Alerts' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    await expect(offers).toHaveAttribute('aria-selected', 'true');
  },
};

export const TablesAndLoading: Story = {
  render: () => <CommonUI><h1>Tables and loading feedback</h1>
    <div className="ui-table"><table><caption>Example retailer offers (USD)</caption>
      <thead><tr><th scope="col">Vendor</th><th scope="col">Listed price</th><th scope="col">Stock</th></tr></thead>
      <tbody><tr><th scope="row">Apple</th><td>$1,999.00</td><td>In Stock</td></tr>
        <tr><th scope="row">eBay</th><td>$2,099.00</td><td>Unknown</td></tr></tbody>
    </table></div>
    <section className="ui-state" aria-busy="true" aria-label="Loading example offers">
      <span role="status">Loading offers…</span>
      <div className="ui-stack" aria-hidden="true"><div className="ui-skeleton" /><div className="ui-skeleton" /><div className="ui-skeleton" /></div>
    </section>
  </CommonUI>,
};
