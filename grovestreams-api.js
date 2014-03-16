// a node module to interface with the GroveStreams cloud API
//   cf., https://grovestreams.com/developers/api.html

var crypto      = require('crypto')
  , events      = require('events')
  , https       = require('https')
  , url         = require('url')
  , util        = require('util')
  ;


var DEFAULT_LOGGER = { error   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     };


var ClientAPI = function(options) {
  var k;

  var self = this;

  if (!(self instanceof ClientAPI)) return new ClientAPI(options);

  self.options = options;

  self.logger = self.options.logger  || {};
  for (k in DEFAULT_LOGGER) {
    if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof self.logger[k] === 'undefined'))  self.logger[k] = DEFAULT_LOGGER[k];
  }

  if (!self.options.location) self.options.location = {};
};
util.inherits(ClientAPI, events.EventEmitter);


ClientAPI.prototype.login = function(callback) {
  var self = this;

  if (typeof callback !== 'function') throw new Error('callback is mandatory for login');

  return self.invoke('GET', '/api/org_user', null, function(err, code, response) {
    var i;

    if (!!err) return callback(err);

    var f = function(start)  {
      self.invoke('GET', '/api/component?start=' + start + '&limit=10', null, function(err, code, response) {
        var components, i;

        if (!!err) return callback(err);

        if (!self.components) self.components = [];
        self.components = self.components.concat(response.component);
        if (self.components.length !== response.totalCount) return f(start + 10);

        components = self.components;
        self.components = {};
        for (i = 0; i < components.length; i++) {
          if (!components[i].ownerUser) components[i].ownerUser = self.ownerUser;
          if (!components[i].location) components[i].location = self.options.location;

          self.components[components[i].uid] = components[i];
        }
        self.sync(self);

        self.invoke('GET', '/api/unit', null, function(err, code, response) {
          var i, units;

          if (!!err) return callback(err);

          units = response.unit;
          self.units = {};
          for (i = 0; i < units.length; i++) {
            units[i].id = units[i].id.toLowerCase();
            self.units[units[i].id] = units[i];
          }

          callback(null, self.users, self.components, self.units);
        });
      });
    };

    self.users = response.org_user;
    for (i = 0; i < self.users.length; i++) {
      if (!self.users[i].isOwner) continue;

      self.ownerUser = { uid: self.users[i].uid, name: self.users[i].fullName };
      break;
    }
    if (!self.ownerUser) return callback(new Error('no owner users returned'));

    f(0);
  });
};


ClientAPI.prototype.addComponent = function(componentID, properties, callback) {
  var defaults, property;

  var self = this;

  defaults  = { id           : componentID
              , uid          : exports.LookupUID('component:' + componentID)
              , name         : undefined
              , creationDate : 0
              , stream       : []
              , disposition  : 'FIXED'
              , timeZoneId   : 'UTC'
              , ownerUser    : self.ownerUser
              , location     : self.options.location
              };
  for (property in defaults) {
    if ((!defaults.hasOwnProperty(property)) || (properties.hasOwnProperty(property))) continue;

    if (defaults[property] === undefined) throw new Error(property + ' property is mandatory');
    properties[property] = defaults[property];
  }

  return self.invoke('PUT', '/api/component', { component: properties }, function(err, code, response) {
    if (!!err) return callback(err);

    if (!response.component.ownerUser) response.component.ownerUser = properties.ownerUser;
    if (!response.component.location) response.component.location = properties.location;

    self.components[response.component.uid] = response.component;
    self.sync(self);

    callback(null, response.component.uid);
  });
};

ClientAPI.prototype.getComponent = function(uid, callback) {
  var self = this;

  return self.invoke('GET', '/api/component/' + uid, null, function(err, code, response) {
    if (!!err) return callback(err);

    if (!response.component.ownerUser) response.component.ownerUser = self.ownerUser;
    if (!response.component.location) response.component.location = self.options.location;

    self.components[response.component.uid] = response.component;
    self.sync(self);

    callback(null, response.component);
  });
};


