#!/usr/bin/env node --env-file .env
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AutoAnalyzeStack } from '../lib/auto-analyze-stack'
import { OmicsWorkflowStack } from '../lib/omics-workflow-stack'
import { NOTIFICATION_EMAIL } from '../lib/constants'

const app = new cdk.App()
const omicsWorkflowStack = new OmicsWorkflowStack(app, 'OmicsWorkflowStack', {})
const autoAnalyzeStack = new AutoAnalyzeStack(app, 'AutoAnalyzeStack', {
  inputBucket: omicsWorkflowStack.inputBucket,
  outputBucket: omicsWorkflowStack.outputBucket,
  statusTopic: omicsWorkflowStack.statusTopic,
  email: NOTIFICATION_EMAIL,
  manifest_prefix: omicsWorkflowStack.manifest_prefix,
  manifest_suffix: omicsWorkflowStack.manifest_suffix,
})

console.log('Hello, CDK!', omicsWorkflowStack)
