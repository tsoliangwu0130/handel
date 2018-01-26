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
/*
 * This file is intended for use inside a lambda function to set IsIPV6Enabled on a Cloudfront Distribution.
 * TODO: Get rid of this once Cloudformation supports setting this value natively.
 */

import * as AWS from 'aws-sdk';
// tslint:disable-next-line:no-var-requires
const response = require('cfn-response');

export async function handler(event: any, context: any, callback: any) {
    const cloudfront = new AWS.CloudFront({ apiVersion: '2017-03-25' });
    const distroId = event.ResourceProperties.DistributionId;
    // tslint:disable-next-line:no-console
    console.log(`--- got request to update distribution ${distroId} ---`);
    try {
        const data = await cloudfront.getDistributionConfig({
            Id: distroId
        }).promise();
        const config = data.DistributionConfig;
        if (config!.IsIPV6Enabled) {
            // tslint:disable-next-line:no-console
            console.log(`--- distribution ${distroId} already had IsIPV6Enabled = true---`);
            response.send(event, context, response.SUCCESS, {});
            return;
        } else {
            config!.IsIPV6Enabled = true;
            const updateParams = {
                Id: distroId,
                IfMatch: data.ETag!,
                DistributionConfig: config!,
            };
            const updateResponse = await cloudfront.updateDistribution(updateParams).promise();
            // tslint:disable-next-line:no-console
            console.log(`--- updated distribution ${distroId} ---`);
            response.send(event, context, response.SUCCESS, {});
        }
    }
    catch (error) {
        // tslint:disable-next-line:no-console
        console.log(`--- error updating distribution ${distroId} ---`, error);
        response.send(event, context, response.FAILED, {});
    }
}
