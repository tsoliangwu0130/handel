/*
 * Copyright 2018 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * This module exists because I haven't yet been able to figure out a way
 * to mock the AWS SDK when using Sinon and TypeScript. The 'aws-sdk-mock'
 * tool doesn't work in TypeScript, and I have yet to find out how to use
 * Sinon to mock the SDK when using promises.
 */

import * as AWS from 'aws-sdk';
import { AWSError } from 'aws-sdk/lib/error';

const awsWrapper = {
    cloudFormation: {
        describeStacks: (params: AWS.CloudFormation.DescribeStacksInput): Promise<AWS.CloudFormation.DescribeStacksOutput> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.describeStacks(params).promise();
        },
        waitFor: (stackState: any, params: AWS.CloudFormation.DescribeStacksInput): Promise<AWS.CloudFormation.DescribeStacksOutput> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.waitFor(stackState, params).promise();
        },
        createStack: (params: AWS.CloudFormation.CreateStackInput): Promise<AWS.CloudFormation.CreateStackOutput> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.createStack(params).promise();
        },
        deleteStack: (params: AWS.CloudFormation.DeleteStackInput): Promise<any> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.deleteStack(params).promise();
        },
        describeStackEvents: (params: AWS.CloudFormation.DescribeStackEventsInput): Promise<AWS.CloudFormation.DescribeStackEventsOutput> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.describeStackEvents(params).promise();
        },
        updateStack: (params: AWS.CloudFormation.UpdateStackInput): Promise<AWS.CloudFormation.UpdateStackOutput> => {
            const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
            return cloudformation.updateStack(params).promise();
        }
    },
    iam: {
        createRole: (params: AWS.IAM.CreateRoleRequest): Promise<AWS.IAM.CreateRoleResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.createRole(params).promise();
        },
        getRole: (params: AWS.IAM.GetRoleRequest): Promise<AWS.IAM.GetRoleResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.getRole(params).promise();
        },
        attachRolePolicy: (params: AWS.IAM.AttachRolePolicyRequest): Promise<any> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.attachRolePolicy(params).promise();
        },
        getPolicy: (params: AWS.IAM.GetPolicyRequest): Promise<AWS.IAM.GetPolicyResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.getPolicy(params).promise();
        },
        createPolicy: (params: AWS.IAM.CreatePolicyRequest): Promise<AWS.IAM.CreatePolicyResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.createPolicy(params).promise();
        },
        createPolicyVersion: (params: AWS.IAM.CreatePolicyVersionRequest): Promise<AWS.IAM.CreatePolicyVersionResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.createPolicyVersion(params).promise();
        },
        listPolicyVersions: (params: AWS.IAM.ListPolicyVersionsRequest): Promise<AWS.IAM.ListPolicyVersionsResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.listPolicyVersions(params).promise();
        },
        deletePolicyVersion: (params: AWS.IAM.DeletePolicyVersionRequest): Promise<any> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.deletePolicyVersion(params).promise();
        },
        listAttachedRolePolicies: (params: AWS.IAM.ListAttachedRolePoliciesRequest): Promise<AWS.IAM.ListAttachedRolePoliciesResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.listAttachedRolePolicies(params).promise();
        },
        listRoles: (params: AWS.IAM.ListRolesRequest): Promise<AWS.IAM.ListRolesResponse> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.listRoles(params).promise();
        },
        deleteRole: (params: AWS.IAM.DeleteRoleRequest): Promise<any> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.deleteRole(params).promise();
        },
        deletePolicy: (params: AWS.IAM.DeletePolicyRequest): Promise<any> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.deletePolicy(params).promise();
        },
        detachRolePolicy: (params: AWS.IAM.DetachRolePolicyRequest): Promise<any> => {
            const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            return iam.detachRolePolicy(params).promise();
        }
    },
    s3: {
        upload: (params: AWS.S3.PutObjectRequest): Promise<AWS.S3.ManagedUpload.SendData> => {
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            return  s3.upload(params).promise();
        },
        listBuckets: (): Promise<AWS.S3.ListBucketsOutput> => {
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            return s3.listBuckets().promise();
        },
        createBucket: (params: AWS.S3.CreateBucketRequest): Promise<AWS.S3.CreateBucketOutput> => {
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            return s3.createBucket(params).promise();
        },
        listObjectsV2: (params: AWS.S3.ListObjectsV2Request): Promise<AWS.S3.ListObjectsV2Output> => {
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            return s3.listObjectsV2(params).promise();
        },
        deleteObjects: (params: AWS.S3.DeleteObjectsRequest): Promise<AWS.S3.DeleteObjectsOutput> => {
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            return s3.deleteObjects(params).promise();
        }
    },
    ssm: {
        putParameter: (params: AWS.SSM.PutParameterRequest): Promise<AWS.SSM.PutParameterResult> => {
            const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });
            return ssm.putParameter(params).promise();
        },
        deleteParameter: (params: AWS.SSM.DeleteParameterRequest): Promise<AWS.SSM.DeleteParameterResult> => {
            const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });
            return ssm.deleteParameter(params).promise();
        },
        deleteParameters: (params: AWS.SSM.DeleteParametersRequest): Promise<AWS.SSM.DeleteParametersResult> => {
            const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });
            return ssm.deleteParameters(params).promise();
        }
    },
    ses: {
        getIdentityVerificationAttributes: (params: AWS.SES.GetIdentityVerificationAttributesRequest): Promise<AWS.SES.GetIdentityVerificationAttributesResponse> => {
            const ses = new AWS.SES({ apiVersion: '2010-12-01' });
            return ses.getIdentityVerificationAttributes(params).promise();
        },
        verifyEmailAddress: (params: AWS.SES.VerifyEmailAddressRequest): Promise<any> => {
            const ses = new AWS.SES({ apiVersion: '2010-12-01' });
            return ses.verifyEmailAddress(params).promise();
        }
    },
    ec2: {
        describeSecurityGroups: (params: AWS.EC2.DescribeSecurityGroupsRequest): Promise<AWS.EC2.DescribeSecurityGroupsResult> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.describeSecurityGroups(params).promise();
        },
        revokeSecurityGroupIngress: (params: AWS.EC2.RevokeSecurityGroupIngressRequest): Promise<any> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.revokeSecurityGroupIngress(params).promise();
        },
        authorizeSecurityGroupIngress: (params: AWS.EC2.AuthorizeSecurityGroupIngressRequest): Promise<any> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.authorizeSecurityGroupIngress(params).promise();
        },
        describeImages: (params: AWS.EC2.DescribeImagesRequest): Promise<AWS.EC2.DescribeImagesResult> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.describeImages(params).promise();
        },
        describeRegions: (params: AWS.EC2.DescribeRegionsRequest): Promise<AWS.EC2.DescribeRegionsResult> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.describeRegions(params).promise();
        },
        describeSubnets: (params: AWS.EC2.DescribeSubnetsRequest): Promise<AWS.EC2.DescribeSubnetsResult> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.describeSubnets(params).promise();
        },
        describeVpcs: (params: AWS.EC2.DescribeVpcsRequest): Promise<AWS.EC2.DescribeVpcsResult> => {
            const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
            return ec2.describeVpcs(params).promise();
        }
    },
    sts: {
        getCallerIdentity: (params: AWS.STS.GetCallerIdentityRequest): Promise<AWS.STS.GetCallerIdentityResponse> => {
            const sts = new AWS.STS({apiVersion: '2011-06-15'});
            return sts.getCallerIdentity(params).promise();
        }
    },
    autoScaling: {
        terminateInstanceInAutoScalingGroup: (params: any): Promise<AWS.AutoScaling.ActivityType> => {
            const autoScaling = new AWS.AutoScaling({ apiVersion: '2011-01-01' });
            return autoScaling.terminateInstanceInAutoScalingGroup(params).promise();
        },
        describeAutoScalingInstances: (params: any): Promise<AWS.AutoScaling.AutoScalingInstancesType> => {
            const autoScaling = new AWS.AutoScaling({ apiVersion: '2011-01-01' });
            return autoScaling.describeAutoScalingInstances(params).promise();
        },
        describeLaunchConfigurations: (params: any): Promise<AWS.AutoScaling.LaunchConfigurationsType> => {
            const autoScaling = new AWS.AutoScaling({ apiVersion: '2011-01-01' });
            return autoScaling.describeLaunchConfigurations(params).promise();
        }
    },
    ecs: {
        describeClusters: (params: AWS.ECS.DescribeClustersRequest): Promise<AWS.ECS.DescribeClustersResponse> => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.describeClusters(params).promise();
        },
        createCluster: (params: AWS.ECS.CreateClusterRequest): Promise<AWS.ECS.CreateClusterResponse> => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.createCluster(params).promise();
        },
        listContainerInstances: (params: AWS.ECS.ListContainerInstancesRequest): Promise<AWS.ECS.ListContainerInstancesResponse> => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.listContainerInstances(params).promise();
        },
        describeContainerInstances: (params: AWS.ECS.DescribeContainerInstancesRequest): Promise<AWS.ECS.DescribeContainerInstancesResponse> => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.describeContainerInstances(params).promise();
        }
    },
    cloudWatchEvents: {
        putTargets: (params: AWS.CloudWatchEvents.PutTargetsRequest): Promise<AWS.CloudWatchEvents.PutTargetsResponse> => {
            const cloudWatchEvents = new AWS.CloudWatchEvents({ apiVersion: '2015-10-07' });
            return cloudWatchEvents.putTargets(params).promise();
        },
        listTargetsByRule: (params: AWS.CloudWatchEvents.ListTargetsByRuleRequest): Promise<AWS.CloudWatchEvents.ListTargetsByRuleResponse> => {
            const cloudWatchEvents = new AWS.CloudWatchEvents({ apiVersion: '2015-10-07' });
            return cloudWatchEvents.listTargetsByRule(params).promise();
        },
        listRules: (params: any): Promise<AWS.CloudWatchEvents.ListRulesResponse> => {
            const cloudWatchEvents = new AWS.CloudWatchEvents({ apiVersion: '2015-10-07' });
            return cloudWatchEvents.listRules(params).promise();
        },
        removeTargets: (params: AWS.CloudWatchEvents.RemoveTargetsRequest): Promise<AWS.CloudWatchEvents.RemoveTargetsResponse> => {
            const cloudWatchEvents = new AWS.CloudWatchEvents({ apiVersion: '2015-10-07' });
            return cloudWatchEvents.removeTargets(params).promise();
        }
    },
    lambda: {
        addPermission: (params: AWS.Lambda.AddPermissionRequest): Promise<AWS.Lambda.AddPermissionResponse> => {
            const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            return lambda.addPermission(params).promise();
        },
        getPolicy: (params: AWS.Lambda.GetPolicyRequest): Promise<AWS.Lambda.GetPolicyResponse> => {
            const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            return lambda.getPolicy(params).promise();
        },
        createEventSourceMapping: (params: AWS.Lambda.CreateEventSourceMappingRequest): Promise<AWS.Lambda.EventSourceMappingConfiguration> => {
            const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            return lambda.createEventSourceMapping(params).promise();
        }
    },
    route53: {
        listHostedZones: (params: AWS.Route53.ListHostedZonesRequest): Promise<AWS.Route53.ListHostedZonesResponse> => {
            const route53 = new AWS.Route53({apiVersion: '2013-04-01'});
            return route53.listHostedZones(params).promise();
        }
    },
    sqs: {
        getQueueAttributes: (params: AWS.SQS.GetQueueAttributesRequest): Promise<AWS.SQS.GetQueueAttributesResult> => {
            const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
            return sqs.getQueueAttributes(params).promise();
        },
        setQueueAttributes: (params: AWS.SQS.SetQueueAttributesRequest): Promise<any> => {
            const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
            return sqs.setQueueAttributes(params).promise();
        }
    },
    sns: {
        getTopicAttributes: (params: AWS.SNS.GetTopicAttributesInput): Promise<AWS.SNS.GetTopicAttributesResponse> => {
            const sns = new AWS.SNS({apiVersion: '2010-03-31'});
            return sns.getTopicAttributes(params).promise();
        },
        setTopicAttributes: (params: AWS.SNS.SetTopicAttributesInput): Promise<any> => {
            const sns = new AWS.SNS({apiVersion: '2010-03-31'});
            return sns.setTopicAttributes(params).promise();
        },
        subscribe: (params: AWS.SNS.SubscribeInput): Promise<AWS.SNS.SubscribeResponse> => {
            const sns = new AWS.SNS({apiVersion: '2010-03-31'});
            return sns.subscribe(params).promise();
        }
    }
};

export default awsWrapper;
