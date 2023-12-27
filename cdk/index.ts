#!/usr/bin/env node
import 'dotenv/config';
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

const { ORIGIN_PATH, ENV, DOMAIN, ...other } = process.env || {};

const variables = Object.keys(other).reduce((acc: Record<string, string>, key) => {
  if (key.startsWith('VARIABLE_')) {
    const name = key.replace('VARIABLE_', '');
    acc[name] = other[name] || '';
  }

  return acc;
}, {});

console.log('DEBUG CDK >>>');

console.log(JSON.stringify(process.env, null, 2));

console.log('=======================================');

console.log('ORIGIN_PATH', ORIGIN_PATH);
console.log('ENV', ENV);
console.log('DOMAIN', DOMAIN);
console.log('VARIABLES', variables);

console.log('DEBUG CDK <<<');


const storageStack = new StorageStack(app, `${projectName}-storage`, {
  env: {
    account: app.node.tryGetContext('account'),
    region: app.node.tryGetContext('region'),
  }
});

const env = (ENV || 'qa').toLowerCase().trim();
const priceClass = env === 'prod' ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100;
const distribution = env === 'tmp' ? `${projectName}-distribution-${env}-${ORIGIN_PATH}` : `${projectName}-distribution-${env}`;
const domain = env === 'tmp' ? `${ORIGIN_PATH}-${DOMAIN}` : DOMAIN;

new DistributionStack(app, distribution, {
  bucket: storageStack.bucket,
  path: ORIGIN_PATH,
  priceClass,
  variables,
  domain,
  env: {
    account: app.node.tryGetContext('account'),
    region: app.node.tryGetContext('region'),
  }
}).addDependency(storageStack);
