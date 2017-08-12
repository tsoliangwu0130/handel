/*
 * Copyright 2017 Brigham Young University
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
const winston = require('winston');
const DeployContext = require('../../datatypes/deploy-context');
const ec2Calls = require('../../aws/ec2-calls');
const deployPhaseCommon = require('../../common/deploy-phase-common');
const preDeployPhaseCommon = require('../../common/pre-deploy-phase-common');
const bindPhaseCommon = require('../../common/bind-phase-common');
const deletePhasesCommon = require('../../common/delete-phases-common');
const handlebarsUtils = require('../../common/handlebars-utils');
const accountConfig = require('../../common/account-config')().getAccountConfig();
const util = require('../../common/util');
const uuid = require('uuid');

const SERVICE_NAME = "CodeDeploy";

function getDeployContext(serviceContext, deployedStack) {
    let deployContext = new DeployContext(serviceContext);

    //Currently empty

    return deployContext;
}

function getRoleStatements(ownServiceContext, dependenciesDeployContexts) {
    let ownPolicyStatements = deployPhaseCommon.getAppSecretsAccessPolicyStatements(ownServiceContext);
    return deployPhaseCommon.getAllPolicyStatementsForServiceRole(ownPolicyStatements, dependenciesDeployContexts);
}

function getAmiFromPrefix(amiPrefix) {
    if (amiPrefix) { //Allow them to specify their own AMI
        return ec2Calls.getLatestAmiByName(accountConfig.account_id, amiPrefix);
    }
    else { //Else just use the AWS AMI
        return ec2Calls.getLatestAmiByName('amazon', 'amzn-ami-hvm');
    }
}

function getCompiledCodeDeployTemplate(stackName, ownServiceContext, ownPreDeployContext, dependenciesDeployContexts, stackTags, userDataScript, serviceRole, s3ArtifactInfo) {
    let params = ownServiceContext.params;

    return getAmiFromPrefix(params.ami_prefix)
        .then(amiImageId => {
            let handlebarsParams = {
                appName: stackName,
                policyStatements: getRoleStatements(ownServiceContext, dependenciesDeployContexts),
                amiImageId,
                instanceType: params.instance_type || 't2.micro',
                securityGroupId: ownPreDeployContext.securityGroups[0].GroupId,
                userData: new Buffer(userDataScript).toString('base64'),
                asgCooldown: "300", //TODO - Change this when scaling is implemented
                minInstances: params.auto_scaling.min_instances,
                maxInstances: params.auto_scaling.max_instances,
                tags: stackTags,
                privateSubnetIds: accountConfig.private_subnets,
                s3BucketName: s3ArtifactInfo.Bucket,
                s3KeyName: s3ArtifactInfo.Key,
                deploymentConfigName: "CodeDeployDefault.OneAtATime", //TODO - Add support for multiple kinds later
                serviceRoleArn: serviceRole.Arn
            };

            //Add ssh key name if present
            if (params.key_name) {
                handlebarsParams.sshKeyName = params.key_name;
            }

            return handlebarsUtils.compileTemplate(`${__dirname}/codedeploy-template.yml`, handlebarsParams);
        });
}

function createCodeDeployServiceRoleIfNotExists() {
    let policyStatements = JSON.parse(util.readFileSync(`${__dirname}/codedeploy-service-role-statements.json`));
    return deployPhaseCommon.createCustomRole('codedeploy.amazonaws.com', 'HandelCodeDeployServiceRole', policyStatements);

}

function getUserDataScript(ownServiceContext, dependenciesDeployContexts) {
    let params = ownServiceContext.params;

    let variables = {
        dependencyScripts: []
    };

    //Add CodeDeploy agent install script if not using custom AMI
    if (!params.ami_prefix) {
        variables.codeDeployInstallScript = util.readFileSync(`${__dirname}/codedeploy-agent-install-fragment.sh`);
    }

    //Add scripts from dependencies
    for (let deployContext of dependenciesDeployContexts) {
        for (let script of deployContext.scripts) {
            variables.dependencyScripts.push(script);
        }
    }

    return handlebarsUtils.compileTemplate(`${__dirname}/codedeploy-instance-userdata-template.sh`, variables);
}

function uploadDeployableArtifactToS3(serviceContext) {
    let s3FileName = `codedeploy-deployable-${uuid()}.zip`;
    winston.info(`${SERVICE_NAME} - Uploading deployable artifact to S3: ${s3FileName}`);
    return deployPhaseCommon.uploadDeployableArtifactToHandelBucket(serviceContext, s3FileName)
        .then(s3ArtifactInfo => {
            winston.info(`${SERVICE_NAME} - Uploaded deployable artifact to S3: ${s3FileName}`);
            return s3ArtifactInfo;
        });
}


/**
 * Service Deployer Contract Methods
 * See https://github.com/byu-oit-appdev/handel/wiki/Creating-a-New-Service-Deployer#service-deployer-contract
 *   for contract method documentation
 */

