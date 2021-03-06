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
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import config from '../../../src/account-config/account-config';
import * as bindPhaseCommon from '../../../src/common/bind-phase-common';
import * as deletePhasesCommon from '../../../src/common/delete-phases-common';
import * as deployPhaseCommon from '../../../src/common/deploy-phase-common';
import * as preDeployPhaseCommon from '../../../src/common/pre-deploy-phase-common';
import { AccountConfig, BindContext, DeployContext, PreDeployContext, ServiceContext, UnBindContext, UnDeployContext, UnPreDeployContext } from '../../../src/datatypes';
import * as redis from '../../../src/services/redis';
import { RedisServiceConfig } from '../../../src/services/redis/config-types';

describe('redis deployer', () => {
    let sandbox: sinon.SinonSandbox;
    const appName = 'FakeApp';
    const envName = 'FakeEnv';
    let serviceContext: ServiceContext<RedisServiceConfig>;
    let serviceParams: RedisServiceConfig;
    let accountConfig: AccountConfig;

    beforeEach(async () => {
        accountConfig = await config(`${__dirname}/../../test-account-config.yml`);
        sandbox = sinon.sandbox.create();
        serviceParams = {
            type: 'redis',
            redis_version: '3.2.4',
            instance_type: 'cache.t2.micro'
        };
        serviceContext = new ServiceContext(appName, envName, 'FakeService', 'redis', serviceParams, accountConfig);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('check', () => {
        it('should do require the instance_type parameter', () => {
            delete serviceContext.params.instance_type;
            const errors = redis.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`'instance_type' parameter is required`);
        });

        it('should require the redis_version parameter', () => {
            delete serviceContext.params.redis_version;
            const errors = redis.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`'redis_version' parameter is required`);
        });

        it('should fail if the read_replicas parameter is not between 0-5', () => {
            serviceContext.params.instance_type = 'cache.m3.medium';
            serviceContext.params.read_replicas = 6;
            const errors = redis.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`'read_replicas' parameter may only have a value of 0-5`);
        });

        it('should fail if the instance_type is a t* class when using replication', () => {
            serviceContext.params.read_replicas = 5;
            serviceContext.params.instance_type = 'cache.t2.micro';
            const errors = redis.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`You may not use the 't1' and 't2' instance types when using any read replicas`);
        });

        it('should work when all parameters are provided properly', () => {
            const errors = redis.check(serviceContext, []);
            expect(errors.length).to.equal(0);
        });
    });

    describe('preDeploy', () => {
        it('should create a security group', async () => {
            const groupId = 'FakeSgGroupId';
            const preDeployContext = new PreDeployContext(serviceContext);
            preDeployContext.securityGroups.push({
                GroupId: groupId
            });
            const preDeployCreateSgStub = sandbox.stub(preDeployPhaseCommon, 'preDeployCreateSecurityGroup').resolves(preDeployContext);

            const retContext = await redis.preDeploy(serviceContext);
            expect(retContext).to.be.instanceof(PreDeployContext);
            expect(retContext.securityGroups.length).to.equal(1);
            expect(retContext.securityGroups[0].GroupId).to.equal(groupId);
            expect(preDeployCreateSgStub.callCount).to.equal(1);
        });
    });

    describe('bind', () => {
        it('should add the source sg to its own sg as an ingress rule', async () => {
            const dependentOfServiceContext = new ServiceContext(appName, envName, 'DependentOfService', 'ecs', { type: 'ecs' }, accountConfig);
            const bindSgStub = sandbox.stub(bindPhaseCommon, 'bindDependentSecurityGroupToSelf').resolves(new BindContext(serviceContext, dependentOfServiceContext));

            const bindContext = await redis.bind(serviceContext, new PreDeployContext(serviceContext), dependentOfServiceContext, new PreDeployContext(dependentOfServiceContext));
            expect(bindContext).to.be.instanceof(BindContext);
            expect(bindSgStub.callCount).to.equal(1);
        });
    });

    describe('deploy', () => {
        it('should deploy the cluster', async () => {
            const ownPreDeployContext = new PreDeployContext(serviceContext);
            ownPreDeployContext.securityGroups.push({
                GroupId: 'FakeId'
            });
            const dependenciesDeployContexts: DeployContext[] = [];

            const cacheAddress = 'fakeaddress.byu.edu';
            const cachePort = 6379;
            const envPrefix = 'FAKESERVICE';

            const deployStackStub = sandbox.stub(deployPhaseCommon, 'deployCloudFormationStack').resolves({
                Outputs: [
                    {
                        OutputKey: 'CacheAddress',
                        OutputValue: cacheAddress
                    },
                    {
                        OutputKey: 'CachePort',
                        OutputValue: cachePort
                    }
                ]
            });

            const deployContext = await redis.deploy(serviceContext, ownPreDeployContext, dependenciesDeployContexts);
            expect(deployStackStub.callCount).to.equal(1);
            expect(deployContext).to.be.instanceof(DeployContext);
            expect(deployContext.environmentVariables[`${envPrefix}_ADDRESS`]).to.equal(cacheAddress);
            expect(deployContext.environmentVariables[`${envPrefix}_PORT`]).to.equal(cachePort);
        });
    });

    describe('unPreDeploy', () => {
        it('should delete the security group', async () => {
            const unPreDeployStub = sandbox.stub(deletePhasesCommon, 'unPreDeploySecurityGroup').resolves(new UnPreDeployContext(serviceContext));

            const unPreDeployContext = await redis.unPreDeploy(serviceContext);
            expect(unPreDeployContext).to.be.instanceof(UnPreDeployContext);
            expect(unPreDeployStub.callCount).to.equal(1);
        });
    });

    describe('unBind', () => {
        it('should unbind the security group', async () => {
            const unBindStub = sandbox.stub(deletePhasesCommon, 'unBindSecurityGroups').resolves(new UnBindContext(serviceContext));

            const unBindContext = await redis.unBind(serviceContext);
            expect(unBindContext).to.be.instanceof(UnBindContext);
            expect(unBindStub.callCount).to.equal(1);
        });
    });

    describe('unDeploy', () => {
        it('should undeploy the stack', async () => {
            const unDeployStackStub = sandbox.stub(deletePhasesCommon, 'unDeployService').resolves(new UnDeployContext(serviceContext));

            const unDeployContext = await redis.unDeploy(serviceContext);
            expect(unDeployContext).to.be.instanceof(UnDeployContext);
            expect(unDeployStackStub.callCount).to.equal(1);
        });
    });
});
