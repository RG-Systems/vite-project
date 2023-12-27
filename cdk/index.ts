#!/usr/bin/env node
import 'source-map-support/register';

import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

import { DistributionStack } from './distribution-stack';
import { StorageStack } from './storage-stack';

const projectName = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
).name;

const app = new cdk.App();

const { ORIGIN_PATH, ENV, DOMAIN, VARIABLES } = process.env || {};

const storageStack = new StorageStack(app, `${projectName}-storage`, {
  env: {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION,
  }
});

const env = (ENV || 'qa').toLowerCase().trim();
const priceClass = env === 'prod' ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100;
const distribution = env === 'tmp' ? `${projectName}-distribution-${env}-${ORIGIN_PATH}` : `${projectName}-distribution-${env}`;
const domain = env === 'tmp' ? `${ORIGIN_PATH}-${DOMAIN}` : DOMAIN;

new DistributionStack(app, distribution, {
  bucket: storageStack.bucket,
  variables: VARIABLES,
  path: ORIGIN_PATH,
  priceClass,
  domain,
  env: {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION,
  }
}).addDependency(storageStack);
