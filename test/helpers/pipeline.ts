// Navigation and safety shared by the Pipeline specs.
import { pipelinePage, dealPage } from '../../src/pages/PipelinePage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account, pipelineData } from '../../src/data/testData.js';

/** Restarts the app signed in and opens the Deals tab ("Pipeline"). */
export async function openPipeline(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await pipelinePage.open();
}

/**
 * Opens the QA test deal and checks it really is that deal (number and name) before anything changes it.
 * Throws otherwise, so no other deal can ever be edited.
 */
export async function openTestDeal(): Promise<void> {
  const { number, name } = pipelineData.testDeal;
  await openPipeline();
  const card = await pipelinePage.findDeal(number);
  if (!card || card.name !== name) throw new Error(`Test deal ${number} "${name}" not found (got ${card ? `"${card.name}"` : 'nothing'}); nothing is changed`);
  await pipelinePage.openDeal(number);
  await dealPage.waitForDisplayed(20_000);
  if (!(await $(dealPage.selectors.number(number)).isExisting())) throw new Error(`Opened deal is not ${number}; nothing is changed`);
}

/** afterEach for the write tests: put the test deal back to Qualification. */
export async function restoreTestDeal(): Promise<void> {
  const home = pipelineData.testDeal.homeStage;
  if (await $(dealPage.selectors.moveSheet).isExisting().catch(() => false)) await dealPage.closeMoveStage().catch(() => undefined);
  if (!(await dealPage.isDisplayed(0).catch(() => false))) await openTestDeal();
  if ((await dealPage.stage()) !== home) await dealPage.moveTo(home);
}
