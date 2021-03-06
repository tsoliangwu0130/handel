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
import config from '../../src/account-config/account-config';
import * as util from '../../src/common/util';
import { AccountConfig, PreDeployContext, ServiceContext } from '../../src/datatypes';
import * as handelFileParser from '../../src/handelfile/parser-v1';
import * as deployLifecycle from '../../src/lifecycles/deploy';
import * as bindPhase from '../../src/phases/bind';
import * as checkPhase from '../../src/phases/check';
import * as deployPhase from '../../src/phases/deploy';
import * as preDeployPhase from '../../src/phases/pre-deploy';

describe('deploy lifecycle module', () => {
    let sandbox: sinon.SinonSandbox;
    let accountConfig: AccountConfig;

    beforeEach(async () => {
        accountConfig = await config(`${__dirname}/../test-account-config.yml`);
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('deploy', () => {
        it('should deploy the application environment on success', async () => {
            const serviceContext = new ServiceContext('FakeApp', 'FakeEnv', 'FakeService', 'FakeType', {type: 'FakeType'}, accountConfig);
            const checkServicesStub = sandbox.stub(checkPhase, 'checkServices').returns([]);
            const preDeployServicesStub = sandbox.stub(preDeployPhase, 'preDeployServices').resolves({
                A: new PreDeployContext(serviceContext),
                B: new PreDeployContext(serviceContext)
            });
            const bindServicesInLevelStub = sandbox.stub(bindPhase, 'bindServicesInLevel').returns({});
            const deployServicesInlevelStub = sandbox.stub(deployPhase, 'deployServicesInLevel').returns({});
            const handelFile = util.readYamlFileSync(`${__dirname}/../test-handel.yml`);
            const serviceDeployers = util.getServiceDeployers();
            const results = await deployLifecycle.deploy(accountConfig, handelFile, ['dev', 'prod'], handelFileParser, serviceDeployers);
            expect(checkServicesStub.callCount).to.equal(2);
            expect(preDeployServicesStub.callCount).to.equal(2);
            expect(bindServicesInLevelStub.callCount).to.equal(4);
            expect(deployServicesInlevelStub.callCount).to.equal(4);
        });
    });
});
