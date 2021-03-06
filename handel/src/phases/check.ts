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
import {getTags} from '../common/tagging-common';
import {EnvironmentContext, ServiceConfig, ServiceContext, ServiceDeployer, ServiceDeployers} from '../datatypes';

export function checkServices(serviceDeployers: ServiceDeployers, environmentContext: EnvironmentContext): string[] {
    winston.info(`Checking services in environment ${environmentContext.environmentName}`);
    // Run check on all services in environment to make sure params are valid
    const requiredTags = environmentContext.accountConfig.required_tags || [];
    let errors: string[] = [];
    _.forEach(environmentContext.serviceContexts, (serviceContext: ServiceContext<ServiceConfig>) => {
        const serviceDeployer = serviceDeployers[serviceContext.serviceType];
        if(serviceDeployer.check) {
            const dependenciesServiceContexts = getDependenciesServiceContexts(serviceContext, environmentContext);
            const checkErrors = serviceDeployer.check(serviceContext, dependenciesServiceContexts);
            errors = errors.concat(checkErrors);
        }
        errors = errors.concat(checkRequiredTags(serviceDeployer, serviceContext, requiredTags));
    });
    return errors;
}

function getDependenciesServiceContexts(serviceContext: ServiceContext<ServiceConfig>, environmentContext: EnvironmentContext): Array<ServiceContext<ServiceConfig>> {
    const dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>> = [];
    if(serviceContext.params.dependencies) {
        serviceContext.params.dependencies.forEach((dependency) => {
            dependenciesServiceContexts.push(environmentContext.serviceContexts[dependency]);
        });
    }
    return dependenciesServiceContexts;
}

function checkRequiredTags(serviceDeployer: ServiceDeployer, serviceContext: ServiceContext<any>, requiredTags: string[]): string[] {
    // If a deployer doesn't declare whether or not it supports tagging, we assume that it does.
    if (serviceDeployer.supportsTagging !== undefined && !serviceDeployer.supportsTagging) {
        // This service doesn't support tagging - SAD!
        return [];
    }

    const tags = getTags(serviceContext);

    return requiredTags.filter(tag => !tags.hasOwnProperty(tag))
        .map(tag => `Tagging - ${serviceContext.serviceName} - Missing required tag '${tag}'. You can apply this tag at either the application or service level.`);
}
