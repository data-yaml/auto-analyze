// FILEPATH: /Users/ernest/Documents/GitHub/auto-analyze/auto-analyze/constants.ts
import * as os from 'os';
import { Environment } from 'aws-cdk-lib';

const awsAccount = process.env.CDK_DEFAULT_ACCOUNT || '';
const awsRegion = process.env.CDK_DEFAULT_REGION || '';

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
