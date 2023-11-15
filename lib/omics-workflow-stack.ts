import { Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Rule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction, SnsTopic } from 'aws-cdk-lib/aws-events-targets'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import {
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal
} from 'aws-cdk-lib/aws-iam'
import {
  APP_NAME,
  AWS_ACCOUNT_ID,
  AWS_REGION,
  INPUT_BUCKET,
  OUTPUT_BUCKET,
  READY2RUN_WORKFLOW_ID
} from './constants'

export class OmicsWorkflowStack extends Stack {
  constructor (scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create Input S3 bucket
    const bucketInput = new Bucket(this, INPUT_BUCKET, {
      enforceSSL: true
    }
    )

    // Create Results S3 bucket
    const bucketOutput = new Bucket(this, OUTPUT_BUCKET, {
      enforceSSL: true
    }
    )

    // SNS Topic for failure notifications
    const snsTopic = new Topic(this, `${APP_NAME}_workflow_status_topic`, {
      displayName: `${APP_NAME}_workflow_status_topic`,
      topicName: `${APP_NAME}_workflow_status_topic`
    })

    /*    const emailAddress = new CfnParameter(this, NOTIFICATION_EMAIL);
    snsTopic.addSubscription(
      new subscriptions.EmailSubscription(emailAddress.valueAsString)
    ) */

    // Create an EventBridge rule that sends SNS notification on failure
    const ruleWorkflowStatusTopic = new Rule(
      this,
      `${APP_NAME}_rule_workflow_status_topic`,
      {
        eventPattern: {
          source: ['aws.omics'],
          detailType: ['Run Status Change'],
          detail: {
            status: ['FAILED']
          }
        }
      }
    )
    ruleWorkflowStatusTopic.addTarget(new SnsTopic(snsTopic))

    // Grant EventBridge permission to publish to the SNS topic
    snsTopic.grantPublish(new ServicePrincipal('amazonaws.com'))

    // Create an IAM service role for HealthOmics workflows
    const omicsRole = new Role(this, `${APP_NAME}-omics-service-role`, {
      assumedBy: new ServicePrincipal('omics.amazonaws.com')
    })

    // Limit to buckets from where inputs need to be read
    const omicsS3ReadPolicy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject'],
      resources: [
        bucketInput.bucketArn,
        bucketOutput.bucketArn,
        bucketInput.bucketArn + '/*',
        bucketOutput.bucketArn + '/*'
      ]
    })
    omicsRole.addToPolicy(omicsS3ReadPolicy)

    // Limit to buckets where outputs need to be written
    const omicsS3WritePolicy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:PutObject'],
      resources: [bucketOutput.bucketArn, bucketOutput.bucketArn + '/*']
    })
    omicsRole.addToPolicy(omicsS3WritePolicy)

    // ECR image access
    const omicsEcrPolicy = new PolicyStatement({
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchCheckLayerAvailability'
      ],
      resources: [`arn:aws:ecr:${AWS_REGION}:${AWS_ACCOUNT_ID}:repository/*`]
    })
    omicsRole.addToPolicy(omicsEcrPolicy)

    // CloudWatch logging access
    const omicsLoggingPolicy = new PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:DescribeLogStreams',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${AWS_REGION}:${AWS_ACCOUNT_ID}:log-group:/aws/omics/WorkflowLog:log-stream:*`,
        `arn:aws:logs:${AWS_REGION}:${AWS_ACCOUNT_ID}:log-group:/aws/omics/WorkflowLog:*`
      ]
    })
    omicsRole.addToPolicy(omicsLoggingPolicy)

    // KMS access
    const omicsKmsPolicy = new PolicyStatement({
      actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
      resources: ['*']
    })
    omicsRole.addToPolicy(omicsKmsPolicy)

    // Allow Omics service role to access some common public AWS S3 buckets with test data
    const omicsRoleAdditionalPolicy = new PolicyStatement({
      actions: ['s3:Get*', 's3:List*'],
      resources: [
        'arn:aws:s3:::broad-references',
        'arn:aws:s3:::broad-references/*',
        'arn:aws:s3:::giab',
        'arn:aws:s3:::giab/*',
        `arn:aws:s3:::aws-genomics-static-${AWS_REGION}`,
        `arn:aws:s3:::aws-genomics-static-${AWS_REGION}/*`,
        `arn:aws:s3:::omics-${AWS_REGION}`,
        `arn:aws:s3:::omics-${AWS_REGION}/*`
      ]
    })
    omicsRole.addToPolicy(omicsRoleAdditionalPolicy)

    // Create an IAM role for the Lambda functions
    const lambdaRole = new Role(this, `${APP_NAME}-lambda-role`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ]
    })

    // Allow the Lambda functions to pass Omics service role to the Omics service
    const lambdaIamPassrolePolicy = new PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [omicsRole.roleArn]
    })
    lambdaRole.addToPolicy(lambdaIamPassrolePolicy)

    const lambdaS3Policy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
      resources: [
        bucketInput.bucketArn,
        bucketOutput.bucketArn,
        bucketInput.bucketArn + '/*',
        bucketOutput.bucketArn + '/*'
      ]
    })
    lambdaRole.addToPolicy(lambdaS3Policy)

    const lambdaOmicsPolicy = new PolicyStatement({
      actions: ['omics:StartRun', 'omics:TagResource', 'omics:GetRun'],
      resources: ['*']
    })
    lambdaRole.addToPolicy(lambdaOmicsPolicy)

    // Create Lambda function to submit initial HealthOmics workflow
    const fastqWorkflowLambda = new NodejsFunction(
      this,
      `${APP_NAME}_fastq_workflow`,
      {
        entry: 'resources/workflow1_fastq.ts', // required for lambda function to work
        role: lambdaRole,
        timeout: Duration.seconds(60),
        retryAttempts: 1,
        environment: {
          OMICS_ROLE: omicsRole.roleArn,
          OUTPUT_S3_LOCATION: 's3://' + bucketOutput.bucketName + '/outputs',
          WORKFLOW_ID: READY2RUN_WORKFLOW_ID,
          ECR_REGISTRY:
            AWS_ACCOUNT_ID + '.dkr.ecr.' + AWS_REGION + '.amazonaws.com',
          LOG_LEVEL: 'INFO'
        }
      }
    )
    // Add S3 event source to Lambda
    fastqWorkflowLambda.addEventSource(
      new S3EventSource(bucketInput, {
        events: [EventType.OBJECT_CREATED],
        filters: [{ prefix: 'fastqs/', suffix: '.json' }]
      })
    )

    // Create Lambda function to submit second Omics pipeline
    const vepWorkflowLambda = new NodejsFunction(
      this,
      `${APP_NAME}_vep_workflow`,
      {
        entry: 'resources/workflow2_vep.ts',
        role: lambdaRole,
        timeout: Duration.seconds(60),
        retryAttempts: 1,
        environment: {
          OMICS_ROLE: omicsRole.roleArn,
          OUTPUT_S3_LOCATION: 's3://' + bucketOutput.bucketName + '/outputs',
          UPSTREAM_WORKFLOW_ID: READY2RUN_WORKFLOW_ID,
          ECR_REGISTRY:
            AWS_ACCOUNT_ID + '.dkr.ecr.' + AWS_REGION + '.amazonaws.com',
          SPECIES: 'homo_sapiens',
          DIR_CACHE: `s3://aws-genomics-static-${AWS_REGION}/omics-tutorials/data/databases/vep/`,
          CACHE_VERSION: '110',
          GENOME: 'GRCh38',
          LOG_LEVEL: 'INFO'
        }
      }
    )

    // Create an EventBridge rule that triggers lambda2
    const rulevepWorkflowLambda = new Rule(
      this,
      `${APP_NAME}_rule_second_workflow_workflow`,
      {
        eventPattern: {
          source: ['aws.omics'],
          detailType: ['Run Status Change'],
          detail: {
            status: ['COMPLETED']
          }
        }
      }
    )
    rulevepWorkflowLambda.addTarget(
      new LambdaFunction(vepWorkflowLambda)
    )
  }
}
