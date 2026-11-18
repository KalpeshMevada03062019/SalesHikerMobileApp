// Services, the whole screen: status and category filters, search, the beta service "test service" with every tab
// (header, summary fields, dates, description, related invoices, activity), the actions menu and status picker
// (opened and closed), the Edit form (opened and cancelled unchanged) and the New service form (filled and
// discarded). Save, every status and every menu action other than Edit are never chosen.
import { expect } from 'chai';
import { servicesPage, serviceDetailPage, newServicePage, editServicePage, SERVICE_STATUSES, SERVICE_ACTIONS, SERVICE_TEXTS,
  SERVICE_USAGE_UNITS, SERVICE_FORM_SECTIONS } from '../../../src/pages/ServicesPage.js';
import { invoiceDetailPage } from '../../../src/pages/InvoicesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { serviceData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openService, openServices } from '../../helpers/services.js';

const openTestService = (ctx: Mocha.Context) => openService(ctx, serviceData.number, serviceData.name);
const day = (d: string) => new Date(d).getTime();

describe('Services: filters, search, detail tabs, actions and the service forms (nothing is saved)', () => {
  requiresAccount();

  it('MSRV-002 Active and Inactive counts add up to all services and Inactive excludes the active service', async () => {
    await openServices();
    const p = servicesPage;
    const all = await p.count();
    const problems: string[] = [];
    const counts: Record<string, number> = {};
    for (const s of SERVICE_STATUSES) {
      counts[s] = await p.selectFilter(s);
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      const names = (await p.serviceRows()).map((r) => r.name);
      if ((s === 'Active') !== names.includes(serviceData.name)) problems.push(`${s}: ${serviceData.name} ${s === 'Active' ? 'missing' : 'listed'}`);
      if (counts[s] === 0 && !(await p.isEmptyStateShown())) problems.push(`${s}: 0 without "${SERVICE_TEXTS.noResults}"`);
    }
    await checkpoint('MSRV-002 last status');
    expect(problems, `status filters: ${problems.join('; ')}`).to.deep.equal([]);
    expect(counts.Active! + counts.Inactive!, `Active ${counts.Active} + Inactive ${counts.Inactive} vs All ${all}`).to.equal(all);
  });

  it('MSRV-003 A category filter leaves out services of other categories and Clear restores all services', async () => {
    await openServices();
    const p = servicesPage;
    const all = await p.count();
    const n = await p.selectCategory(serviceData.otherCategory);
    const names = (await p.serviceRows()).map((r) => r.name);
    const selected = await $(p.service.selectedCategory(serviceData.otherCategory)).isExisting();
    const empty = n === 0 ? await p.isEmptyStateShown() : true;
    await checkpoint('MSRV-003 category');
    const after = await p.clearCategory(serviceData.otherCategory);
    expect(selected, `chip shows ${serviceData.otherCategory}`).to.equal(true);
    expect(n, `${serviceData.otherCategory} count`).to.be.below(all);
    expect(names, `${serviceData.name} is ${serviceData.category}`).to.not.include(serviceData.name);
    expect(empty, `"${SERVICE_TEXTS.noResults}" for 0 services`).to.equal(true);
    expect(after, 'count after clearing the category').to.equal(all);
  });

  it('MSRV-004 Search finds a service by name and by service number in any letter case', async () => {
    await openServices();
    const p = servicesPage;
    const misses: string[] = [];
    for (const term of [serviceData.number.toLowerCase(), serviceData.name.toUpperCase()]) {
      await p.search(term);
      const rows = await p.serviceRows();
      if (!rows.some((r) => r.name === serviceData.name)) misses.push(`${term}: ${serviceData.name} missing`);
      const unrelated = rows.filter((r) => !`${r.name} ${r.code}`.toLowerCase().includes(term.toLowerCase())).map((r) => r.name);
      if (unrelated.length) misses.push(`${term}: ${unrelated.join(', ')}`);
    }
    await checkpoint('MSRV-004 last search');
    expect(misses, 'searches').to.deep.equal([]);
  });

  it('MSRV-005 An unknown word finds no services and Clear filters restores the list', async () => {
    await openServices();
    const p = servicesPage;
    const all = await p.count();
    await p.search(serviceData.noMatch);
    expect(await p.isEmptyStateShown(), `"${SERVICE_TEXTS.noResults}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${SERVICE_TEXTS.noResultsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MSRV-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(SERVICE_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MSRV-006 The service detail shows its name, number, status, price and category as on the list', async function () {
    const row = await openTestService(this);
    const d = serviceDetailPage;
    const got = { name: await d.text(d.service.name), number: await d.text(d.service.number), price: await d.text(d.service.price),
      category: await d.text(d.service.category), status: ((await $(d.service.statusButton).getAttribute('content-desc')) ?? '') };
    const tabs: string[] = [];
    for (const t of ['Summary', 'Related', 'Activity'] as const) if (await $(d.service.tab(t)).isExisting()) tabs.push(t);
    await checkpoint('MSRV-006 detail');
    expect(got, 'header').to.deep.equal({ name: row.name, number: serviceData.number, price: row.price, category: serviceData.category,
      status: 'Status: Active. Change status' });
    expect(row.code, 'list row "number, usage unit"').to.equal(`${serviceData.number}, ${serviceData.usageUnit}`);
    expect(tabs, 'tabs').to.deep.equal(['Summary', 'Related', 'Activity']);
    await d.goBack();
    await servicesPage.waitForDisplayed();
    expect((await servicesPage.serviceRows()).map((r) => r.name), 'list after Back').to.include(row.name);
  });

  it('MSRV-007 The summary tab lists number, usage unit, units, price, tax, commission, category and owner', async function () {
    await openTestService(this);
    const d = serviceDetailPage;
    const got = { number: await d.field('Service number'), unit: await d.field('Usage unit'), units: await d.field('Number of units'),
      price: await d.field('Price'), tax: await d.field('Tax rate'), commission: await d.field('Commission rate'),
      category: await d.field('Category'), owner: await d.field('Owner') };
    await checkpoint('MSRV-007 summary');
    expect(got, 'SUMMARY').to.deep.equal({ number: serviceData.number, unit: serviceData.usageUnit, units: serviceData.units, price: serviceData.price,
      tax: serviceData.taxRate, commission: serviceData.commissionRate, category: serviceData.category, owner: serviceData.owner });
  });

  it('MSRV-008 The summary tab shows the sales and support dates in order and the description', async function () {
    await openTestService(this);
    const d = serviceDetailPage;
    const got = { salesStart: await d.field('Sales start'), salesEnd: await d.field('Sales end'), supportStart: await d.field('Support start'),
      supportExpiry: await d.field('Support expiry') };
    await d.scrollTo(d.service.description);
    const description = await d.text(d.service.description);
    await checkpoint('MSRV-008 dates and description');
    expect(got, 'dates').to.deep.equal({ salesStart: serviceData.salesStart, salesEnd: serviceData.salesEnd, supportStart: serviceData.supportStart,
      supportExpiry: serviceData.supportExpiry });
    expect(day(got.salesEnd), 'Sales end after Sales start').to.be.greaterThan(day(got.salesStart));
    expect(day(got.supportExpiry), 'Support expiry after Support start').to.be.greaterThan(day(got.supportStart));
    expect(description, 'DESCRIPTION').to.equal(serviceData.description);
  });

  it('MSRV-009 The related tab lists the invoices with the service and opens the invoice', async function () {
    await openTestService(this);
    const d = serviceDetailPage;
    await d.openTab('Related');
    const count = Number(await d.text(d.service.sectionCount('INVOICES')));
    const invoices = await d.labels(d.service.invoices);
    await checkpoint('MSRV-009 related');
    const qa = invoices.filter((i) => i.startsWith(`${serviceData.invoice}, `)).map((i) => i.split(', ')[2]).sort();
    expect(invoices.length, `rows vs INVOICES ${count}`).to.equal(count);
    expect(invoices.filter((i) => !/^INV-[0-9]+, -?₹[0-9,.]+, Qty [0-9.]+, .+, [A-Za-z ]+$/.test(i)), 'invoice rows').to.deep.equal([]);
    expect(qa, `${serviceData.invoice} lines`).to.deep.equal(serviceData.invoiceQuantities);
    await d.openInvoice(serviceData.invoice);
    await invoiceDetailPage.waitForDisplayed(60_000);
    expect(await invoiceDetailPage.text(invoiceDetailPage.selectors.number), 'invoice opened').to.equal(serviceData.invoice);
    await checkpoint('MSRV-009 invoice');
    await invoiceDetailPage.goBack();
    expect(await d.isDisplayed(15_000), 'service after Back').to.equal(true);
  });

  it('MSRV-010 The activity tab lists the creation of the service', async function () {
    await openTestService(this);
    const d = serviceDetailPage;
    await d.openTab('Activity');
    const count = Number(await d.text(d.service.sectionCount('ACTIVITY')));
    const entries = await d.labels(d.service.activity);
    await checkpoint('MSRV-010 activity');
    expect(entries.length, `entries vs ACTIVITY ${count}`).to.equal(count);
    expect(entries.some((e) => e.startsWith(`${serviceData.createdActivity}, `)), `"${serviceData.createdActivity}" in ${entries.join(' | ')}`).to.equal(true);
  });

  it('MSRV-011 The actions menu offers edit, status, PDF and delete actions and closes without a change', async function () {
    await openTestService(this);
    const options = await serviceDetailPage.actionOptions(SERVICE_ACTIONS);
    await checkpoint('MSRV-011 closed');
    expect(options.map((o) => o.label), 'Service actions').to.deep.equal([...SERVICE_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled').to.deep.equal([]);
    expect(await serviceDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
    expect(await $(serviceDetailPage.service.statusButton).getAttribute('content-desc'), 'status').to.equal('Status: Active. Change status');
  });

  it('MSRV-012 The status picker lists Active and Inactive with the current one selected and closes without a change', async function () {
    await openTestService(this);
    const d = serviceDetailPage;
    const options = await d.statusOptions();
    await checkpoint('MSRV-012 closed');
    expect(options, 'Status').to.deep.equal([{ label: 'Active', selected: true }, { label: 'Inactive', selected: false }]);
    expect(await $(d.service.statusButton).getAttribute('content-desc'), 'status after closing').to.equal('Status: Active. Change status');
  });

  it('MSRV-013 The edit form shows the saved values of the service and Cancel leaves it unchanged', async function () {
    await openTestService(this);
    await serviceDetailPage.openEdit();
    const f = editServicePage;
    await f.waitForDisplayed(15_000);
    const got = { name: await f.inputText('Service name'), unit: await f.pickerText('Usage unit: '), units: await f.inputText('Number of units'),
      category: await f.pickerText('Category: '), owner: await f.pickerText('Owner: '), price: await f.inputText('Price'),
      tax: await f.inputText('Tax rate %'), commission: await f.inputText('Commission rate %'),
      salesStart: await f.pickerText('Sales start: '), supportExpiry: await f.pickerText('Support expiry: '),
      active: await f.isActive(), description: await f.inputText('Description') };
    await checkpoint('MSRV-013 edit form');
    const dialog = await f.cancel();
    expect(got, 'edit form').to.deep.equal({ name: serviceData.name, unit: `Usage unit: ${serviceData.usageUnit}`, units: serviceData.units,
      category: `Category: ${serviceData.category}`, owner: `Owner: ${serviceData.owner}`, price: serviceData.price.replace('₹', ''),
      tax: serviceData.taxRate.replace('%', ''), commission: serviceData.commissionRate.replace('%', ''),
      salesStart: `Sales start: ${serviceData.salesStart}`, supportExpiry: `Support expiry: ${serviceData.supportExpiry}`,
      active: true, description: serviceData.description });
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await serviceDetailPage.isDisplayed(15_000), 'detail after Cancel').to.equal(true);
    expect(await serviceDetailPage.text(serviceDetailPage.service.price), 'price after Cancel').to.equal(serviceData.price);
  });

  it('MSRV-014 The new service form shows its defaults, sections and usage units and closes unchanged without asking', async () => {
    await openServices();
    const all = await servicesPage.count();
    await $(servicesPage.selectors.newButton).click();
    const f = newServicePage;
    await f.waitForDisplayed(15_000);
    const defaults = { name: await f.inputText('Service name'), unit: await f.pickerText('Usage unit: '), category: await f.pickerText('Category: '),
      owner: await f.pickerText('Owner: '), price: await f.inputText('Price'), cost: await f.inputText('Purchase cost'),
      salesStart: await f.pickerText('Sales start: '), salesEnd: await f.pickerText('Sales end: '), supportStart: await f.pickerText('Support start: '),
      supportExpiry: await f.pickerText('Support expiry: '), active: await f.isActive() };
    const sections: string[] = [];
    for (const s of SERVICE_FORM_SECTIONS) if (await f.hasText(s)) sections.push(s);
    const units = await f.usageUnits();
    await checkpoint('MSRV-014 new form');
    const dialog = await f.cancel();
    await servicesPage.waitForDisplayed(20_000);
    await servicesPage.waitForLoaded();
    const pick = SERVICE_TEXTS.pickDate;
    expect(defaults, `defaults ${JSON.stringify(defaults)}`).to.deep.equal({ name: '', unit: 'Usage unit: Hours', category: 'Category: No category', owner: 'Owner: Me',
      price: '0', cost: '0', salesStart: `Sales start: ${pick}`, salesEnd: `Sales end: ${pick}`, supportStart: `Support start: ${pick}`,
      supportExpiry: `Support expiry: ${pick}`, active: true });
    expect(sections, 'form sections').to.deep.equal([...SERVICE_FORM_SECTIONS]);
    expect(units, 'Usage unit picker').to.deep.equal({ options: [...SERVICE_USAGE_UNITS], selected: 'Hours' });
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await servicesPage.count(), 'count after Cancel').to.equal(all);
  });

  it('MSRV-015 A changed new service asks before discarding, keeps the input on Cancel and saves nothing on Discard', async () => {
    await openServices();
    const all = await servicesPage.count();
    await $(servicesPage.selectors.newButton).click();
    const f = newServicePage;
    await f.waitForDisplayed(15_000);
    await f.usageUnits(serviceData.formUnit);
    await f.setName(serviceData.formName);
    const kept = await f.cancelThenKeep();
    const after = { name: await f.inputText('Service name'), unit: await f.pickerText('Usage unit: ') };
    await checkpoint('MSRV-015 kept after Cancel');
    const dialog = await f.discard();
    await servicesPage.waitForDisplayed(20_000);
    await servicesPage.waitForLoaded();
    expect(kept, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(after, 'form after Cancel on the dialog').to.deep.equal({ name: serviceData.formName, unit: `Usage unit: ${serviceData.formUnit}` });
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(await servicesPage.count(), 'count after Discard (nothing saved)').to.equal(all);
    await servicesPage.search(serviceData.formName);
    expect(await servicesPage.isEmptyStateShown(), `"${serviceData.formName}" not saved`).to.equal(true);
  });
});
