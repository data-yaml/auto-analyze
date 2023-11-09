import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as iam from 'aws-cdk-lib/aws-iam'
import { type Construct } from 'constructs'

export class OmicsWorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const awsAccount = process.env.CDK_DEFAULT_ACCOUNT ?? ''
    const AWS_REGION = process.env.CDK_DEFAULT_REGION ?? ''

    const APP_NAME = 'healthomics'
    const READY2RUN_WORKFLOW_ID = '9500764'

    // Create Input S3 bucket
    const bucketInput = new s3.Bucket(
      this,
      `${APP_NAME}-cka-input-${awsAccount}-${AWS_REGION}`,
      {
        enforceSSL: true
      }
    )

    // Create Results S3 bucket
    const bucketOutput = new s3.Bucket(
      this,
      `${APP_NAME}-cka-output-${awsAccount}-${AWS_REGION}`,
      {
        enforceSSL: true
      }
    )

    // SNS Topic for failure notifications
    const snsTopic = new sns.Topic(this, `${APP_NAME}_workflow_status_topic`, {
      displayName: `${APP_NAME}_workflow_status_topic`,
      topicName: `${APP_NAME}_workflow_status_topic`
    })

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
      resources: [`arn:aws:ecr:${AWS_REGION}:${awsAccount}:repository/*`]
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
        `arn:aws:logs:${AWS_REGION}:${awsAccount}:log-group:/aws/omics/WorkflowLog:log-stream:*`,
        `arn:aws:logs:${AWS_REGION}:${awsAccount}:log-group:/aws/omics/WorkflowLog:*`
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
    const initialWorkflowLambda = new lambda.Function(
      this,
      `${APP_NAME}_initial_workflow_lambda`,
      {
        runtime: lambda.Runtime.PYTHON_3_8,
        handler: 'initial_workflow_lambda_handler.handler',
        code: lambda.Code.fromAsset('lambda_function/initial_workflow_lambda'),
        role: lambdaRole,
        timeout: cdk.Duration.seconds(60),
        retryAttempts: 1,
        environment: {
          OMICS_ROLE: omicsRole.roleArn,
          OUTPUT_S3_LOCATION: 's3://' + bucketOutput.bucketName + '/outputs',
          WORKFLOW_ID: READY2RUN_WORKFLOW_ID,
          ECR_REGISTRY:
            awsAccount + '.dkr.ecr.' + AWS_REGION + '.amazonaws.com',
          LOG_LEVEL: 'INFO'
        }
      }
    )

    // Add S3 event source to Lambda
    initialWorkflowLambda.addEventSource(
      new lambdaEventSources.S3EventSource(bucketInput, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ prefix: 'fastqs/', suffix: '.csv' }]
      })
    )
    // Create Lambda function to submit second Omics pipeline
    const secondWorkflowLambda = new lambda.Function(
      this,
      `${APP_NAME}_post_initial_workflow_lambda`,
      {
        runtime: lambda.Runtime.PYTHON_3_8,
        handler: 'post_initial_workflow_lambda_handler.handler',
        code: lambda.Code.fromAsset(
          'lambda_function/post_initial_workflow_lambda'
        ),
        role: lambdaRole,
        timeout: cdk.Duration.seconds(60),
        retryAttempts: 1,
        environment: {
          OMICS_ROLE: omicsRole.roleArn,
          OUTPUT_S3_LOCATION: 's3://' + bucketOutput.bucketName + '/outputs',
          UPSTREAM_WORKFLOW_ID: READY2RUN_WORKFLOW_ID,
          ECR_REGISTRY:
            awsAccount + '.dkr.ecr.' + AWS_REGION + '.amazonaws.com',
          SPECIES: 'homo_sapiens',
          DIR_CACHE: `s3://aws-genomics-static-${AWS_REGION}/omics-tutorials/data/databases/vep/`,
          CACHE_VERSION: '110',
          GENOME: 'GRCh38',
          LOG_LEVEL: 'INFO'
        }
      }
    )

    // Create an EventBridge rule that triggers lambda2
    const ruleSecondWorkflowLambda = new events.Rule(
      this,
      `${APP_NAME}_rule_second_workflow_lambda`,
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
    ruleSecondWorkflowLambda.addTarget(
      new targets.LambdaFunction(secondWorkflowLambda)
    )
  }
}
