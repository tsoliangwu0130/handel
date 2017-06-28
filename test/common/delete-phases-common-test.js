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
const ServiceContext = require('../../lib/datatypes/service-context');
const UnDeployContext = require('../../lib/datatypes/un-deploy-context');
const UnBindContext = require('../../lib/datatypes/un-bind-context');
const UnPreDeployContext = require('../../lib/datatypes/un-pre-deploy-context');
const deletePhasesCommon = require('../../lib/common/delete-phases-common');
const cloudformationCalls = require('../../lib/aws/cloudformation-calls');
const ec2Calls = require('../../lib/aws/ec2-calls');
const sinon = require('sinon');
const expect = require('chai').expect;

describe('Delete phases common module', function () {
    let sandbox;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('unDeployCloudFormationStack', function () {
        it('should delete the stack if it exists', function () {
            let getStackStub = sandbox.stub(cloudformationCalls, 'getStack').returns(Promise.resolve({}));
            let deleteStackStub = sandbox.stub(cloudformationCalls, 'deleteStack').returns(Promise.resolve(true));

            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", {});
            return deletePhasesCommon.unDeployCloudFormationStack(serviceContext, "DynamoDB")
                .then(unDeployContext => {
                    expect(unDeployContext).to.be.instanceof(UnDeployContext);
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(deleteStackStub.calledOnce).to.be.true;
                });
        });

        it('should suceed even if the stack has been deleted', function () {
            let getStackStub = sandbox.stub(cloudformationCalls, 'getStack').returns(Promise.resolve(null));
            let deleteStackStub = sandbox.stub(cloudformationCalls, 'deleteStack').returns(Promise.resolve(true));

            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", {});
            return deletePhasesCommon.unDeployCloudFormationStack(serviceContext, "DynamoDB")
                .then(unDeployContext => {
                    expect(unDeployContext).to.be.instanceof(UnDeployContext);
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(deleteStackStub.notCalled).to.be.true;
                });
        });
    });

    describe('unPreDeploySecurityGroup', function () {
        it('should delete the stack if it exists', function () {
            let getStackStub = sandbox.stub(cloudformationCalls, 'getStack').returns(Promise.resolve({}));
            let deleteStackStub = sandbox.stub(cloudformationCalls, 'deleteStack').returns(Promise.resolve(true));

            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return deletePhasesCommon.unPreDeploySecurityGroup(serviceContext, "FakeService")
                .then(unPreDeployContext => {
                    expect(unPreDeployContext).to.be.instanceof(UnPreDeployContext);
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(deleteStackStub.calledOnce).to.be.true;
                });
        });

        it('should return true if the stack is already deleted', function () {
            let getStackStub = sandbox.stub(cloudformationCalls, 'getStack').returns(Promise.resolve(null));
            let deleteStackStub = sandbox.stub(cloudformationCalls, 'deleteStack').returns(Promise.resolve(true));

            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return deletePhasesCommon.unPreDeploySecurityGroup(serviceContext, "FakeService")
                .then(unPreDeployContext => {
                    expect(unPreDeployContext).to.be.instanceof(UnPreDeployContext);
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(deleteStackStub.notCalled).to.be.true;
                });
        })
    });

    describe('unBindSecurityGroups', function () {
        it('should remove all ingress from the given security group', function () {
            let removeIngressStub = sandbox.stub(ec2Calls, 'removeAllIngressFromSg').returns(Promise.resolve({}));

            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return deletePhasesCommon.unBindSecurityGroups(serviceContext, "FakeService")
                .then(unBindContext => {
                    expect(unBindContext).to.be.instanceof(UnBindContext);
                    expect(removeIngressStub.calledOnce).to.be.true;
                });
        });
    });

    describe('unPreDeployNotRequired', function() {
        it('should return an empty UnPreDeployContext', function() {
            return deletePhasesCommon.unPreDeployNotRequired({}, "FakeService")
                .then(unPreDeployContext => {
                    expect(unPreDeployContext).to.be.instanceOf(UnPreDeployContext);
                });
        });
    });

    describe('unBindNotRequired', function() {
        it('should return an emtpy UnBindContext', function() {
            return deletePhasesCommon.unBindNotRequired({}, "FakeService")
                .then(unBindContext => {
                    expect(unBindContext).to.be.instanceof(UnBindContext);
                });
        });
    });
});