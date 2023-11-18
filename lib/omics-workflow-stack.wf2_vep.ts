import * as AWS from 'aws-sdk'
// import * as os from 'os';
// import { ClientError } from 'aws-sdk/lib/error';
import * as uuid from 'uuid'

const OUTPUT_S3_LOCATION: string = process.env.OUTPUT_S3_LOCATION!
const OMICS_ROLE: string = process.env.OMICS_ROLE!
const WORKFLOW_ID: string = process.env.WORKFLOW_ID!
const UPSTREAM_WORKFLOW_ID: string = process.env.UPSTREAM_WORKFLOW_ID!
const ECR_REGISTRY: string = process.env.ECR_REGISTRY!
const VEP_SPECIES: string = process.env.SPECIES!
const VEP_DIR_CACHE: string = process.env.DIR_CACHE!
const VEP_CACHE_VERSION: string = process.env.CACHE_VERSION!
const VEP_GENOME: string = process.env.GENOME!
const LOG_LEVEL: string = process.env.LOG_LEVEL!

const omics = new AWS.Omics()
const s3 = new AWS.S3()

// Lambda function triggered by EventBridge event
// from Omics successful run of initial workflow
// and submit the next workflow
// Example event
/* {
    "version": "0",
    "id": "4c338660-3a89-69ad-40d5-aakjhfjkaf",
    "detail-type": "Run Status Change",
    "source": "aws.omics",
    "account": "0000000000",
    "time": "2023-07-28T06:19:39Z",
    "region": "us-west-2",
    "resources":
    [
        "arn:aws:omics:us-west-2:0000000000:run/1111111"
    ],
    "detail":
    {
        "omicsVersion": "1.0.0",
        "arn": "arn:aws:omics:us-west-2:0000000000:run/1111111",
        "status": "PENDING"
    }
}
*/
function splitS3Path(s3Path: string): [string, string] {
  const pathParts = s3Path.replace('s3://', '').split('/')
  const bucket = pathParts.shift()!
  const key = pathParts.join('/')
  return [bucket, key]
}

export async function handler(event: any, context: any): Promise<any> {
  const AWS_ACCOUNT_ID = (await new AWS.STS().getCallerIdentity().promise())
    .Account!

  console.debug(event)

  // check if event is valid
  const event_detail_type = event['detail-type']
  if (event_detail_type !== 'Run Status Change') {
    throw new Error('Unknown event triggered this Lambda, unable to process')
  }

  // Get the omics run ID
  const omics_run_id = event.detail.arn.split('/').pop()!
  console.info(`Omics Run ID: ${omics_run_id}`)

  // Get the omics run details
  const omics_workflow_run = await omics.getRun({ id: omics_run_id }).promise()
  const omics_workflowId = omics_workflow_run.workflowId
  if (omics_workflowId === UPSTREAM_WORKFLOW_ID) {
    console.info(
      `Omics Workflow ID: ${omics_workflowId} matched, continue processing`
    )
  } else {
    console.info(
      `ERROR! Expected input from workflow (${UPSTREAM_WORKFLOW_ID}), but received input from workflow (${omics_workflowId}) `
    )
    return {
      statusCode: 200,
      runStatus:
        'Lambda function finished successfully. No HealthOmics workflow started.',
      runIds: []
    }
  }

  // list all files in output bucket

  const run_output_path = `${omics_workflow_run.outputUri}/${omics_run_id}`
  const [s3bucket, s3key] = splitS3Path(run_output_path)
  //  iterate through all objects in bucket to find .vcf.gz file
  // find .vcf.gz file in directory
  let found = false
  let vcf_file = null
  let continuation_token = null
  do {
    const list_objects_response: any = await s3
      .listObjectsV2({
        Bucket: s3bucket,
        Prefix: s3key,
        ContinuationToken: continuation_token
      })
      .promise()
    if (list_objects_response.Contents) {
      for (const object of list_objects_response.Contents) {
        const key = object.Key!
        if (key.endsWith('.vcf.gz')) {
          found = true
          vcf_file = `s3://${s3bucket}/${key}`
          break
        }
      }
    }
    continuation_token = list_objects_response.NextContinuationToken
  } while (!found && continuation_token)
  if (!found || !vcf_file) {
    throw new Error('no .vcf.gz file found in output directory, exiting')
  }

  const sample_name = vcf_file.split('/').pop()!.split('.')[0]
  const run_name = `VEP Sample ${sample_name} ${uuid.v4()}`

  const workflow_params = {
    id: sample_name,
    vcf: vcf_file,
    vep_species: VEP_SPECIES,
    vep_genome: VEP_GENOME,
    ecr_registry: ECR_REGISTRY,
    vep_cache: VEP_DIR_CACHE,
    vep_cache_version: VEP_CACHE_VERSION
  }

  try {
    const run = await omics
      .startRun({
        workflowType: 'PRIVATE',
        workflowId: WORKFLOW_ID,
        name: run_name,
        roleArn: OMICS_ROLE,
        parameters: workflow_params,
        logLevel: 'ALL',
        outputUri: OUTPUT_S3_LOCATION,
        tags: {
          SOURCE: 'LAMBDA_WF2_VEP',
          PARENT_WORKFLOW_ID: UPSTREAM_WORKFLOW_ID,
          PARENT_WORKFLOW_RUN_ID: omics_run_id,
          SAMPLE_NAME: sample_name
        },
        requestId: uuid.v4() // add requestId property
      })
      .promise()
    // get relevant run details
    const run_id = run.id
    console.info(
      `Successfully started HealthOmics Run ID: ${run_id} for sample: ${sample_name}`
    )
  } catch (e: any) {
    throw new Error('unknown error : ' + e.toString())
  }

  return {
    statusCode: 200,
    statusMessage: 'Workflows launched successfully'
  }
}
