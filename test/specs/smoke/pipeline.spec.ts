import { expect } from 'chai';
import { pipelinePage, PIPELINE_STAGES } from '../../../src/pages/PipelinePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPipeline } from '../../helpers/pipeline.js';

describe('Smoke: pipeline', () => {
  requiresAccount();

  it('MPIP-001 Pipeline opens with all stages and their counts add up to the total', async () => {
    await openPipeline();
    const total = await pipelinePage.total();
    const cards = await pipelinePage.stageCards();
    await checkpoint('MPIP-001 pipeline');
    expect(cards.map((c) => c.name), 'stages').to.deep.equal(PIPELINE_STAGES.map((s) => s.mobile));
    expect(cards.reduce((n, c) => n + c.count, 0), 'sum of stage counts').to.equal(total);
  });
});
