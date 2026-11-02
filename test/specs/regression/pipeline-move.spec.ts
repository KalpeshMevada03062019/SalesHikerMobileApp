// Pipeline, changing data: moves ONE QA deal (pipelineData.testDeal, DL-100005) between stages, marks it
// Won and Lost, and always puts it back to Qualification (afterEach). openTestDeal() refuses to continue
// unless the opened deal has that number and name.
import { expect } from 'chai';
import { pipelinePage, dealPage } from '../../../src/pages/PipelinePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { restartApp } from '../../../src/utils/app.js';
import { pipelineData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTestDeal, restoreTestDeal } from '../../helpers/pipeline.js';

describe('Pipeline: move the QA test deal between stages', () => {
  requiresAccount();
  afterEach(async () => { await restoreTestDeal(); });

  it('MPIP-020 Moving a deal to the next stage updates it and is kept after a restart', async () => {
    await openTestDeal();
    await dealPage.moveTo('Needs Analysis');
    expect(await dealPage.stageLabel(), 'stage label').to.match(/^Stage 2 of \d · Needs Analysis$/);
    expect(await dealPage.progress(), 'progress').to.equal(33);
    await checkpoint('MPIP-020 moved');
    await restartApp();
    await pipelinePage.open();
    await pipelinePage.findDeal(pipelineData.testDeal.number);
    expect(await pipelinePage.sectionOf(pipelineData.testDeal.number), 'section after restart').to.equal('Needs Analysis');
  });

  it('MPIP-021 Mark Won closes the deal and Change Stage reopens it', async () => {
    await openTestDeal();
    await dealPage.markWon();
    expect(await dealPage.progress(), 'progress').to.equal(100);
    expect(await dealPage.stageLabel(), 'label').to.equal('Won');
    expect(await dealPage.hasMarkButtons(), 'Mark Won / Lost on a won deal').to.equal(false);
    await checkpoint('MPIP-021 won');
    await dealPage.moveTo('Qualification');
    expect(await dealPage.hasMarkButtons(), 'Mark Won / Lost after reopening').to.equal(true);
  });

  it('MPIP-022 Mark Lost closes the deal with 0% probability', async () => {
    await openTestDeal();
    await dealPage.markLost();
    expect(await dealPage.stageLabel(), 'label').to.equal('Lost');
    expect(await dealPage.probability(), 'probability').to.equal(0);
    expect(await dealPage.hasMarkButtons(), 'Mark Won / Lost on a lost deal').to.equal(false);
    await checkpoint('MPIP-022 lost');
  });
});
