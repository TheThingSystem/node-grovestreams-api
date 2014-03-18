// a node module to interface with the GroveStreams cloud API
//   cf., https://grovestreams.com/developers/api.html

var events      = require('events')
  , https       = require('https')
  , querystring = require('querystring')
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
    var active, count, i;

    if (!!err) return callback(err);
    if (!response) return callback(new Error('empty response'));
    if (!response.org_user) return callback(new Error('org_user[] missing in response'));

    var done = function() {
      if (active > 0) return;

      self.sync(self);
      callback(null, self.users, self.components, self.units);
    };

    var f = function(start)  {
      active++;
      self.invoke('GET', '/api/component?start=' + start + '&limit=10', null, function(err, code, response) {
        var component, i;

        active--;
        if (!!err) return callback(err);
        if (!response) return callback(new Error('empty response'));
        if (!response.component) return callback(new Error('component[] missing in response'));

        var getStreams = function(componentUID) {
          return function(err, code, response) {
            active--;
            if (!!err) return callback(err);
            if (!response) return callback(new Error('empty response'));
            if (!response.stream) return callback(new Error('stream[] missing in response'));

            self.components[componentUID].stream = response.stream;
            done();
          };
        };

        if (!self.components) self.components = {};
        for (i = 0; i < response.component.length; i++) {
          component = response.component[i];
          if (!component.ownerUser) component.ownerUser = self.ownerUser;
          if (!component.location) component.location = self.options.location;
          if (!component.stream) component.stream = [];
          self.components[component.uid] = component;

          active++;
          self.invoke('GET', '/api/component/' + component.uid + '/stream', null, getStreams(component.uid));
        }
        count += response.component.length;
        if (count !== response.totalCount) return f(start + 10);

        done();
      });
    };

    self.users = response.org_user;
    for (i = 0; i < self.users.length; i++) {
      if (!self.users[i].isOwner) continue;

      self.ownerUser = { uid: self.users[i].uid, name: self.users[i].fullName };
      break;
    }
    if (!self.ownerUser) return callback(new Error('no owner users returned'));

    active = 1;
    self.invoke('GET', '/api/unit', null, function(err, code, response) {
      var i, units;

      active--;
      if (!!err) return callback(err);
      if (!response) return callback(new Error('empty response'));
      if (!response.unit) return callback(new Error('unit[] missing in response'));

      units = response.unit;
      self.units = {};
      for (i = 0; i < units.length; i++) {
        units[i].id = units[i].id.toLowerCase();
        self.units[units[i].id] = units[i];
      }

      done();
    });

    count = 0;
    f(0);
  });
};


ClientAPI.prototype.addComponent = function(componentID, properties, callback) {
  var defaults, property;

  var self = this;

  defaults  = { id           : componentID
              , uid          : ''
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
    var componentUID;

    if (!!err) return callback(err);
    if (!response) return callback(new Error('empty response'));
    if (!response.component) return callback(new Error('component missing in response'));

    if (!response.component.ownerUser) response.component.ownerUser = properties.ownerUser;
    if (!response.component.location) response.component.location = properties.location;

    componentUID = response.component.uid;
    self.components[componentUID] = response.component;
    self.invoke('GET', '/api/component/' + componentUID + '/stream', null, function(err, code, response) {
      if (!!err) return callback(err);
      if (!response) return callback(new Error('empty response'));
      if (!response.stream) return callback(new Error('stream[] missing in response'));

      self.components[componentUID].stream = response.stream;
      self.sync(self);

      callback(null, componentUID);
    });

    self.invoke('PUT', '/api/component_folder/' + componentUID + '?'
                  + querystring.stringify({ contentType     : 'component'
                                          , parentFolderUid : ''
                                          , text            : self.components[componentUID].name
                                          }), null);
  });
};

