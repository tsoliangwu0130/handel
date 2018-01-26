import * as AWS from 'aws-sdk';

// TODO - This file has pretty much all "any" types in the function definitions. The file pretty much needs to be refactored to not use that
// big shared state object that is mutated everywhere in order to be able to assign type definitions to them.

/**
 * This function gets the instanceId from the terminate event and requests it's state change to DRAINING
 */
export async function handler(event: any, context: any) {
  // these are now defined inside the handler so the aws-sdk-mock will work correctly
  if (!AWS.config.region) {
    AWS.config.region = 'us-west-2';
  }
  const ECS = new AWS.ECS({
    apiVersion: '2014-11-13'
  });
  const SZ_PAGE = 100;

  /**
   * This function iterates through a page of ec2 instance of a particular ecs cluster looking for a matching ec2 instance
   * If a match is found it is placed then the cluster name and ec2 arn are returned
   */
  const searchECSinstanceClusterPage = (parm: any): Promise<any> => {
    if (parm.page.containerInstanceArns.length < 1) {
      return parm;
    }
    const describeInstancesParams: AWS.ECS.DescribeContainerInstancesRequest = {
      cluster: parm.cluster,
      containerInstances: parm.page.containerInstanceArns
    };

    return ECS.describeContainerInstances().promise()
      .then(describeInstancesResponse => {
        for (const containerInstance of describeInstancesResponse.containerInstances!) {
          if (parm.ec2id !== containerInstance.ec2InstanceId) {
            continue;
          }
          parm.rslt = { cluster: parm.cluster, ec2id: containerInstance.ec2InstanceId, ec2arn: containerInstance.containerInstanceArn };
          return parm;
        }
        return parm;
      });
  };

  /**
   * This function pages through all ec2 instances in a particular ecs cluster looking for a matching ec2 instance
   * This is a recursive call which will finish when either a match is found or there are no more instances in the page of results
   */
  const searchECSinstanceClusters = (parm: any): Promise<any> => {
    return ECS.listContainerInstances(parm.iter).promise()
      .then(rc => {
        return searchECSinstanceClusterPage({ ec2id: parm.ec2id, cluster: parm.iter.cluster, page: rc });
      })
      .then(rc => {
        if (rc.rslt) {
          parm.rslt = rc.rslt;
          return parm;
        }
        if (rc.page.nextToken) {
          parm.iter.nextToken = rc.page.nextToken;
          return searchECSinstanceClusters(parm);
        }
        return parm;
      });
  };

  /**
   * This function iterates through a page of ecs clusters looking for a matching ec2 instance
   * This is a recursive call which will finish when either a match is found or there are no more pages of ec2 instances for a particular ecs cluster
   */
  const searchECSclusterPage = (parm: any): Promise<any> => {
    const arn = parm.page.clusterArns.shift();
    if (!arn) {
      return parm;
    }
    return searchECSinstanceClusters({ ec2id: parm.ec2id, iter: { cluster: arn, maxResults: SZ_PAGE } })
      .then(rc => {
        if (rc.rslt) {
          parm.rslt = rc.rslt;
          return parm;
        }
        return searchECSclusterPage(parm);
      });
  };

  /**
   * This function pages through all ecs clusters in the account looking for a matching ec2 instance
   * This is a recursive call which will finish when either a match is found or there are no more pages of ecs clusters
   */
  const searchECSclusters = (parm: any): Promise<any> => {
    return ECS.listClusters(parm.iter).promise()
      .then(rc => {
        parm.page = rc;
        return searchECSclusterPage(parm);
      })
      .then(rc => {
        if (rc.rslt) {
          parm.rslt = rc.rslt;
          return parm;
        }
        if (!rc.page.nextToken) {
          return parm;
        }
        parm.iter.nextToken = rc.page.nextToken;
        return searchECSclusters(parm);
      });
  };

  /**
   * This function searches the ecs clusters to find out which one contains the ec2 container to drain then updates its status to DRAINING if found
   */
  const drainInstance = async (parm: any): Promise<any> => {
    // find for the cluster name this instance is part of
    return searchECSclusters({ ec2id: parm ? parm.ec2id : null, iter: { maxResults: SZ_PAGE } })
      .then(dat => {
        return dat.rslt;
      })
      .then(dat => {
        // tslint:disable-next-line:no-console
        console.log('pre-drain:\n' + JSON.stringify(dat, null, 2));
        if (!dat) {
          return dat;
        }
        const drn = {
          containerInstances: [dat.ec2arn],
          status: 'DRAINING',
          cluster: dat.cluster
        };
        return ECS.updateContainerInstancesState(drn).promise()
          .then(rc => {
            // tslint:disable-next-line:no-console
            console.log('pst-drain:\n' + JSON.stringify(rc, null, 2)); return rc;
          });
      });
  };

  return drainInstance({ ec2id: event.detail.EC2InstanceId });
}
