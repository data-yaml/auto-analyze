import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { AWS_REGION } from './constants'
import { regionalManifest } from './manifest'

export interface AutoAnalyzeStackProps extends StackProps {
  readonly inputBucket: Bucket
  readonly outputBucket: Bucket
  readonly statusTopic: Topic
  readonly email: string
  readonly manifest_prefix: string
  readonly manifest_suffix: string
}

// read source manifest
// read region
// create regional manifest

export class AutoAnalyzeStack extends Stack {
  constructor(scope: Construct, id: string, props: AutoAnalyzeStackProps) {
    super(scope, id, props)

    // subscribe email to statusTopic
    props.statusTopic.addSubscription(new EmailSubscription(props.email))

    // TODO: subscribe email to inputBucket changes

    // create Manifest
    const manifestFolder = regionalManifest(AWS_REGION)
    const manifestKey = `${props.manifest_prefix}/${AWS_REGION}${props.manifest_suffix}`

    // deploy files to S3
    const deploy = new BucketDeployment(this, 'DeployManifest', {
      sources: [Source.asset(manifestFolder)],
      destinationBucket: props.inputBucket,
      destinationKeyPrefix: manifestKey
    })
  }
}
