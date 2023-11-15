import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { AutoAnalyzeStack } from '../lib/auto-analyze-stack'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Bucket } from 'aws-cdk-lib/aws-s3'

describe('AutoAnalyzeStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App()

    // Since AutoAnalyzeStack consumes resources from a separate stack
    // (cross-stack references), we create a stack for them to live
    // in here. These topics can then be passed to the AutoAnalyzeStack later,
    // creating a cross-stack reference.
    const sourceStack = new cdk.Stack(app, 'SourceStack')

    // create a bucket
    const defaultBucket = new Bucket(sourceStack, 'DefaultBucket', {})
    // Create the topic the stack we're testing will reference.
    const topic = new Topic(sourceStack, 'Topic1', {})

    // Create the StateMachineStack.
    const autoAnalyzeStack = new AutoAnalyzeStack(app, 'AutoAnalyzeStack', {
      inputBucket: defaultBucket,
      outputBucket: defaultBucket,
      statusTopic: topic,
      email: 'test@example.com'
    })

    // Prepare the stack for assertions.
    const template = Template.fromStack(autoAnalyzeStack)

    template.resourceCountIs('AWS::Lambda::Function', 0)

    // Creates the subscription...
    template.resourceCountIs('AWS::SNS::Subscription', 1)
    // ...to the topic we created above.
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: ''
    })
  })
})
