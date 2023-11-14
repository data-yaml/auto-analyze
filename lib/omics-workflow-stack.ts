import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as iam from 'aws-cdk-lib/aws-iam'
import { type Construct } from 'constructs'
import {
  APP_NAME,
  AWS_ACCOUNT_ID,
  AWS_REGION,
  NOTIFICATION_EMAIL,
  READY2RUN_WORKFLOW_ID
 } from './constants'


export class OmicsWorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Create Input S3 bucket
    const bucketInput = new s3.Bucket(
      this,
      `${APP_NAME}-cka-input-${AWS_ACCOUNT_ID}-${AWS_REGION}`,
      {
        enforceSSL: true
      }
    )

    // Create Results S3 bucket
    const bucketOutput = new s3.Bucket(
      this,
      `${APP_NAME}-cka-output-${AWS_ACCOUNT_ID}-${AWS_REGION}`,
      {
        enforceSSL: true
      }
    )

    // SNS Topic for failure notifications
    const snsTopic = new sns.Topic(this, `${APP_NAME}_workflow_status_topic`, {
      displayName: `${APP_NAME}_workflow_status_topic`,
      topicName: `${APP_NAME}_workflow_status_topic`
    })
    const emailAddress = new cdk.CfnParameter(this, NOTIFICATION_EMAIL);
    snsTopic.addSubscription(
      new subscriptions.EmailSubscription(emailAddress.valueAsString)
    )

    // Create an EventBridge rule that sends SNS notification on failure
    const ruleWorkflowStatusTopic = new events.Rule(
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
    ruleWorkflowStatusTopic.addTarget(new targets.SnsTopic(snsTopic))

    // Grant EventBridge permission to publish to the SNS topic
    snsTopic.grantPublish(new iam.ServicePrincipal('events.amazonaws.com'))

    // Create an IAM service role for HealthOmics workflows
    const omicsRole = new iam.Role(this, `${APP_NAME}-omics-service-role`, {
      assumedBy: new iam.ServicePrincipal('omics.amazonaws.com')
    })

    // Limit to buckets from where inputs need to be read
    const omicsS3ReadPolicy = new iam.PolicyStatement({
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
    const omicsS3WritePolicy = new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:PutObject'],
      resources: [bucketOutput.bucketArn, bucketOutput.bucketArn + '/*']
    })
    omicsRole.addToPolicy(omicsS3WritePolicy)

    // ECR image access
    const omicsEcrPolicy = new iam.PolicyStatement({
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchCheckLayerAvailability'
      ],
      resources: [`arn:aws:ecr:${AWS_REGION}:${AWS_ACCOUNT_ID}:repository/*`]
    })
    omicsRole.addToPolicy(omicsEcrPolicy)

    // CloudWatch logging access
    const omicsLoggingPolicy = new iam.PolicyStatement({
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
    const omicsKmsPolicy = new iam.PolicyStatement({
      actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
      resources: ['*']
    })
    omicsRole.addToPolicy(omicsKmsPolicy)

    // Allow Omics service role to access some common public AWS S3 buckets with test data
    const omicsRoleAdditionalPolicy = new iam.PolicyStatement({
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
    const lambdaRole = new iam.Role(this, `${APP_NAME}-lambda-role`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ]
    })

    // Allow the Lambda functions to pass Omics service role to the Omics service
    const lambdaIamPassrolePolicy = new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [omicsRole.roleArn]
    })
    lambdaRole.addToPolicy(lambdaIamPassrolePolicy)

    const lambdaS3Policy = new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
      resources: [
        bucketInput.bucketArn,
        bucketOutput.bucketArn,
        bucketInput.bucketArn + '/*',
        bucketOutput.bucketArn + '/*'
      ]
    })
    lambdaRole.addToPolicy(lambdaS3Policy)

    const lambdaOmicsPolicy = new iam.PolicyStatement({
      actions: ['omics:StartRun', 'omics:TagResource', 'omics:GetRun'],
      resources: ['*']
    })
    lambdaRole.addToPolicy(lambdaOmicsPolicy)

    // Create Lambda function to submit initial HealthOmics workflow
    const fastqWorkflowLambda = new lambda.Function(
      this,
      `${APP_NAME}_fastq_workflow`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'workflow1_fastq.handler',
        code: lambda.Code.fromAsset('lambda_function/workflow1_fastq'),
        role: lambdaRole,
        timeout: cdk.Duration.seconds(60),
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
      new lambdaEventSources.S3EventSource(bucketInput, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ prefix: 'fastqs/', suffix: '.json' }]
      })
    )

    // Create Lambda function to submit second Omics pipeline
    const vepWorkflowLambda = new lambda.Function(
      this,
      `${APP_NAME}_vep_workflow`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'workflow2_vep.handler',
        code: lambda.Code.fromAsset(
          'lambda_function/workflow2_vep'
        ),
        role: lambdaRole,
        timeout: cdk.Duration.seconds(60),
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
    const rulevepWorkflowLambda = new events.Rule(
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
      new targets.LambdaFunction(vepWorkflowLambda)
    )

    const manifest_upload = new s3deploy.BucketDeployment(this, `${APP_NAME}_deploy_regional_manifest`, {
      sources: [s3deploy.Source.asset(`./workflows/fastq/${AWS_REGION}/`)],
      destinationBucket: bucketInput
    })
  } 
}
