import { useId, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Button, IconButton } from '../Button';
import {
  Input, Textarea, Select, Checkbox, Switch, RadioGroup, HelpText, FieldLabel,
  Card, Badge, Alert, Disclosure, Dialog, Tabs, Link, Spinner, Skeleton, EmptyState, Table, Divider,
} from '../UI';

function ComponentInventory() {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return <main className="ui-kit ui-stack">
    <h1>Component inventory</h1>
    <p>Every element below has its own entry under Components in the sidebar, with isolated state examples and prop controls. Patterns contains composed examples; Application and Monitoring contain the existing app screens.</p>
    <section className="ui-state"><h2>Buttons</h2><div className="ui-row">
      <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="danger">Destructive</Button>
      <Button variant="ghost">Ghost</Button><Button disabled>Disabled</Button><Button loading>Loading</Button>
      <IconButton label="Add product" icon="+" />
    </div></section>
    <section className="ui-state"><h2>Inputs and field text</h2><div className="ui-grid">
      <Input label="Product name" placeholder="MacBook Neo" help="Include the model and capacity." />
      <Input label="Invalid product name" defaultValue="Ma" error="Enter at least 3 characters." />
      <Input label="Read-only reference" readOnly defaultValue="Imported product" />
      <Input label="Disabled input" disabled defaultValue="Unavailable" />
      <Input label="Search products" type="search" placeholder="Filter products" />
      <Input label="Interval" type="number" defaultValue={15} min={5} />
      <Textarea label="Notes" placeholder="Optional notes" />
      <Select label="Sort offers"><option>Price: low to high</option><option>Price: high to low</option></Select>
    </div>
    <div className="ui-field"><FieldLabel htmlFor={`${id}-label`} required>Field label</FieldLabel><input id={`${id}-label`} required aria-describedby={`${id}-help`} /><HelpText id={`${id}-help`}>Persistent help text associated with the control.</HelpText></div>
    <HelpText tone="error">Error help text: tell the user how to recover.</HelpText><HelpText tone="success">Success help text: preferences saved.</HelpText>
    </section>
    <section className="ui-state"><h2>Selection controls</h2><div className="ui-grid">
      <div className="ui-stack"><Checkbox label="Stock alerts" defaultChecked /><Checkbox label="Select all" indeterminate /><Checkbox label="Unavailable option" disabled /></div>
      <div className="ui-stack"><Switch label="Automatic checks" defaultChecked /><Switch label="Paused preference" /><Switch label="Disabled switch" disabled /></div>
      <RadioGroup label="Price direction" defaultValue="ascending" options={[{ label: 'Low to high', value: 'ascending' }, { label: 'High to low', value: 'descending' }]} />
    </div></section>
    <section className="ui-state"><h2>Badges</h2><div className="ui-row">
      <Badge>Stock unknown</Badge><Badge tone="success">In Stock</Badge><Badge tone="error">Out of Stock</Badge>
      <Badge tone="accent">On Sale</Badge><Badge tone="warning">Last known</Badge><Badge tone="info">Lowest found: $1,999.00</Badge>
    </div></section>
    <section className="ui-stack" aria-label="Alert examples"><h2>Alerts</h2><div className="ui-grid">
      <Alert tone="info" title="Monitoring paused">Checks resume when enabled.</Alert>
      <Alert tone="success" title="Saved">Preferences are saved on this device.</Alert>
      <Alert tone="warning" title="Last known">The latest check failed.</Alert>
      <Alert tone="error" title="Check failed">Retry later.</Alert>
    </div></section>
    <section className="ui-stack" aria-label="Card examples"><h2>Cards</h2><div className="ui-grid">
      <Card title="Default card" description="Header, body, and footer." footer={<Button variant="secondary">View details</Button>}><Badge tone="success">In Stock</Badge></Card>
      <Card title="Raised card" variant="raised">Elevated surface.</Card>
      <Card title="Outlined card" variant="outlined">Subtle grouping without a filled surface.</Card>
    </div></section>
    <section className="ui-state"><h2>Disclosure</h2><Disclosure summary="Apple - 2 listings"><p>$1,999.00 - Apple</p><p>$1,999.00 - Apple Education Store</p></Disclosure></section>
    <section className="ui-state"><h2>Dialog</h2><Button onClick={() => dialog.current?.showModal()}>Open example dialog</Button>
      <Dialog ref={dialog} title="Example dialog" description="A native modal with focus management."><Button autoFocus variant="secondary" onClick={() => dialog.current?.close()}>Close example dialog</Button></Dialog>
    </section>
    <section className="ui-state"><h2>Tabs and links</h2><Tabs label="Example product details" items={[{ label: 'Offers', content: <p>Example offers panel.</p> }, { label: 'History', content: <p>Example history panel.</p> }, { label: 'Alerts', content: <p>Example alerts panel.</p> }]} />
      <Link href={`#${id}-reference`}>Jump to reference</Link><p id={`${id}-reference`}>Example reference destination.</p>
    </section>
    <section className="ui-state"><h2>Table</h2><Table caption="Example retailer offers"><thead><tr><th scope="col">Vendor</th><th scope="col">Listed price (USD)</th></tr></thead><tbody><tr><th scope="row">Apple</th><td>$1,999.00</td></tr><tr><th scope="row">eBay</th><td>$2,099.00</td></tr></tbody></Table></section>
    <section className="ui-state"><h2>Loading indicators</h2><Spinner label="Checking availability…" /><div className="ui-stack" aria-hidden="true"><Skeleton shape="circle" /><Skeleton /><Skeleton shape="card" /></div></section>
    <section className="ui-stack" aria-label="Empty state example"><h2>Empty state</h2><EmptyState title="No tracked products" action={<Button>Add example product</Button>}>Add a product to begin monitoring.</EmptyState></section>
    <section className="ui-state"><h2>Divider</h2><p>First section</p><Divider /><p>Second section</p></section>
  </main>;
}
const meta = {
  title: 'Components/Overview', component: ComponentInventory, tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { description: { component: 'An at-a-glance inventory of all 22 token-based UI components. Open an individual component entry for states, controls, and usage. The desktop application uses the shared foundation and relevant components; remaining elements are available for future features.' } } },
} satisfies Meta<typeof ComponentInventory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllComponents: Story = {
  play: async ({ canvas, userEvent }) => {
    for (const name of ['Buttons', 'Inputs and field text', 'Selection controls', 'Badges', 'Alerts', 'Cards', 'Disclosure', 'Dialog', 'Tabs and links', 'Table', 'Loading indicators', 'Empty state', 'Divider']) {
      await expect(canvas.getByRole('heading', { name })).toBeVisible();
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Open example dialog' }));
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Example dialog');
    await userEvent.click(canvas.getByRole('button', { name: 'Close example dialog' }));
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    canvas.getByRole('heading', { name: 'Component inventory' }).scrollIntoView();
  },
};
