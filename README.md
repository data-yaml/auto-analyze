# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Process

```bash
source .env # create from example.env
npm install
npx cdk bootstrap "aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION"
npx cdk deploy
npm run upload
```

## Useful commands

- `npm test` perform the jest unit tests
- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile/test
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
