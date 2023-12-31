import * as fs from 'fs'
import * as path from 'path'

const CWD = process.cwd()
const SOURCE_FOLDER = path.join(CWD, 'workflows', 'fastq')
const SOURCE = path.join(SOURCE_FOLDER, 'aws_region.json')

export function regionalManifest(region: string) {
  const DEST_FOLDER = path.join(SOURCE_FOLDER, region)
  const DEST_KEY = `${region}.json`
  const DEST = path.join(DEST_FOLDER, DEST_KEY)
  fs.mkdirSync(DEST_FOLDER, { recursive: true })

  // read the source file and print its contents
  const source = fs.readFileSync(SOURCE, 'utf8')
  // substitute the `region` for the string "{aws-region}"
  const dest =
    source
      .replace(/{aws-region}/g, region)
      .replace(/{timestamp}/g, Date.now().toString()) + '\n'
  // write the destination file
  // console.debug(dest)
  fs.writeFileSync(DEST, dest, 'utf8')
  return DEST_FOLDER
}
