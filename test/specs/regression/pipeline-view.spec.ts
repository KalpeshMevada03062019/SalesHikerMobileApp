// Pipeline, read only: stage strip and names (compared with the web board), stage selection and
// progress, search, Mine, deal detail, Move Stage sheet, Edit Deal validation. No deal is changed.
import { expect } from 'chai';
import { pipelinePage, dealPage, PIPELINE_STAGES, PIPELINE_TEXTS } from '../../../src/pages/PipelinePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { pipelineData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPipeline, openTestDeal } from '../../helpers/pipeline.js';

describe('Pipeline: view, filter and deal detail (nothing is changed)', () => {
  requiresAccount();

  // The web board (Deals > board view) names its columns Qualification, Needs Analysis, Value Proposition,
  // Proposal / Price Quote, Negotiation / Review, Won, Lost. A shorter mobile name is fine; a different
  // word is not ("Value Proposal" for "Value Proposition"): MPIP-D02.
  it('MPIP-002 Stage names match the web pipeline (shortened at most)', async () => {
    await openPipeline();
    const names = await pipelinePage.stageNamesOnScreen();
    expect(names, 'stage order').to.deep.equal(PIPELINE_STAGES.map((s) => s.mobile));
    const wrong = PIPELINE_STAGES.filter((s) => !s.web.startsWith(s.mobile)).map((s) => `"${s.mobile}" (web: "${s.web}")`);
    expect(wrong, 'stage names that are not the web name or its start').to.deep.equal([]);
  });

  it('MPIP-003 Selecting a stage marks it and lists only its deals with that stage progress', async () => {
    await openPipeline();
    const problems: string[] = [];
    for (const s of PIPELINE_STAGES.filter((x) => x.progress !== null)) {
      await pipelinePage.selectStage(s.mobile);
      const card = await pipelinePage.stageCard(s.mobile);
      const progress = await pipelinePage.firstProgress();
      if (!card.selected) problems.push(`${s.mobile} not marked selected`);
      if (card.count > 0 && progress !== s.progress) problems.push(`${s.mobile}: progress ${progress}% (expected ${s.progress}%)`);
    }
    await checkpoint('MPIP-003 won');
    expect(problems, 'stage selection').to.deep.equal([]);
  });

  // A lost deal shows a full (100%) progress bar, the same as a won deal, while its probability is 0%:
  // MPIP-D03.
  it('MPIP-004 Lost deals do not show a full progress bar', async () => {
    await openPipeline();
    await pipelinePage.selectStage('Lost');
    const progress = await pipelinePage.firstProgress();
    await checkpoint('MPIP-004 lost');
    expect(progress, 'a lost deal with a progress bar is listed').to.be.a('number');
    expect(progress, 'progress of a lost deal').to.not.equal(100);
  });

  it('MPIP-005 Search by deal number finds that deal and an unknown text finds none', async () => {
    await openPipeline();
    const card = await pipelinePage.findDeal(pipelineData.testDeal.number);
    expect(card?.name, 'deal found by number').to.equal(pipelineData.testDeal.name);
    await pipelinePage.search(pipelineData.noMatch);
    expect(await pipelinePage.isNoDealsShown(), '"No deals match"').to.equal(true);
    expect(await pipelinePage.total(), 'total while searching').to.equal(0);
    await checkpoint('MPIP-005 no match');
  });

  // The web shows deal DL-100002 "Assigned To" the signed-in user.
  it('MPIP-006 Mine lists the deals assigned to the signed-in user', async () => {
    await openPipeline();
    expect(await pipelinePage.toggleMine(), 'Mine selected').to.equal(true);
    await $(pipelinePage.selectors.dealCard(pipelineData.myDeal.number)).waitForExist({ timeout: 20_000 }).catch(() => undefined);
    const mine = await pipelinePage.visibleDeals();
    await checkpoint('MPIP-006 mine');
    await pipelinePage.toggleMine();
    expect(mine.map((d) => d.number), 'deals under Mine').to.include(pipelineData.myDeal.number);
    expect(mine.filter((d) => !d.label.includes(pipelineData.myDeal.owner)).map((d) => d.label), 'deals of other owners under Mine').to.deep.equal([]);
  });

  it('MPIP-007 Deal detail shows the card details, stage and progress', async () => {
    await openTestDeal();
    expect(await dealPage.stage(), 'stage').to.equal('Qualification');
    expect(await dealPage.stageLabel(), 'stage label').to.match(/^Stage 1 of \d · Qualification$/);
    expect(await dealPage.progress(), 'progress').to.equal(17);
    expect(await dealPage.hasMarkButtons(), 'Mark Won / Mark Lost').to.equal(true);
    await checkpoint('MPIP-007 detail');
  });

  it('MPIP-008 Move Stage lists every stage with the current one marked', async () => {
    await openTestDeal();
    const options = await dealPage.openMoveStage();
    await checkpoint('MPIP-008 move stage');
    await dealPage.closeMoveStage();   // nothing is chosen
    expect(options, 'options').to.deep.equal(PIPELINE_STAGES.map((s) => (s.mobile === 'Qualification' ? 'Qualification (Current)' : s.mobile)));
    expect(await dealPage.stage(), 'stage unchanged').to.equal('Qualification');
  });

  it('MPIP-009 Edit Deal rejects an empty name and a probability over 100, and Cancel discards', async () => {
    await openTestDeal();
    await dealPage.openEdit();
    await dealPage.setField(dealPage.selectors.nameField, '');
    await dealPage.setField(dealPage.selectors.probabilityField, '150');
    await dealPage.save();
    expect(await dealPage.isErrorShown(PIPELINE_TEXTS.enterName), 'name error').to.equal(true);
    expect(await dealPage.isErrorShown(PIPELINE_TEXTS.probabilityRange), 'probability error').to.equal(true);
    await checkpoint('MPIP-009 errors');
    const cancel = await dealPage.cancelEdit();
    expect(cancel.asked && cancel.message, '"Discard changes?" with its message').to.equal(true);
    expect(await $(dealPage.selectors.number(pipelineData.testDeal.number)).isExisting(), 'back on the deal').to.equal(true);
    expect(await $(`//*[@text=${JSON.stringify(pipelineData.testDeal.name)}]`).isExisting(), 'name unchanged').to.equal(true);
  });
});
