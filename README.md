node-grovestreams-api
=====================

A node.js module to interface with the [GroveStreams](https://grovestreams.com/)
[cloud API](https://grovestreams.com/developers/api.html).

Note well: GroveStreams' [full API](https://grovestreams.com/developers/api_adv.html) is comprehensive.
This module implements only those calls needed by the associated 'indicator' driver in
[The Thing system](http://thethingsystem.com/).
You are welcome to submit _pull requests_ to add more functionality!


Before Starting
---------------
You will need a GroveStreams account with at least one organization:

- If you do not already have a GroveStreams account:
    - Go to the [GroveStreams website](https://grovestreams.com).

    - Follow the directions to sign up.

- Login to your GroveStreams account. If you do not have any associated organizations (workspaces),
you'll be asked to create one. Select 'Yes' and

    - Follow the directions to create one (by providing a name)

- Retrieve the 'Secret API Key' by clicking on the padlock icon near the upper-right corner:
    - Select the 'Feed Put API Key (with auto-registration rights)
    - Click on 'View Secret Key'
    - After closing the 'API Secret Key' window, click on 'Edit'and ensure that the API key has permission to:
        - component/*/feed: GET, PUT, POST
        - component: GET, PUT, POST, DELETE
        - org_user: GET
        - unit/: GET, PUT, POST, DELETE

- Retrieve the 'Organization UID' by clicking on the tools icon to the right of the padlock icon:
    - Select 'View Organization UID'

API
---

### Load

    var GroveStreams = require('grovestreams-api');

### Login to cloud

    var clientID     = '...'
      , clientSecret = '...'
      , client
      ;

    client = new GroveStreams.ClientAPI({ clientID     : clientID
                                        , clientSecret : clientSecret }).login(function(err, users, components, units) {
      if (!!err) return console.log('login error: ' + err.message);

      // examine list of users components, and units
    }).on('error', function(err) {
      console.log('background error: ' + err.message);
    });

### Create a component

The properties parameter may contain the usual uid, name, creationDate, stream, dispotion, timeZoneId, ownerUser, and location 
information.
If the uid property isn/t present, it will be automatically-generated; regardless, it is returned to the callback on success.

    // the name property is mandatory
    client.addComponent(componentID, properties, function(err, componentUID) {
      if (!!err) return console.log('login error: ' + err.message);

      // record componentUID
    });

### Create a new stream in a component

    // the name, valueType, and unit properties is mandatory
    client.addStream(componentUID, streamID, properties, function(err, streamUID) {
    });

### Create a new sample for a stream

    client.addSample(streamUID, data, sampleTime, function(err) {
    });
