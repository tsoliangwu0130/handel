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
import * as fs from 'fs';
import * as _ from 'lodash';
import * as tmp from 'tmp';
import * as uuid from 'uuid';
import * as winston from 'winston';
import * as deployPhaseCommon from '../../../common/deploy-phase-common';
import * as handlebarsUtils from '../../../common/handlebars-utils';
import {getTags} from '../../../common/tagging-common';
import * as util from '../../../common/util';
import {AccountConfig, DeployContext, PreDeployContext, ServiceConfig, ServiceContext, Tags} from '../../../datatypes';
import * as apigatewayCommon from '../common';
import {APIGatewayConfig} from '../config-types';

const VALID_METHOD_NAMES = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch'
];

function loadSwaggerFile(ownServiceContext: ServiceContext<APIGatewayConfig>): any {
    const pathToSwagger = ownServiceContext.params.swagger!; // We know the Swagger param exists here because of the check phase
    try {
        const swaggerFileStats = fs.lstatSync(pathToSwagger);
        let swaggerContents;
        if (swaggerFileStats.isDirectory()) { // Look for swagger.json
            const yamlPath = `${pathToSwagger}/swagger.yml`;
            const jsonPath = `${pathToSwagger}/swagger.json`;
            if (fs.existsSync(yamlPath)) {
                swaggerContents = util.readYamlFileSync(yamlPath);
            }
            else if (fs.existsSync(jsonPath)) {
                swaggerContents = util.readJsonFileSync(jsonPath);
            }
        }
        else { // Just load file directly
            if (pathToSwagger.endsWith('.yml') || pathToSwagger.endsWith('.yaml')) {
                swaggerContents = util.readYamlFileSync(pathToSwagger);
            }
            else {
                swaggerContents = util.readJsonFileSync(pathToSwagger);
            }
        }

        if (!swaggerContents) {
            throw new Error(`Couldn't read swagger file from '${pathToSwagger}'`);
        }
        return swaggerContents;
    }
    catch (e) {
        throw new Error(`Couldn't read swagger file from '${pathToSwagger}'`);
    }
}

function getLambdasToCreate(stackName: string, swagger: any, ownServiceContext: ServiceContext<APIGatewayConfig>, dependenciesDeployContexts: DeployContext[]) {
    const functionConfigs = [];
    const lambdaDefinitions = swagger['x-lambda-functions'];
    for (const functionName in lambdaDefinitions) {
        if (lambdaDefinitions.hasOwnProperty(functionName)) {
            const functionDef = lambdaDefinitions[functionName];
            functionConfigs.push({
                name: functionName,
                provisionedMemory: functionDef.memory || '128',
                timeout: functionDef.timeout || '5',
                handler: functionDef.handler,
                runtime: functionDef.runtime,
                pathToArtifact: functionDef.path_to_code,
                environmentVariables: apigatewayCommon.getEnvVarsForService(functionDef.environment_variables, ownServiceContext, dependenciesDeployContexts)
            });
        }
    }
    return functionConfigs;
}

function getCompiledApiGatewayTemplate(stackName: string, ownServiceContext: ServiceContext<APIGatewayConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[], lambdasToCreate: any[], swaggerS3ArtifactInfo: AWS.S3.ManagedUpload.SendData, stackTags: Tags): Promise<string> {
    const params = ownServiceContext.params;
    const accountConfig = ownServiceContext.accountConfig;

    const handlebarsParams: any = {
        stageName: ownServiceContext.environmentName,
        lambdasToCreate,
        swaggerS3ArtifactInfo,
        apiName: stackName,
        description: params.description || `Handel-created API for ${stackName}`,
        policyStatements: apigatewayCommon.getPolicyStatementsForLambdaRole(ownServiceContext, dependenciesDeployContexts),
        tags: stackTags,
        deploymentIdSuffix: Math.floor(Math.random() * 10000) // This is required because CF won't update an API deployment unless the resource has a different name
    };

    // Add binary media types if specified
    const binaryMediaTypes = params.binary_media_types;
    if (binaryMediaTypes) {
        handlebarsParams.binaryMediaTypes = [];
        for (const type of binaryMediaTypes) {
            handlebarsParams.binaryMediaTypes.push(type.replace('/', '~1'));
        }
    }

    if (params.vpc) {
        handlebarsParams.vpc = true;
        handlebarsParams.vpcSecurityGroupIds = apigatewayCommon.getSecurityGroups(ownPreDeployContext);
        handlebarsParams.vpcSubnetIds = accountConfig.private_subnets;
    }

    return handlebarsUtils.compileTemplate(`${__dirname}/apigateway-swagger-template.yml`, handlebarsParams);
}

function getHttpPassthroughPathParamsMapping(pathParams: any) {
    const mappedParams: any = {};
    for (const origParam in pathParams) {
        if (pathParams.hasOwnProperty(origParam)) {
            const httpPassthroughParam = pathParams[origParam];
            mappedParams[`integration.request.path.${origParam}`] = `method.request.path.${httpPassthroughParam}`;
        }
    }
    return mappedParams;
}

function isMethodDef(methodName: string) {
    if (VALID_METHOD_NAMES.includes(methodName)) {
        return true;
    }
    else {
        return false;
    }
}

