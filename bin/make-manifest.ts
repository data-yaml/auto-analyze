#!/usr/bin/env node

import * as fs from 'fs'

const AWS_REGION = process.env.CDK_DEFAULT_REGION ?? ''
const SOURCE="./workflows/fastq/aws_region.json"
const DEST =`./workflows/fastq/${AWS_REGION}.json`

console.log(`AWS_REGION: ${AWS_REGION}`)
console.log(`cwd(): ${process.cwd()}`)

// read the source file and print its contents
console.log(`SOURCE: ${SOURCE}`)
const source = fs.readFileSync(SOURCE, 'utf8')
// substitute the AWS_REGION for the string "{aws-region}"
const dest = source.replace(/{aws-region}/g, AWS_REGION)
// write the destination file
console.log(dest)
fs.writeFileSync(DEST, dest, 'utf8')
console.log(`DEST: ${DEST}`)
