import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Topic } from 'aws-cdk-lib/aws-sns'

export interface AutoAnalyzeStackProps extends StackProps {
  readonly inputBucket: Bucket
  readonly outputBucket: Bucket
  readonly statusTopic: Topic
  readonly email: string
}

// read source manifest
// read region
// create regional manifest

export class AutoAnalyzeStack extends Stack {
  constructor(scope: Construct, id: string, props: AutoAnalyzeStackProps) {
    super(scope, id, props)

    // subscribe email to sns topic
    /*    const emailAddress = new CfnParameter(this, NOTIFICATION_EMAIL);
    snsTopic.addSubscription(
      new subscriptions.EmailSubscription(emailAddress.valueAsString)
    ) */

    // subscribe email to buckets

    // upload manifest to input bucket
  }
}
