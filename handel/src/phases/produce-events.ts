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
import { DeployContext, DeployContexts, EnvironmentContext, ProduceEventsContext, ProduceEventsContexts, ServiceConfig, ServiceContext, ServiceDeployer, ServiceDeployers } from '../datatypes';

interface ProduceEventsAction {
    consumerServiceName: string;
    producerServiceContext: ServiceContext<ServiceConfig>;
    producerDeployContext: DeployContext;
    producerServiceDeployer: ServiceDeployer;
}

async function produceEvent(consumerServiceContext: ServiceContext<ServiceConfig>, consumerDeployContext: DeployContext, producerServiceContext: ServiceContext<ServiceConfig>, producerDeployContext: DeployContext, producerServiceDeployer: ServiceDeployer) {
    if (!producerServiceDeployer.produceEvents) {
        throw new Error(`Tried to execute 'produceEvents' phase in '${producerServiceContext.serviceType}', which doesn't implement that phase`);
    }
    winston.debug(`Producing events from ${producerServiceContext.serviceName} for service ${consumerServiceContext.serviceName}`);
    const produceEventsContext = await producerServiceDeployer.produceEvents(producerServiceContext, producerDeployContext, consumerServiceContext, consumerDeployContext);
    if (!(produceEventsContext instanceof ProduceEventsContext)) {
        throw new Error(`Expected ProduceEventsContext back from 'produceEvents' phase of service deployer`);
    }
    return produceEventsContext;
}

export async function produceEvents(serviceDeployers: ServiceDeployers, environmentContext: EnvironmentContext, deployContexts: DeployContexts): Promise<ProduceEventsContexts> {
    winston.info(`Executing produce events phase on services in environment ${environmentContext.environmentName}`);

    const produceEventActions: ProduceEventsAction[] = [];
    const produceEventsContexts: ProduceEventsContexts = {};

    for (const producerServiceName in environmentContext.serviceContexts) {
        if (environmentContext.serviceContexts.hasOwnProperty(producerServiceName)) {
            const producerServiceContext = environmentContext.serviceContexts[producerServiceName];
            // _.forEach(environmentContext.serviceContexts, function (producerServiceContext, producerServiceName) {
            if (producerServiceContext.params.event_consumers) {
                // Get deploy info for producer service
                const producerServiceDeployer = serviceDeployers[producerServiceContext.serviceType];
                const producerDeployContext = deployContexts[producerServiceName];

                // Run produce events for each service this service produces to
                for(const consumerService of producerServiceContext.params.event_consumers) {
                    const consumerServiceName = consumerService.service_name;
                    produceEventActions.push({
                        consumerServiceName,
                        producerServiceContext,
                        producerDeployContext,
                        producerServiceDeployer
                    });
                }
            }
        }
    }

    for(const action of produceEventActions) {
        const produceEventsContextName = util.getProduceEventsContextName(action.producerServiceContext.serviceName, action.consumerServiceName);

        const consumerServiceContext = environmentContext.serviceContexts[action.consumerServiceName];
        const consumerDeployContext = deployContexts[action.consumerServiceName];

        const produceEventsContext = await produceEvent(consumerServiceContext, consumerDeployContext, action.producerServiceContext, action.producerDeployContext, action.producerServiceDeployer);
        produceEventsContexts[produceEventsContextName] = produceEventsContext;
    }
    return produceEventsContexts; // This was built-up dynamically above
}
