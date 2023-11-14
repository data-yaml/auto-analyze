#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import { type Construct } from 'constructs'

import {
    APP_NAME,
    AWS_ACCOUNT_ID,
    AWS_REGION
} from './constants'


export class ManifestUploadStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const bucketInput = new s3.Bucket(
            this,
            `${APP_NAME}-cka-input-${AWS_ACCOUNT_ID}-${AWS_REGION}`,
            {
                enforceSSL: true
            }
        )

        const manifest_upload = new s3deploy.BucketDeployment(this, `${APP_NAME}_deploy_regional_manifest_${AWS_REGION}`, {
            sources: [s3deploy.Source.asset(`./workflows/fastq/${AWS_REGION}/`)],
            destinationBucket: bucketInput
        })

    }
}
