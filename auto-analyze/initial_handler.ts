import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as util from "util";
import { v4 as uuidv4 } from "uuid";

const OUTPUT_S3_LOCATION = process.env.OUTPUT_S3_LOCATION;
const OMICS_ROLE = process.env.OMICS_ROLE;
const WORKFLOW_ID = process.env.WORKFLOW_ID;
const ECR_REGISTRY = process.env.ECR_REGISTRY;
const LOG_LEVEL = process.env.LOG_LEVEL;

const omics = new AWS.Omics();
const s3 = new AWS.S3();

async function localize_s3_file(
  bucket: string,
  _key: string,
  local_file: string,
) {
  const s3Client = new AWS.S3();

  try {
    const file = fs.createWriteStream(local_file);
    const stream = s3Client
      .getObject({ Bucket: bucket, Key: _key })
      .createReadStream();
    stream.pipe(file);
    await new Promise((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });
  } catch (e: any) {
    if (e.code === "NoSuchKey") {
      console.error("The object does not exist.");
    } else {
      throw e;
    }
  }
}

async function build_input_payload_for_r2r_gatk_fastq2vcf(
  sample_manifest_csv: string,
) {
  const contents = await util.promisify(fs.readFile)(
    sample_manifest_csv,
    "utf8",
  );
  const lines = contents.split("\n");

  const header = lines[0].trim();
  if (header !== "sample_name,read_group,fastq_1,fastq_2,platform") {
    throw new Error("Invalid sample manifest CSV header");
  }

  const samples: any = {};
  for (const _line of lines.slice(1)) {
    const [sample_name, read_group, fastq_1, fastq_2, platform] = _line
      .trim()
      .split(",");
    if (!samples[sample_name]) {
      samples[sample_name] = {};
    }
    if (!samples[sample_name][read_group]) {
      samples[sample_name][read_group] = {};
    }
    samples[sample_name][read_group].fastq_1 = fastq_1;
    samples[sample_name][read_group].fastq_2 = fastq_2;
    samples[sample_name][read_group].platform = platform;
  }

  const samples_params = [];
  for (const [_sample, _obj] of Object.entries(samples)) {
    console.info(`Creating input payload for sample: ${_sample}`);
    const _params: any = {};
    _params.sample_name = _sample;
    _params.fastq_pairs = [];
    for (const [_rg, _details] of Object.entries(_obj as Record<string, any>)) {
      _params.fastq_pairs.push({
        read_group: _rg,
        fastq_1: _details.fastq_1 as string,
        fastq_2: _details.fastq_2 as string,
        platform: _details.platform as string,
      });
    }
    samples_params.push(_params);
  }

  return samples_params;
}

export async function handler(event: any, context: any) {
  console.debug("Received event: " + JSON.stringify(event, null, 2));

  const num_upload_records = event.Records.length;
  let filename, bucket_arn, bucket_name;
  if (num_upload_records === 1) {
    filename = event.Records[0].s3.object.key;
    bucket_arn = event.Records[0].s3.bucket.arn;
    bucket_name = event.Records[0].s3.bucket.name;
    console.info(`Processing ${filename} in ${bucket_arn}`);
  } else if (num_upload_records === 0) {
    throw new Error("No file detected for analysis!");
  } else {
    throw new Error("Multiple s3 files in event not yet supported");
  }

  const local_file = "/tmp/sample_manifest.csv";
  await localize_s3_file(bucket_name, filename, local_file);
  console.info(`Downloaded manifest CSV to: ${local_file}`);

  const multi_sample_params =
    await build_input_payload_for_r2r_gatk_fastq2vcf(local_file);
  let error_count = 0;
  for (const _item of multi_sample_params) {
    const _samplename = _item.sample_name;
    console.info(`Starting workflow for sample: ${_samplename}`);
    const run_name = `Sample_${_samplename}_` + uuidv4();
    try {
      const options = {
        workflowType: "BATCH", // add a workflowType
        workflowId: WORKFLOW_ID,
        name: run_name,
        roleArn:
          OMICS_ROLE || "arn:aws:iam::0000000000:role/omics-service-role",
        parameters: _item,
        logLevel: LOG_LEVEL,
        outputUri: OUTPUT_S3_LOCATION,
        tags: {
          SOURCE: "LAMBDA_INITIAL_WORKFLOW",
          RUN_NAME: run_name,
          SAMPLE_MANIFEST: `s3://${bucket_name}/${filename}`,
        },
        requestId: uuidv4(), // add a unique requestId
      };
      const response = await omics.startRun(options).promise();
      console.info(`Workflow response: ${JSON.stringify(response)}`);
    } catch (e: any) {
      console.error("Error : " + e.toString());
      error_count += 1;
    }
  }

  if (error_count > 0) {
    throw new Error("Error launching some workflows, check logs");
  }
}
