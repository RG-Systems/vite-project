#!/usr/bin/env node
import 'dotenv/config';
import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

import { Stack } from './stack';

const app = new cdk.App();

const { AWS_ACCOUNT, AWS_REGION, ORIGIN_PATH, ENV, STACK, DOMAIN, PROJECT_NAME, ...other } = process.env || {};
const env = (ENV || 'qa').toLowerCase().trim();
const priceClass = env === 'prod' ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100;
const variables = Object.keys(other).reduce((acc: Record<string, string>, key) => {
  if (key.startsWith('VARIABLE_')) {
    const name = key.replace('VARIABLE_', '');
    acc[name] = other[key] || '';
  }

  return acc;
}, {});

new Stack(app, STACK!, {
  project: PROJECT_NAME,
  path: ORIGIN_PATH,
  domain: DOMAIN,
  priceClass,
  variables,
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  }
});
