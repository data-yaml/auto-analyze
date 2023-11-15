#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import * as AWS from 'aws-sdk'

import { AWS_REGION, INPUT_BUCKET } from '../lib/constants'

const CWD = process.cwd()
const FASTQ = path.join(CWD, 'workflows', 'fastq')
const SOURCE = path.join(FASTQ, 'aws_region.json')
const DEST_FOLDER = path.join(FASTQ, AWS_REGION)
const DEST_KEY = `${AWS_REGION}.json`
const DEST = path.join(DEST_FOLDER, `${AWS_REGION}.json`)
fs.mkdirSync(DEST_FOLDER, { recursive: true })

console.log(`AWS_REGION: ${AWS_REGION}`)
console.log(`folder: ${FASTQ}`)

// read the source file and print its contents
console.log(`SOURCE: ${SOURCE}`)
const source = fs.readFileSync(SOURCE, 'utf8')
// substitute the AWS_REGION for the string "{aws-region}"
const dest = source.replace(/{aws-region}/g, AWS_REGION)
// write the destination file
console.log(dest)
fs.writeFileSync(DEST, dest, 'utf8')
console.log(`DEST: ${DEST}`)

// upload dest to INPUT_BUCKET

const s3 = new AWS.S3()
const uploadParams = {
  Bucket: INPUT_BUCKET,
    Key: DEST_KEY,
  Body: dest
}
