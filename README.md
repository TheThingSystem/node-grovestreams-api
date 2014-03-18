node-grovestreams-api
=====================

A node.js module to interface with the [GroveStreams](https://grovestreams.com/)
[API](https://grovestreams.com/developers/api.html).

Note well: GroveStreams' [full API](https://grovestreams.com/developers/api_adv.html) is comprehensive.
This module implements only those calls needed by the associated 'indicator' driver in
[The Thing system](http://thethingsystem.com/).
You are welcome to submit _pull requests_ to add more functionality!

For a detailed example in using this API,
please take a look at
[indicator-grovestreams-sensor.js](https://github.com/TheThingSystem/steward/blob/master/steward/devices/devices-indicator/indicator-grovestreams-sensor.js)
in The Thing System repository for the [steward](https://github.com/TheThingSystem/steward).

Before Starting
---------------
You will need a GroveStreams account with at least one organization:

- If you do not already have a GroveStreams account:
    - Go to the [GroveStreams website](https://grovestreams.com) and follow the directions to sign up.

- Login to your GroveStreams account. If you do not have any associated organizations (workspaces),
you'll be asked to create one.
    -  Select 'Yes' and follow the directions to create one (by providing a name)

- Retrieve the 'Secret API Key' by clicking on the padlock icon near the upper-right corner:
    - Select the 'Feed Put API Key (with auto-registration rights)
    - Click on 'View Secret Key'
    - After closing the 'API Secret Key' window, click on 'Edit'and ensure that the API key has permission to:
        - component/*/feed: GET, PUT, POST
        - component: GET, PUT, POST
        - component_folder: GET, PUT, POST
        - org_user: GET
        - unit/: GET, PUT, POST

- Retrieve the 'Organization UID' by clicking on the tools icon to the right of the padlock icon:
    - Select 'View Organization UID'

API
---

### Load

    var GroveStreams = require('grovestreams-api');

### Login to cloud

__NB:__ this call requires the GET permission for _org_user_, _component_, _component_folder_, and _unit_.

    var organizationUID = '...'
      , secretAPIKey    = '...'
      , client
      ;

    client = new GroveStreams.ClientAPI({ clientID     : organizationUID
                                        , clientSecret : secretAPIKey }).login(function(err, users, components, units) {
      if (!!err) return console.log('login error: ' + err.message);

      // examine list of users components, and units
    }).on('error', function(err) {
      console.log('background error: ' + err.message);
    });

The non-error parameters given to the login callback contain objects defining the users, components (with streams),
and units associated with the identified organization.


### Create a component

__NB:__ this call requires the GET and PUT permissions for _component_.

If the _uid_ property isn/t present, it will be automatically-generated; regardless, it is returned to the callback on success.

    // the name property is mandatory
    client.addComponent(componentID, properties, function(err, componentUID) {
      if (!!err) return console.log('addComponent error: ' + err.message);

      // record componentUID
      // client.components[componentUID] has all the information on the component
    });

### Create a new unit

__NB:__ this call requires the PUT permission for _unit_.

    // the symbol property is mandatory
    client.addUnit(componentUID, streamID, properties, function(err, unitUID) {
      if (!!err) return console.log('addUnit error: ' + err.message);

      // client.units[unitUID] has all the information on the measuring unit
    });

### Create a new stream in a component

__NB:__ this call requires the GET and POST permissions for _component_.

    // the name, valueType, and unit properties are mandatory
    client.addStream(componentUID, streamID, properties, function(err, streamUID) {
      if (!!err) return console.log('addStream error: ' + err.message);

      // client.streams[streamUID] has all the information on the stream
      // furthermore client.components.stream[] includes the new stream
    });

### Upload a batch of samples for a stream

__NB:__ this call requires the POST permission for _component/*/feed_.

    var samples = { component: [ { componentUid : componentUID
                                 , stream       : [ { streamUid : streamUID
                                   // more than ome sample may be present per stream, just fill-in the two arrays
                                                    , data      : [ data ]
                                                    , time      : [ sampleTime ]
                                                    }
                                                  ]
                                 }

                                 // more than ome component may be present per batch...
                               ]
                  };

    client.addSamples(samples, function(err, result) {
      if (!!err) return console.log('addSamples error: ' + err.message);

      // result is null
    });

### Upload a sample for a stream

__NB:__ this call requires the POST permission for _component/*/feed_.

    client.addSample(componentUID, streamUID, data, sampleTime, function(err, result) {
      if (!!err) return console.log('addSample error: ' + err.message);

      // result is null
    });
