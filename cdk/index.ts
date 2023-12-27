#!/usr/bin/env node
import 'dotenv/config';
import 'source-map-support/register';

import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';

import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

import { Stack } from './stack';

const app = new cdk.App();

const { AWS_ACCOUNT, AWS_REGION, ORIGIN_PATH, ENV, DOMAIN, ...other } = process.env || {};
const projectName = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).name;
const env = (ENV || 'qa').toLowerCase().trim();
const priceClass = env === 'prod' ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100;
const stack = env === 'tmp' ? `${projectName}-${env}-${ORIGIN_PATH}` : `${projectName}-${env}`;
const domain = env === 'tmp' ? `${ORIGIN_PATH}-${DOMAIN}` : DOMAIN;
const variables = Object.keys(other).reduce((acc: Record<string, string>, key) => {
  if (key.startsWith('VARIABLE_')) {
    const name = key.replace('VARIABLE_', '');
    acc[name] = other[key] || '';
  }

  return acc;
}, {});

new Stack(app, stack, {
  path: ORIGIN_PATH,
  priceClass,
  variables,
  domain,
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  }
});