exports.check = function (serviceContext) {
    let errors = [];
    let serviceParams = serviceContext.params;

    return errors;
}

exports.preDeploy = function (serviceContext) {
    return preDeployPhaseCommon.preDeployCreateSecurityGroup(serviceContext, 22, SERVICE_NAME);
}

exports.bind = function (ownServiceContext, ownPreDeployContext, dependentOfServiceContext, dependentOfPreDeployContext) {
    return bindPhaseCommon.bindNotRequired(ownServiceContext, dependentOfServiceContext, SERVICE_NAME);
}

exports.deploy = function (ownServiceContext, ownPreDeployContext, dependenciesDeployContexts) {
    let stackName = deployPhaseCommon.getResourceName(ownServiceContext);
    winston.info(`${SERVICE_NAME} - Deploying application '${stackName}'`);

    let stackTags = deployPhaseCommon.getTags(ownServiceContext);
    return createCodeDeployServiceRoleIfNotExists()
        .then(serviceRole => {
            return getUserDataScript(ownServiceContext, dependenciesDeployContexts)
                .then(userDataScript => {
                    return uploadDeployableArtifactToS3(ownServiceContext)
                        .then(s3ArtifactInfo => {
                            return getCompiledCodeDeployTemplate(stackName, ownServiceContext, ownPreDeployContext, dependenciesDeployContexts, stackTags, userDataScript, serviceRole, s3ArtifactInfo)
                        });
                });
        })
        .then(codeDeployTemplate => {
            console.log(codeDeployTemplate);
            process.exit(0);
            return deployPhaseCommon.deployCloudFormationStack(stackName, codeDeployTemplate, [], true, SERVICE_NAME, stackTags);
        })
        .then(deployedStack => {
            winston.info(`${SERVICE_NAME} - Finished deploying application '${stackName}'`);
            return getDeployContext(ownServiceContext, deployedStack);
        });
}

exports.consumeEvents = function (ownServiceContext, ownDeployContext, producerServiceContext, producerDeployContext) {
    return Promise.reject(new Error(`The ${SERVICE_NAME} service doesn't consume events from other services`));
}

exports.produceEvents = function (ownServiceContext, ownDeployContext, consumerServiceContext, consumerDeployContext) {
    return Promise.reject(new Error(`The ${SERVICE_NAME} service doesn't produce events to other services`));
}

exports.unPreDeploy = function (ownServiceContext) {
    return deletePhasesCommon.unPreDeploySecurityGroup(ownServiceContext, SERVICE_NAME);
}

exports.unBind = function (ownServiceContext) {
    return deletePhasesCommon.unBindNotRequired(ownServiceContext, SERVICE_NAME);
}

exports.unDeploy = function (ownServiceContext) {
    return deletePhasesCommon.unDeployCloudFormationStack(ownServiceContext, SERVICE_NAME);
}

exports.producedEventsSupportedServices = [];

exports.producedDeployOutputTypes = [];

exports.consumedDeployOutputTypes = [
    'environmentVariables',
    'scripts',
    'policies',
    'credentials',
    'securityGroups'
];
