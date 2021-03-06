.. _dynamodb:

DynamoDB
========
This page contains information about using DynamoDB service supported in Handel. This service provisions a DynamoDB table for use by other AWS services.

Service Limitations
-------------------
No Update Support
~~~~~~~~~~~~~~~~~
This service intentionally does not support updates. Once a table is created, certain updates to the table will cause a new one to be created and the old one deleted. 
In an effort to avoid unwanted data loss, we don’t update this service automatically.

Parameters
----------

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - type
     - string
     - Yes
     - 
     - This must always be *dynamodb* for this service type.
   * - partition_key
     - :ref:`dynamodb-partition-key`
     - Yes
     - 
     - The ParitionKey element details how you want your partition key specified.
   * - sort_key
     - :ref:`dynamodb-sort-key`
     - No
     - None
     - The SortKey element details how you want your sort key specified. Unlike partition_key, sort_key is not required.
   * - provisioned_throughput
     - :ref:`dynamodb-provisioned-throughput`
     - No
     - 5 for read and write
     - The ProvisionedThroughput element details how much provisioned IOPS you want on your table for reads and writes.
   * - ttl_attribute
     - string
     - No
     - None
     - Configures the attribute to use for `DynamoDB TTL and auto-expiration <http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html>`_.
   * - local_indexes
     - :ref:`dynamodb-local-indexes`
     - No
     - 
     - You can configure `local secondary indexes <http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html>`_ for fast queries on a different sort key within the same partition key.
   * - stream_view_type
     - string
     - No
     -
     - When present, the `stream view type element <http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_StreamSpecification.html>`_ indicates that a dynamodb stream will be used and specifies what information is written to the stream. Options are KEYS_ONLY, NEW_IMAGE, OLD_IMAGE and NEW_AND_OLD_IMAGES.
   * - global_indexes
     - :ref:`dynamodb-global-indexes`
     - No
     -
     - You can configure `global secondary indexes <http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html>`_ for fast queries on other partition and sort keys in addition to the ones on your table.
   * - tags
     - :ref:`tagging-resources`
     - No
     - 
     - Any tags you want to apply to your Dynamo Table

.. _dynamodb-partition-key:

PartitionKey
~~~~~~~~~~~~
The PartitionKey element tells how to configure your partition key in DynamoDB. It has the following schema:

.. code-block:: yaml
    
    partition_key:
      name: <key_name> 
      type: <String|Number>

.. _dynamodb-sort-key:

SortKey
~~~~~~~
The SortKey element tells how to configure your sort key in DynamoDB. It has the following schema:

.. code-block:: yaml

    sort_key:
      name: <key_name> 
      type: <String|Number>

.. _dynamodb-provisioned-throughput:

ProvisionedThroughput
~~~~~~~~~~~~~~~~~~~~~
The ProvisionedThroughput element tells many IOPS to provision for your table for reads and writes. It has the following schema:

.. code-block:: yaml

    provisioned_throughput:
      read_capacity_units: <number or range>
      write_capacity_units: <number or range>
      read_target_utilization: <percentage> # Default: 70 (if autoscaling is enabled)
      write_target_utilization: <percentage> # Default: 70 (if autoscaling is enabled)

Autoscaling Throughput
``````````````````````

If a range (ex: 1-10) is provided to `read_capacity_units` or `write_capacity_units`, an autoscaling rule will be created
with the min and max values from the range and target utilization as specified by `read_target_utilization` and
`write_target_utilization`.

The following configuration will cause the read capacity to be automatically scaled between 10 and 100, with a target
usage of 50%. The write capacity will scale between 1-10, with a target usage of 70% (the default).

.. code-block:: yaml

    provisioned_throughput:
      read_capacity_units: 10-100
      read_target_utilization: 50
      write_capacity_units: 1-10

.. _dynamodb-local-indexes:

LocalIndexes
~~~~~~~~~~~~
The LocalIndexes element allows you to configure local secondary indexes on your table for alternate query methods. It has the following schema:

.. code-block:: yaml

    local_indexes:
    - name: <string> # Required
      sort_key: # Required
        name: <string>
        type: <String|Number>
      attributes_to_copy: # Required
      - <string>

.. _dynamodb-global-indexes:

GlobalIndexes
~~~~~~~~~~~~~
The GlobalIndexes element allows you to configure global secondary indexes on your table for alternate query methods. It allows you to specify a different partition key than the main table. It has the following schema:

.. code-block:: yaml

    global_indexes:
    - name: <string> # Required
      partition_key: # Required
        name: <string>
        type: <String|Number>
      sort_key: # Optional
        name: <string>
        type: <String|Number>
      attributes_to_copy: # Required
      - <string>
      provisioned_throughput: # Optional
        read_capacity_units: <number or range> # Default: Matches table config
        write_capacity_units: <number or range> # Default: Matches table config
        read_target_utilization: <percentage> # Default: Matches table config
        write_target_utilization: <percentage> # Default: Matches table config

The provisioned throughput configuration for Global Secondary Indexes matches that for the table. If the provisioned
throughput is not configured for the index, the table's configuration will be used, including any autoscaling configuration.

.. WARNING::

    Be aware that using Global Secondary Indexes can greatly increase your cost. When you use global indexes, you are effectively creating a new table. This will increase your cost by the amount required for storage and allocated IOPS for the global index.

Example Handel File
-------------------
.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: dynamodb
          partition_key: # Required, NOT updateable
            name: MyPartionKey
            type: String
          sort_key:
            name: MySortKey
            type: Number
          provisioned_throughput:
            read_capacity_units: 1-20 #Autoscale reads, but not writes
            write_capacity_units: 6
          tags:
            name: my-dynamodb-tag

Depending on this service
-------------------------
The DynamoDB service outputs the following environment variables:

.. list-table::
   :header-rows: 1

   * - Environment Variable
     - Description
   * - <SERVICE_NAME>_TABLE_NAME
     - The name of the created DynamoDB table
   * - <SERVICE_NAME>_TABLE_ARN
     - The ARN of the created DynamoDB table

See :ref:`environment-variable-names` for information about how the service name is included in the environment variable name.

DynamoDB Streams
-------------------------------
A `DynamoDB Stream <http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html>`_ sends an event to a lambda function when data in the table changes.  To configure a stream, include the stream_view_type element in your handel file and declare your lambda function as an `event_consumer <https://handel.readthedocs.io/en/latest/handel-basics/service-events.html>`_ with the following syntax:

.. code-block:: yaml

  event_consumers:
  - service_name: <string> # Required.  The service name of the lambda function
    batch_size: <number> # Optional.  Default: 100

BatchSize
~~~~~~~~~~~~
The largest number of records that AWS Lambda will retrieve from your event source at the time of invoking your function. Your function receives an event with all the retrieved records. The default is 100 records.

Events produced by this service
-------------------------------
The DynamoDB service currently produces events for the following services types:

* Lambda

Events consumed by this service
-------------------------------
The DynamoDB service does not consume events from other Handel services.