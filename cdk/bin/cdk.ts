#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DistributionStack } from '../lib/distribution-stack';
import { StorageStack } from '../lib/storage-stack';
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

const app = new cdk.App();

const {
  ORIGIN_PATH,
  ENV,
  PROJECT_NAME,
  VARIABLES,
} = process.env || {};


const storageStack = new StorageStack(app, `${PROJECT_NAME}-storage`);

new DistributionStack(app, `${PROJECT_NAME}-env-qa`, {
  path: ORIGIN_PATH,
  bucket: storageStack.bucket,
  priceClass: PriceClass.PRICE_CLASS_100,
  variables: JSON.parse(VARIABLES),
});

new DistributionStack(app, `${NAME}-env-prod`, {
  path: ORIGIN_PATH,
  bucket: storageStack.bucket,
  priceClass: PriceClass.PRICE_CLASS_ALL,
  variables: VARIABLES.prod,
});

new DistributionStack(app, `${NAME}-env-tmp-${path}`, {
  path,
  bucket: storageStack.bucket,
  priceClass: PriceClass.PRICE_CLASS_100,
  variables: VARIABLES[tmp] || VARIABLES.qa,
});