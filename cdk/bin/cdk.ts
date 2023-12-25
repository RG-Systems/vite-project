#!/usr/bin/env node
import 'source-map-support/register';


import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

import { DistributionStack } from '../lib/distribution-stack';
import { StorageStack } from '../lib/storage-stack';

const manifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

const name = manifest.name;

const app = new cdk.App();

const { ORIGIN_PATH, ENV, DOMAIN, VARIABLES } = process.env || {};

const storageStack = new StorageStack(app, `${name}-storage`);

const env = (ENV || 'qa').toLowerCase().trim();
const priceClass = env === 'prod' ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100;
const variables = JSON.parse(VARIABLES || '{}');
const originPath = ORIGIN_PATH || '';
const distribution = env === 'tmp' ? `${originPath}-${name}-distribution-${env}` : `${name}-distribution-${env}`;
const domains = [];
if (DOMAIN) {
  if (env === 'tmp') {
    domains.push(`${originPath}-${DOMAIN}`);
  } else {
    domains.push(DOMAIN);
  }
}

new DistributionStack(app, distribution, {
  bucket: storageStack.bucket,
  path: originPath,
  priceClass,
  variables,
  domains,
}).addDependency(storageStack);
