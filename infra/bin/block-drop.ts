#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BlockDropStack } from '../lib/block-drop-stack';

const app = new cdk.App();

new BlockDropStack(app, 'BlockDropStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Private S3 bucket and CloudFront distribution for the Block Drop static site.',
});
