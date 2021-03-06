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
import * as route53 from '../aws/route53-calls';
import { AccountConfig, ServiceContext } from '../datatypes/index';
import { EcsServiceConfig } from '../services/ecs/config-types';
import { ContainerConfig, HandlebarsEcsTemplateContainer, HandlebarsEcsTemplateLoadBalancer, HandlebarsEcsTemplateRoutingInfo } from './ecs-shared-config-types';

function getDefaultRouteContainer(containerConfigs: HandlebarsEcsTemplateContainer[]): HandlebarsEcsTemplateContainer | undefined {
    for(const containerConfig of containerConfigs) {
        if(containerConfig.routingInfo) { // Just return the first one that has routing
            return containerConfig;
        }
    }
}

/**
 * Given a service context, this function returns a boolean that
 * tells whether one or more of the tasks specified in the user's
 * ECS configuration has load balancer routing configured for it.
 */
export function oneOrMoreTasksHasRouting(ownServiceContext: ServiceContext<EcsServiceConfig>): boolean {
    const serviceParams = ownServiceContext.params;

    for(const container of serviceParams.containers) {
        if(container.routing) {
            return true;
        }
    }
    return false;
}

export function getRoutingInformationForContainer(container: ContainerConfig, albPriority: number, clusterName: string): HandlebarsEcsTemplateRoutingInfo {
    if(!container.routing) {
        throw new Error(`Attempted to get routing information for a container that doesn't configure any routing`);
    }

    const routingInfo: HandlebarsEcsTemplateRoutingInfo = {
        healthCheckPath: '/',
        basePath: '/',
        albPriority,
        containerPort: container.port_mappings![0].toString(), // Wire up first port to ALB
        targetGroupName: `${clusterName.substring(0, 27)}-${container.name.substring(0, 4)}` // Configure the shortened ALB name (it has a limit of 32 chars)
    };
    if (container.routing.health_check_path) {
        routingInfo.healthCheckPath = container.routing.health_check_path;
    }
    if (container.routing.base_path) {
        routingInfo.basePath = container.routing.base_path;
    }

    return routingInfo;
}

export function getLoadBalancerConfig(serviceParams: EcsServiceConfig, containerConfigs: HandlebarsEcsTemplateContainer[], clusterName: string, hostedZones: AWS.Route53.HostedZone[], accountConfig: AccountConfig): HandlebarsEcsTemplateLoadBalancer {
    const loadBalancerConfig: HandlebarsEcsTemplateLoadBalancer = { // Default values for load balancer
        timeout: 60,
        type: 'http',
        defaultRouteContainer: getDefaultRouteContainer(containerConfigs),
        albName: clusterName.substring(0, 32).replace(/-$/, '') // Configure the shortened ALB name (it has a limit of 32 chars)
    };

    const loadBalancer = serviceParams.load_balancer;
    if (loadBalancer) {
        if (loadBalancer.timeout) {
            loadBalancerConfig.timeout = loadBalancer.timeout;
        }
        if (loadBalancer.type) {
            loadBalancerConfig.type = loadBalancer.type;
        }
        if (loadBalancer.https_certificate) {
            loadBalancerConfig.httpsCertificate = `arn:aws:acm:${accountConfig.region}:${accountConfig.account_id}:certificate/${loadBalancer.https_certificate}`;
        }
        if (loadBalancer.dns_names) {
            loadBalancerConfig.dnsNames = loadBalancer.dns_names.map(name => {
                return {
                    name: name,
                    zoneId: route53.getBestMatchingHostedZone(name, hostedZones)!.Id
                };
            });
        }
    }

    return loadBalancerConfig;
}

export function checkLoadBalancerSection(serviceContext: ServiceContext<EcsServiceConfig>, serviceName: string, errors: string[]) {
    const params = serviceContext.params;
    if (params.load_balancer) {
        // Require the load balancer listener type
        if (!params.load_balancer.type) {
            errors.push(`${serviceName} - The 'type' parameter is required in the 'load_balancer' section`);
        }

        // If type = https, require https_certificate
        if (params.load_balancer.type === 'https' && !params.load_balancer.https_certificate) {
            errors.push(`${serviceName} - The 'https_certificate' parameter is required in the 'load_balancer' section when you use HTTPS`);
        }

        if (params.load_balancer.dns_names) {
            const badName = params.load_balancer.dns_names.some(name => !route53.isValidHostname(name));
            if (badName) {
                errors.push(`${serviceName} - The 'dns_names' values must be valid hostnames`);
            }
        }
    }
}