ClientAPI.prototype.addStream = function(componentUID, streamID, properties, callback) {
  var component, defaults, property;

  var self = this;

  component = self.components[componentUID];
  if (!component) throw new Error('no component with UID=' + componentUID);

  defaults  = { id                  : streamID
              , name                : undefined
              , description         : ''
              , valueType           : undefined
              , unit                : undefined
              , streamType          : 'rdm_stream'
              , rollupMethod        : 'AVG'
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

  if (!properties.uid) {
    return self.invoke('GET', '/api/component/' + componentUID + '/stream/new?type=' + properties.streamType, null,
                       function(err, code, response) {
      var property;

      if (!!err) return callback(err);
      if (!response) return callback(new Error('empty response'));
      if (!response.stream) return callback(new Error('stream missing in response'));

      for (property in properties) if (properties.hasOwnProperty(property)) response.stream[property] = properties[property];
      self.addStream(componentUID, streamID, response.stream, callback);
    });
  }

  if (!component.stream) component.stream = [];
  component.stream.push(properties);

  return self.invoke('POST', '/api/component', { component: component }, function(err, code, response) {
    if (!!err) return callback(err);
    if (!response) return callback(new Error('empty response'));
    if (!response.component) return callback(new Error('component missing in response'));

    if (!response.component.ownerUser) response.component.ownerUser = component.ownerUser;
    if (!response.component.location) response.component.location = component.location;

    self.components[componentUID] = response.component;
    self.invoke('GET', '/api/component/' + componentUID + '/stream', null, function(err, code, response) {
      if (!!err) return callback(err);
      if (!response) return callback(new Error('empty response'));
      if (!response.stream) return callback(new Error('stream[] missing in response'));

      self.components[componentUID].stream = response.stream;
      self.sync(self);

      callback(null, properties.uid);
    });
  });
};


ClientAPI.prototype.addUnit = function(unitID, properties, callback) {
  var defaults, property;

  var self = this;

  defaults  = { id             : unitID
              , uid            : ''
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
    if (!response) return callback(new Error('empty response'));
    if (!response.unit) return callback(new Error('unit missing in response'));

    unit = response.unit;
    unit.id = unit.id.toLowerCase();
    self.units[unit.id] = unit;

    callback(null, unit.uid);
  });
};


ClientAPI.prototype.addSamples = function(samples, callback) {
  var self = this;

  return self.invoke('PUT', '/api/feed', { feed: samples }, function(err, code, response) {/* jshint unused: false */
    if (!!err) return callback(err);

    callback(null);
  });
};

ClientAPI.prototype.addSample = function(componentUID, streamUID, data, sampleTime, callback) {
  var feed;

  var self = this;

  feed = { component: [ { componentUid : componentUID
                        , stream       : [ { streamUid : streamUID
                                           , data      : [ data ]
                                           , time      : [ sampleTime ]
                                           }
                                         ]
                        }
                      ]
         };
  return self.addSamples(feed, callback);
};


ClientAPI.prototype.sync = function(self) {
  var component, i, uid;

  self.streams = {};
  for (uid in self.components) {
    if (!self.components.hasOwnProperty(uid)) continue;

    component = self.components[uid];
    if (!component.stream) continue;

    for (i = 0; i < component.stream.length; i++) self.streams[component.stream[i].uid] = component.stream[i];
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
      if (!!err) self.logger.error('invoke', { exception: err }); else self.logger.debug(path, { response: response });
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
                     }[method]
        , json     = {}
        ;

      if (expected.indexOf(response.statusCode) === -1) {
         self.logger.error(method + ' ' + path, { event: 'https', code: response.statusCode, body: body });
         return callback(new Error('HTTP response ' + response.statusCode), response.statusCode, json);
      }

      if (body.length === 0) return callback(null, response.statusCode, null);

      try { json = JSON.parse(body); } catch(ex) {
        self.logger.error(path, { event: 'json', diagnostic: ex.message, body: body });
        return callback(ex, response.statusCode);
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


exports.ClientAPI = ClientAPI;
