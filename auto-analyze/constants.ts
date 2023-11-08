// FILEPATH: /Users/ernest/Documents/GitHub/auto-analyze/auto-analyze/constants.ts
import * as os from 'os';
import { Environment } from 'aws-cdk-lib';

export const AWS_ACCOUNT_ID = process.env.CDK_DEFAULT_ACCOUNT || '';
export const AWS_REGION = process.env.CDK_DEFAULT_REGION || '';

export const OUTPUT_S3_LOCATION: string = process.env.OUTPUT_S3_LOCATION!;
export const OMICS_ROLE: string = process.env.OMICS_ROLE!;
export const WORKFLOW_ID: string = process.env.WORKFLOW_ID!;
export const UPSTREAM_WORKFLOW_ID: string = process.env.UPSTREAM_WORKFLOW_ID!;
export const ECR_REGISTRY: string = process.env.ECR_REGISTRY!;
export const VEP_SPECIES: string = process.env.SPECIES!;
export const VEP_DIR_CACHE: string = process.env.DIR_CACHE!;
export const VEP_CACHE_VERSION: string = process.env.CACHE_VERSION!;
export const VEP_GENOME: string = process.env.GENOME!;
export const LOG_LEVEL: string = process.env.LOG_LEVEL!;

const APP_NAME = 'healthomics';
const READY2RUN_WORKFLOW_ID = '9500764';

// Dev Environment
const DEV_ENV = {
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    region: process.env.CDK_DEFAULT_REGION!,
};
const DEV_CONFIG = { 
    AWS_REGION: 'us-east-1',
    AWS_BUCKET: 'omics-eventbridge-solution-dev',
    JOB_TIMEOUT: 1500, // seconds

    // SQS QUEUE INFORMATION:
    SQS_MESSAGE_VISIBILITY: 1200, // Timeout (secs) for messages in flight (average time to be processed)

    // PLUGINS
    REQUIREMENTS_FILE: '/files/requirements.txt', // Path to requirements file
};