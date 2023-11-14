#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { OmicsWorkflowStack } from '../lib/omics-workflow-stack'

const app = new cdk.App()
const omicsWorkflowStack = new OmicsWorkflowStack(app, 'OmicsWorkflowStack', {})
console.log('Hello, CDK!', omicsWorkflowStack)

// Stacks are intentionally not created here -- this application isn't meant to
// be deployed.
