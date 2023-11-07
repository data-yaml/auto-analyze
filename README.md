# auto-analyze

## Benchling to Omics to NextFlow to Quilt

Inspired by https://github.com/aws-samples/aws-healthomics-eventbridge-integration

* Benchling
* AWS Omics
* NextFlow from Seqera Labs
* Quilt Data

## Steps

1. Create Benchling Notebook with "Auto-Analyze" Schema
2. Upload data files to the specified S3 Prefix
3. There is no Step 3

The results will automatically be populated in the Notebook Metadata.

## Setup

```bash
make synth
```