ClientAPI.prototype.addStream = function(componentUID, streamID, properties, callback) {
  var component, defaults, property;

  var self = this;

  component = self.components[componentUID];

  defaults  = { id                  : streamID
              , uid                 : exports.LookupUID('stream:' + component.id + ' ' + streamID)
              , name                : undefined
              , description         : ''
              , valueType           : undefined
              , unit                : undefined
              , streamType          : ''
/*
              , baseCycle           : {}
              , rollupMethod        : 'AVG'
              , rollup_calendar     : { uid: '' }
 */
              , streamDerivationType: 'NONE'
              , delete_profile      : { uid: '' }
              , location            : component.location
              };
  for (property in defaults) {
    if ((!defaults.hasOwnProperty(property)) || (properties.hasOwnProperty(property))) continue;

    if (defaults[property] === undefined) throw new Error(property + ' property is mandatory');
    properties[property] = defaults[property];
  }
// one of: boolean, short, integer, long, float, double, big decimal, string, date, latitude, longitude, elevation
  properties.valueType = properties.valueType.toUpperCase(); 
  if (!component.stream) component.stream = [];
  component.stream.push(properties);
console.log(util.inspect(component, { depth: null }));

  return self.invoke('POST', '/api/component', { component: component }, function(err, code, response) {
    if (!!err) return callback(err);

    if (!response.component.ownerUser) response.component.ownerUser = component.ownerUser;
    if (!response.component.location) response.component.location = component.location;

    self.components[response.component.uid] = response.component;
    self.sync(self);

    callback(null, properties.uid);
  });
};


ClientAPI.prototype.addUnit = function(unitID, properties, callback) {
  var defaults, property;

  var self = this;

  defaults  = { id             : unitID
              , uid            : exports.LookupUID('unit:' + unitID)
              , symbol         : undefined
              , numberFormat   : '0,000.00'
              , symbolLocation : 'AFTER'
              , booleanStyle   : 'ON_OFF'
              };
  for (property in defaults) {
    if ((!defaults.hasOwnProperty(property)) || (properties.hasOwnProperty(property))) continue;

    if (defaults[property] === undefined) throw new Error(property + ' property is mandatory');
    properties[property] = defaults[property];
  }
  if (!properties.name) {
    properties.name = properties.id + ' (' + properties.numberFormat + properties.symbol + ')';
  } else if (properties.name.indexOf(' (') === -1) {
    properties.name += ' (' + properties.numberFormat + properties.symbol + ')';
  }

  return self.invoke('PUT', '/api/unit', { unit: properties }, function(err, code, response) {
    var unit;

    if (!!err) return callback(err);

    unit = response.unit;
    unit.id = unit.id.toLowerCase();
    self.units[unit.id] = unit;

    callback(null, unit.uid);
  });
};


ClientAPI.prototype.addPoint = function(streamUID, data, sampleTime, callback) {
};


ClientAPI.prototype.sync = function(self) {
  var component, i, uid;

  self.streams = {};
  for (uid in self.components) {
    if (!self.components.hasOwnProperty(uid)) continue;
    component = self.components[uid];

    for (i = 0; i < component.stream; i++) self.streams[component.stream[i].uid] = component.stream[i];
  }
};


ClientAPI.prototype.invoke = function(method, path, json, callback) {
  var options;

  var self = this;

  if ((!callback) && (typeof json === 'function')) {
    callback = json;
    json = null;
  }
  if (!callback) {
    callback = function(err, response) {
      if (!!err) self.logger.error('invoke', { exception: err }); else self.logger.info(path, { response: response });
    };
  }

  options = url.parse('https://grovestreams.com:443' + path, true);
  options.agent = false;
  options.method = method;
  options.headers = { Connection : 'close'
                    , Cookie     : 'api_key=' + self.options.clientSecret + ';org=' + self.options.clientID
                    };
  if (!!json) {
    options.headers['Content-Type'] = 'application/json';
    json = JSON.stringify(json);
    options.headers['Content-Length'] = Buffer.byteLength(json);
  }

  https.request(options, function(response) {
    var body = '';

    response.on('data', function(chunk) {
      body += chunk.toString();
    }).on('end', function() {
      var expected = { GET    : [ 200 ]
                     , PUT    : [ 200 ]
                     , POST   : [ 200, 201, 202 ]
                     , DELETE : [ 200 ]
                     }[method];

      var json = {};

      try { json = JSON.parse(body); } catch(ex) {
        self.logger.error(path, { event: 'json', diagnostic: ex.message, body: body });
        return callback(ex, response.statusCode);
      }

      if (expected.indexOf(response.statusCode) === -1) {
         self.logger.error(method + ' ' + path, { event: 'https', code: response.statusCode, body: body });
         return callback(new Error('HTTP response ' + response.statusCode), response.statusCode, json);
      }

      if (!json.success) return callback(new Error('unexpected response: ' + JSON.stringify(json.message)));

      callback(null, response.statusCode, json);
    }).on('close', function() {
      callback(new Error('premature end-of-file'));
    }).setEncoding('utf8');
  }).on('error', function(err) {
    callback(err);
  }).end(json);

  return self;
};



exports.LookupUID = function (id) {
  var hash;

  hash = crypto.createHash('whirlpool').update(id).digest('hex');
  return (hash.substr(0, 8) + '-' + hash.substr(9, 4) + '-4' + hash.substr(14, 3) + '-a' + hash.substr(14, 3) + '-'
            + hash.substr(18, 12));
};


exports.ClientAPI = ClientAPI;
