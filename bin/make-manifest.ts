#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'

const AWS_REGION = process.env.CDK_DEFAULT_REGION ?? ''
const CWD = process.cwd()
const FASTQ = path.join(CWD, 'workflows', 'fastq')
const SOURCE = path.join(FASTQ, 'aws_region.json')
const DEST_FOLDER = path.join(FASTQ, AWS_REGION)
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
