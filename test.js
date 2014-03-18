var GroveStreams = require('./grovestreams-api')
  , util         = require('util')
  ;


var organizationUID = '...'
  , secretAPIKey    = '...'
  , client
  ;


client = new GroveStreams.ClientAPI({ clientID     : organizationUID
                                    , clientSecret : secretAPIKey
                                    }).login(function(err, users, components, units) {
  if (!!err) return console.log('login error: ' + err.message);

  console.log('users:');
  console.log(util.inspect(users, { depth: null }));
  console.log('');

  console.log('components:');
  console.log(util.inspect(components, { depth: null }));
  console.log('');

  console.log('units:');
  console.log(util.inspect(units, { depth: null }));
  console.log('');

  addTheComponent('device/5', 'dishwasher');
}).on('error', function(err) {
  console.log('background error: ' + err.message);
});

var addTheComponent = function(id, name) {
  client.addComponent(id, { name: name }, function(err, componentUID) {
    if (!!err) return console.log('addComponent error: ' + err.message);

    console.log('componentUID: ' + componentUID);

// NB: we know that the celsius unit is already defined, so we can run these two in parallel
    addTheUnits();
    addTheStream(componentUID);
  });
};

var addTheUnits = function() {
  var m, measure;

  var addUnit = function(unitID) {
    return function(err, unitUID) {
      if (!!err) return console.log('addUnit ' + unitID + ' error: ' + err.message);

      console.log('unitID for ' + unitID + ': ' + unitUID);
      console.log(util.inspect(client.units[unitID], { depth: null }));
    };
  };

  var measures = { Voltage     : { symbol: 'V',   units: 'voltage',    type: 'contextDependentUnits' }
                 , PPM         : { symbol: 'ppm', units: 'ppm',        type: 'contextDependentUnits' }
                 , Percent     : { symbol: '%',   units: 'percent',    type: 'contextDependentUnits' }
                 , LUX         : { symbol: 'lx',  units: 'lux',        type: 'derivedSI'             }
                 , MilliBars   : { symbol: 'mb',  units: 'millibars',  type: 'derivedUnits'          }
                 , Decibels    : { symbol: 'dB',  units: 'decibels',   type: 'derivedUnits'          }
                 , Celsius     : { symbol: 'C',   units: 'celsius',    type: 'derivedSI'             }
                 };
  for (m in measures) {
    if (!measures.hasOwnProperty(m)) continue;

    measure = measures[m];
    if (!!client.units[measure.units]) continue;

    client.addUnit(measure.units, { name: m, symbol: measure.symbol }, addUnit(measure.units));
  }
};

var addTheStream = function(componentUID) {
  var addStream = function(streamID) {
    return function(err, streamUID) {
      if (!!err) return console.log('addStream ' + componentUID + ' ' + streamID + ' error: ' + err.message);

      console.log('streamUID for ' + componentUID + ' ' + streamID + ': ' + streamUID);
      addTheSample(componentUID, streamUID);
    };
  };

  client.addStream(componentUID, 'temperature', { name      : 'temperature'
                                                , valueType : 'float'
                                                , unit      : { uid: client.units.celsius.uid }
                                                }, addStream('temperature'));
};

var addTheSample = function(componentUID, streamUID) {
  client.addSample(componentUID, streamUID, 20.0, new Date().getTime(), function(err, result) {
    if (!!err) return console.log('addSamp error: ' + err.message);

    if (!result) result = { success: true };
    console.log('addPoint: ' + JSON.stringify(result));
  });
};
