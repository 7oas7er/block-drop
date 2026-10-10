import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

// This repository was created after GitHub made OIDC subjects immutable, so the
// claim includes the owner id (2952810) and repository id (1407099747).
const githubActionsSubject =
  'repo:7oas7er@2952810/block-drop@1407099747:ref:refs/heads/main';

export class BlockDropStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Block Drop static site',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
    });

    // The site publish deletes objects that are not part of the game files,
    // so the table has its own bucket.
    const highScoreBucket = new s3.Bucket(this, 'HighScoreBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const highScoreFunction = new lambda.Function(this, 'HighScoreFunction', {
      description: 'Reads and writes the Block Drop high score table.',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'high-scores.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
        exclude: ['*.test.js'],
      }),
      timeout: cdk.Duration.seconds(8),
      memorySize: 128,
      environment: {
        SCORES_BUCKET: highScoreBucket.bucketName,
        SCORES_KEY: 'high-scores.json',
      },
    });

    highScoreBucket.grantRead(highScoreFunction);
    highScoreBucket.grantPut(highScoreFunction);

    const highScoreUrl = highScoreFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    distribution.addBehavior('/api/scores', origins.FunctionUrlOrigin.withOriginAccessControl(highScoreUrl), {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      compress: true,
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../block-drop'), {
          exclude: ['README.md', '.DS_Store', '**/.DS_Store'],
        }),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const githubOidc = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'block-drop-github-deploy',
      description: 'GitHub Actions on main publishes Block Drop and invalidates CloudFront.',
      assumedBy: new iam.SessionTagsPrincipal(
        new iam.OpenIdConnectPrincipal(githubOidc, {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': githubActionsSubject,
          },
        }),
      ),
    });

    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'LocateAndListSiteBucket',
      actions: ['s3:GetBucketLocation', 's3:ListBucket'],
      resources: [siteBucket.bucketArn],
    }));

    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SyncSiteObjects',
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [siteBucket.arnForObjects('*')],
    }));

    distribution.grantCreateInvalidation(deployRole);

    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ReadSiteStackOutputs',
      actions: ['cloudformation:DescribeStacks'],
      resources: [this.stackId],
    }));

    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Store this in the GitHub repository variable AWS_DEPLOY_ROLE_ARN.',
    });

    new cdk.CfnOutput(this, 'DeployRegion', {
      value: this.region,
      description: 'Store this in the GitHub repository variable AWS_REGION.',
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'HTTPS URL for Block Drop',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName,
      description: 'Private bucket that stores the site files',
    });

    new cdk.CfnOutput(this, 'HighScoreBucketName', {
      value: highScoreBucket.bucketName,
      description: 'Private bucket that stores the high score table',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution that serves the site',
    });
  }
}
