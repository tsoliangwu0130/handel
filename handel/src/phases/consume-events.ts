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
import * as _ from 'lodash';
import * as winston from 'winston';
import * as util from '../common/util';
import { ConsumeEventsContext, ConsumeEventsContexts, DeployContext, DeployContexts, EnvironmentContext, ServiceConfig, ServiceContext, ServiceDeployer, ServiceDeployers, ServiceEventConsumer } from '../datatypes';

interface ConsumeEventAction {
    consumerServiceContext: ServiceContext<ServiceConfig>;
    consumerDeployContext: DeployContext;
    consumerServiceDeployer: ServiceDeployer;
    producerServiceContext: ServiceContext<ServiceConfig>;
    producerDeployContext: DeployContext;
}

export async function consumeEvents(serviceDeployers: ServiceDeployers, environmentContext: EnvironmentContext, deployContexts: DeployContexts) {
    winston.info(`Executing consume events phase on services in environment ${environmentContext.environmentName}`);

    const consumeEventActions: ConsumeEventAction[] = [];
    const consumeEventsContexts: ConsumeEventsContexts = {};

    _.forEach(environmentContext.serviceContexts, (producerServiceContext: ServiceContext<ServiceConfig>, producerServiceName: string) => {
        if (producerServiceContext.params.event_consumers) { // Only look at those services producing events
            _.forEach(producerServiceContext.params.event_consumers, (consumerService: ServiceEventConsumer) => {
                const consumerServiceName = consumerService.service_name;

                const consumerServiceContext = environmentContext.serviceContexts[consumerServiceName];
                consumeEventActions.push({
                    consumerServiceContext,
                    consumerDeployContext: deployContexts[consumerServiceName],
                    consumerServiceDeployer: serviceDeployers[consumerServiceContext.serviceType],
                    producerServiceContext,
                    producerDeployContext: deployContexts[producerServiceName]
                });
            });
        }
    });

    for(const action of consumeEventActions) {
        const consumeEventsContextName = util.getConsumeEventsContextName(action.consumerServiceContext.serviceName, action.producerServiceContext.serviceName);
        winston.debug(`Consuming events from service ${consumeEventsContextName}`);
        if(!action.consumerServiceDeployer.consumeEvents) {
            throw new Error(`Tried to invoke the 'consumeEvents' phase on the '${action.consumerServiceContext.serviceType}' service, but it does not implement it`);
        }

        const consumeEventsContext = await action.consumerServiceDeployer.consumeEvents(action.consumerServiceContext, action.consumerDeployContext, action.producerServiceContext, action.producerDeployContext);
        if (!(consumeEventsContext instanceof ConsumeEventsContext)) {
            throw new Error('Expected ConsumeEventsContext back from \'consumeEvents\' phase of service deployer');
        }

        consumeEventsContexts[consumeEventsContextName] = consumeEventsContext;
    }
    return consumeEventsContexts; // This was built-up dynamically above
}
