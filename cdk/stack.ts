import type { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

type Props = cdk.StackProps & {
    domain?: string;
    path?: string;
    project?: string;
    priceClass?: cloudfront.PriceClass;
    variables?: Record<string, string | undefined>;
};

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, { path, variables, domain, project, priceClass, ...props }: Props) {
    super(scope, id, props);

    const originAccessIdentity = this.getOriginAccessIdentity();
    const bucket = this.getBucket(project || id);
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(
        originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
      )]
    }));

    const zone = this.getZone(domain);
    const certificate = this.getCertificate(zone, domain);
    const functionAssociation = this.getFunctionAssociation(variables);
    const origin = this.getOrigin(bucket, originAccessIdentity, path);
    const distribution = this.getDistribution(
      origin,
      bucket,
      functionAssociation,
      certificate,
      domain,
      path,
      priceClass,
    );

    this.createSubdomainRecords(distribution, zone, domain);
    this.createOutput(distribution, bucket, domain);
  }

  private getOriginAccessIdentity(): cloudfront.OriginAccessIdentity {
    return new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
  }

  private getBucket(value: string): s3.Bucket {
    const bucket = s3.Bucket.fromBucketName(this, 'Bucket', `${value}-storage`);
    if (bucket) return bucket as s3.Bucket;
    else {
      return new s3.Bucket(this, 'Bucket', {
        bucketName: `${value}-storage`,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        accessControl: s3.BucketAccessControl.PRIVATE,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }
  }

  private getZone(domain?: string): route53.IHostedZone | undefined {
    if (domain) {
      const [_, ...domains] = domain.split('.');
      const domainName = domains.join('.');
      return route53.HostedZone.fromLookup(this, 'Zone', { domainName });
    }

    return undefined;
  }

  private getCertificate(zone?: route53.IHostedZone, domain?: string): acm.ICertificate | undefined {
    if (domain && zone) {
      return new acm.Certificate(this, 'Certificate', {
        domainName: domain,
        validation: acm.CertificateValidation.fromDns(zone),
      });
    }

    return undefined;
  }

  private getOrigin(bucket: s3.Bucket, originAccessIdentity: cloudfront.OriginAccessIdentity, path?: string): origins.S3Origin {
    return  new origins.S3Origin(bucket, { originPath: path, originAccessIdentity });
  }

  private getFunctionAssociation(variables?: Record<string, string | undefined>): cloudfront.FunctionAssociation | undefined{
    if (variables === undefined) return undefined;
    return {
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
      function: new cloudfront.Function(this, 'Function', {
        code: cloudfront.FunctionCode.fromInline(
          "function handler(event) {" +
            "if (!event.request.uri.endsWith('/env.json')) {" +
              "return event.request;" +
            "}" +
            "return {" +
              "statusCode: 200," +
              "statusDescription: 'OK'," +
              "headers: {" +
                "'content-type': {" +
                  "value: 'application/json;charset=UTF-8'," +
                "}," +
              "}," +
              `body: JSON.stringify(${JSON.stringify(variables)}),` +
            "};" +
          "}"
        ),
      }),
    }
  }

  private getDistribution(
    origin: origins.S3Origin,
    bucket: s3.Bucket,
    functionAssociation?: cloudfront.FunctionAssociation,
    certificate?: acm.ICertificate,
    domain?: string,
    path?: string,
    priceClass?: cloudfront.PriceClass,
  ): cloudfront.Distribution {
    return new cloudfront.Distribution(this, 'Distribution', {
      certificate,
      priceClass: priceClass ?? cloudfront.PriceClass.PRICE_CLASS_100,
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
        origin,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: functionAssociation ? [functionAssociation] : undefined,
      },
    })
  }

  private createSubdomainRecords(
    distribution: cloudfront.Distribution,
    zone?: route53.IHostedZone,
    domain?: string,
  ): void {
    if (domain && zone) {
      const [subdomain] = domain.split('.');
      new route53.ARecord(this, 'ARecord', {
        zone: zone,
        recordName: subdomain,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });

      new route53.AaaaRecord(this, "AliasRecord", {
        zone: zone,
        recordName: subdomain,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }
  }

  private createOutput(distribution: cloudfront.Distribution, bucket: s3.Bucket, domain?: string): void {
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
