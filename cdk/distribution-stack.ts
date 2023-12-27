import type { Construct } from 'constructs';
import type { Bucket } from 'aws-cdk-lib/aws-s3';

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';

type Props = cdk.StackProps & {
    path?: string;
    bucket: Bucket;
    domain?: string;
    priceClass?: cloudfront.PriceClass;
    variables?: Record<string, string | undefined>;
};

export class DistributionStack extends cdk.Stack {
    private zone: route53.IHostedZone;
    private certificate: acm.ICertificate;

    constructor(scope: Construct, id: string, { bucket, path, variables, domain, priceClass, ...props }: Props) {
        super(scope, id, props);

        if (domain) {
          const domainName = domain.split('.').slice(1).join('.');
          this.zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName });
          this.certificate = new acm.Certificate(this, 'Certificate', {
            domainName: domain,
            subjectAlternativeNames: [`*.${domainName}`],
            validation: acm.CertificateValidation.fromDns(this.zone),
          });
        }

        const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'OAI', {
          comment: `OAI for ${bucket.bucketName}`
        });

        bucket.addToResourcePolicy(new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [bucket.arnForObjects('*')],
          principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
        }));

        const envsHandler = new cloudfront.Function(this, 'Function', {
          code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {
            if (!event.request.uri.endsWith('/env.json')) return event.request;
            return {
              statusCode: 200,
              statusDescription: 'OK',
              headers: {
                  'content-type': {
                    value: 'application/json;charset=UTF-8',
                  },
              },
              body: ${JSON.stringify(variables)},
            };
          }
          `),
        });

        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            priceClass: priceClass ?? cloudfront.PriceClass.PRICE_CLASS_100,
            certificate: this.certificate,
            domainNames: domain ? [domain] : undefined,
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
            defaultBehavior: {
                origin: new origins.S3Origin(bucket, { originPath: path, originAccessIdentity: cloudfrontOAI }),
                compress: true,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                functionAssociations: [
                    {
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function: envsHandler,
                    }
                ],
            },
        });

        if (domain) {
          new route53.ARecord(this, 'ARecord', {
            recordName: domain,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
            zone: this.zone,
          });
        }

        new cdk.CfnOutput(this, 'DeploymentUrl', {
          value: 'https://' + domain,
        });

        new cdk.CfnOutput(this, 'DistributionUrl', {
          value: 'https://' + distribution.domainName,
        });

        new cdk.CfnOutput(this, 'DistributionId', {
          value: distribution.distributionId,
        });

        new cdk.CfnOutput(this, 'BucketName', {
          value: bucket.bucketName,
        });
    }
}
