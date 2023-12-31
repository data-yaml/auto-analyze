import {
  fastq_config_from_json,
  handler
} from '../lib/omics-workflow-stack.wf1_fastq'

import { TEST_EVENT } from './fixture'

const CONTEXT = {
  debug: true,
  local_file: 'workflows/fastq/aws_region.json'
}

describe('fastq_config_from_json', () => {
  it('should return a list of sample params', async () => {
    // Make the test function async
    const result = await fastq_config_from_json(CONTEXT.local_file)
    expect(result).toBeDefined()
    expect(result.length).toEqual(1)
    const sample = result[0]
    expect(sample.sample_name).toEqual('NA12878')
    const pairs = sample.fastq_pairs
    expect(pairs.length).toEqual(1)
    const pair = pairs[0]
    expect(pair.read_group).toEqual('Sample_U0a')
    expect(pair.fastq_1).toContain('NA12878/Sample_U0a/U0a_CGATGT_L001_R1_001')
    expect(pair.fastq_2).toContain('NA12878/Sample_U0a/U0a_CGATGT_L001_R2_001')
    expect(pair.platform).toEqual('illumina')
  })
})

// test handler with TEST_EVENT and context = {debug: true}
describe('handler', () => {
  it('should run without error', async () => {
    const result = await handler(TEST_EVENT, CONTEXT)
    expect(result.message).toEqual('Success')
  })
})
