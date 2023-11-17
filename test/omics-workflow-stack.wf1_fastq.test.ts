import { fastq_config_from_json } from '../lib/omics-workflow-stack.wf1_fastq'

describe('fastq_config_from_json', () => {
  it('should return a list of sample params', async () => {
    // Make the test function async
    const INPUT_FILE = 'workflows/fastq/aws_region.json'
    const result = await fastq_config_from_json(INPUT_FILE)
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
