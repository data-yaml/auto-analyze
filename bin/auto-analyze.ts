#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();
console.log('Hello, CDK!', app.node.tryGetContext('name'));

// Stacks are intentionally not created here -- this application isn't meant to
// be deployed.