function enrichSwagger(stackName: string, originalSwagger: any, accountConfig: AccountConfig) {
    const enrichedSwagger = _.cloneDeep(originalSwagger);

    const paths = enrichedSwagger.paths;
    for (const pathName in paths) {
        if (paths.hasOwnProperty(pathName)) {
            const path = paths[pathName];
            for (const methodName in path) {
                if (!isMethodDef(methodName)) { continue; }

                const method = path[methodName];
                const requestedFunction = method['x-lambda-function'];
                const httpPassthroughUrl = method['x-http-passthrough-url'] || path['x-http-passthrough-url']; // Support it either at the method or path level. Path level configures it for all methods
                if (requestedFunction) { // User wants to use a Lambda function handler
                    if (!enrichedSwagger['x-lambda-functions'][requestedFunction]) {
                        throw new Error(`Lambda function referenced in one of your paths but not defined in 'x-lambda-functions': '${requestedFunction}'`);
                    }
                    const fullFunctionName = `${stackName}-${requestedFunction}`;
                    const functionArn = `arn:aws:lambda:${accountConfig.region}:${accountConfig.account_id}:function:${fullFunctionName}`;
                    const functionUri = `arn:aws:apigateway:${accountConfig.region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`;

                    const apiGatewayIntegration = method['x-amazon-apigateway-integration'];
                    if (apiGatewayIntegration) { // User already provided their own integration configuration, so we'll just enrich it with Lambda info
                        apiGatewayIntegration.type = 'aws';
                        apiGatewayIntegration.uri = functionUri;
                        apiGatewayIntegration.httpMethod = 'POST';
                        if (!apiGatewayIntegration.passthroughBehavior) { // Only provide this if the user hasn't specified their own
                            apiGatewayIntegration.passthroughBehavior = 'when_no_match';
                        }
                    }
                    else { // User hasn't already specified integration config, so we'll just use Lambda proxy
                        method['x-amazon-apigateway-integration'] = {
                            uri: functionUri,
                            passthroughBehavior: 'when_no_match',
                            httpMethod: 'POST',
                            type: 'aws_proxy'
                        };
                    }
                }
                else if (httpPassthroughUrl) { // User wants to use HTTP passthrough
                    method['x-amazon-apigateway-integration'] = {
                        uri: httpPassthroughUrl,
                        passthroughBehavior: 'when_no_match',
                        httpMethod: methodName.toUpperCase(),
                        type: 'http_proxy'
                    };

                    const pathParamsMapping = method['x-http-passthrough-path-params'] || path['x-http-passthrough-path-params']; // Support it either at the method or path level. Path level configures it for all methods
                    if (pathParamsMapping) {
                        method['x-amazon-apigateway-integration'].requestParameters = getHttpPassthroughPathParamsMapping(pathParamsMapping);
                    }
                }
            }
        }
    }

    return enrichedSwagger;
}

async function uploadSwaggerToS3(ownServiceContext: ServiceContext<APIGatewayConfig>, enrichedSwagger: any): Promise<AWS.S3.ManagedUpload.SendData> {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const swaggerFilePath = `${tmpDir.name}/swagger.json`;
    fs.writeFileSync(swaggerFilePath, JSON.stringify(enrichedSwagger), 'utf-8');
    const s3FileName = `apigateway-deployable-swagger-${uuid()}.zip`;
    const s3ArtifactInfo = await deployPhaseCommon.uploadDeployableArtifactToHandelBucket(ownServiceContext, swaggerFilePath, s3FileName);
    tmpDir.removeCallback();
    return s3ArtifactInfo;
}

function uploadDeployableArtifactsToS3(ownServiceContext: ServiceContext<APIGatewayConfig>, lambdasToCreate: any[], serviceName: string, enrichedSwagger: any) {
    const uploadPromises = [];

    for (const lambdaConfig of lambdasToCreate) {
        const s3FileName = `apigateway-deployable-${lambdaConfig.name}-${uuid()}.json`;
        winston.info(`${serviceName} - Uploading deployable artifact to S3: ${s3FileName}`);
        const pathToArtifact = lambdaConfig.pathToArtifact;
        const uploadPromise = deployPhaseCommon.uploadDeployableArtifactToHandelBucket(ownServiceContext, pathToArtifact, s3FileName)
            .then(s3ArtifactInfo => {
                winston.info(`${serviceName} - Uploaded deployable artifact to S3: ${s3FileName}`);
                lambdaConfig.s3ArtifactInfo = s3ArtifactInfo;
            });
        uploadPromises.push(uploadPromise);
    }

    return Promise.all(uploadPromises)
        .then(() => {
            return lambdasToCreate; // This is built-up dynamically above
        });
}

export function check(ownServiceContext: ServiceContext<APIGatewayConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>, serviceName: string): string[] {
    const checkErrors: string[] = [];

    // TODO - Probably parse Swagger file and check it if we get troubles

    return checkErrors;
}

export async function deploy(stackName: string, ownServiceContext: ServiceContext<APIGatewayConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[], serviceName: string) {
    const swagger = loadSwaggerFile(ownServiceContext);
    let lambdasToCreate = getLambdasToCreate(stackName, swagger, ownServiceContext, dependenciesDeployContexts);
    const stackTags = getTags(ownServiceContext);
    const enrichedSwagger = enrichSwagger(stackName, swagger, ownServiceContext.accountConfig);

    lambdasToCreate = await uploadDeployableArtifactsToS3(ownServiceContext, lambdasToCreate, serviceName, enrichedSwagger);
    const swaggerS3ArtifactInfo = await uploadSwaggerToS3(ownServiceContext, enrichedSwagger);
    const compiledTemplate = await getCompiledApiGatewayTemplate(stackName, ownServiceContext, ownPreDeployContext, dependenciesDeployContexts, lambdasToCreate, swaggerS3ArtifactInfo, stackTags);
    const deployedStack = await deployPhaseCommon.deployCloudFormationStack(stackName, compiledTemplate, [], true, serviceName, stackTags);
    const restApiUrl = apigatewayCommon.getRestApiUrl(deployedStack, ownServiceContext);
    winston.info(`${serviceName} - Finished deploying API Gateway service. The service is available at ${restApiUrl}`);
    return new DeployContext(ownServiceContext);
}