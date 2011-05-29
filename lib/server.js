/**
 * Module dependencies and cached references.
 */
var slice = Array.prototype.slice
  , net = require('net');

/**
 * The server that does the Policy File servering
 *
 * Options:
 *   - `log`  Should we output logging information to STDOUT and STDERR?
 *
 * @param {Ojbect} options Options to customize the servers functionality.
 * @param {Array} origins The origins that are allowed on this server, defaults to `*:*`.
 * @api public
 */
function Server(options, origins){
  var me = this;
  
  this.origins = origins || ['*:*'];
  this.port = 843;
  this.log = true;
  
  // merge `this` with the options
  Object.keys(options).forEach(function(key){
    me[key] && (me[key] = options[key])
  });
  
  // create the net server
  this.socket = net.createServer(function createServer(socket){
    me.addListener('error', function socketError(){ responder.call(me, socket) });
    responder.call(me, socket);
  });
  
  // Listen for errors as the port might be blocked because we do not have root priv.
  this.socket.on('error', function serverError(err){
    // Special and common case error handling
    if (err.errno == 13){
      me.log && console.error(
        new Date+ ':@: Unable to listen to port `' + me.port + '` as your Node.js instance does not have root privileges. ' +
        (
          me.server
          ? 'The Flash Policy file will now be served inline over the supplied HTTP server, Flash Policy files request will suffer.'
          : 'No fallback server supplied.'
        )
      );
      
      me.socket.removeAllListeners();
      delete me.socket;
    } else {
      me.log && console.error(new Date+ ':@: FlashPolicyFileServer received a error event:\n' + (err.message ? err.message : err));
    }
  });
  
  this.socket.on('timeout', function serverTimeout(){});
  this.socket.on('close', function serverClosed(err){
    // Remove the inline policy listener if we close down
    // but only when the server was `online` (see listen prototype)
    if (me.server && me.server['@'] && me.server.online){
      me.server.removeListener('connection', me.server['@']);
    }
    
    // not online
    delete me.server.online;
    me.log && console.log(new Date+ ':@: Shutting down FlashPolicyFileServer');
  });
  
  // Compile the inital `buffer`
  this.compile();
}

/**
 * Start listening for requests
 *
 * @param {Number} port The port number it should be listening to.
 * @param {Server} server A HTTP server instance, this will be used to listen for inline requests
 * @api public
 */
Server.prototype.listen = function listen(port, server){
  var me = this
    , args = slice.call(arguments, 0);
  
  args.forEach(function args(arg){
    typeof arg === 'number' ? (me.port = arg) : (me.server = arg);
  });
  
  if (this.server){
    
    // no one in their right mind would ever create a `@` prototype, so Im just gonna store
    // my function on the server, so I can remove it later again once the server(s) closes
    this.server['@'] = function connection(socket){
      socket.once('data', function requestData(data){
      
        // if it's a Flash policy request, and we can write to the 
        if (
             data
          && data === '<policy-file-request/>\0'
          && socket
          && (socket.readyState === 'open' || socket.readyState === 'writeOnly')
        ){
          // send the buffer
          socket.end(me.buffer);
        }
        
      })
    };
    // attach it :D
    this.server.on('connection', this.server['@']);
  }
  
  // We add a callback method, so we can set a flag for when the server is `enabled` or `online`.
  // this flag is needed because if a error occures and the we cannot boot up the server the
  // fallback functionality should not be removed during the `close` event
  this.socket.listen(this.port, function serverListening(){
   me.socket.online = true;
  });
  
  return this;
};

/**
 * Responds to socket connects and writes the compile policy file.
 *
 * @param {net.Socket} socket The socket that needs to receive the message
 * @api private
 */
Server.prototype.responder = function responder(socket){
  if (socket && socket.readyState == 'open' && socket.end)
    socket.end(this.buffer);
};

/**
 * Compiles the supplied origins to a Flash Policy File format and stores it in a Node.js Buffer
 * this way it can be send over the wire without any performance loss.
 *
 * @api private
 */
Server.prototype.compile = function compile(){
  var xml = [
        '<?xml version="1.0"?>'
      , '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">'
      , '<cross-domain-policy>'
    ];
  
  // add the allow access element
  this.origins.forEach(function origin(origin){
    var parts = origin.split(':');
    xml.push('<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>');
  });
  
  xml.push('</cross-domain-policy>');
  
  // store the result in a buffer so we don't have to re-generate it all the time
  this.buffer = new Buffer(xml.join(''), 'utf8');
  
  return this;
};

/**
 * Adds a new origin to the Flash Policy File.
 *
 * @param {Arguments} The origins that need to be added.
 * @api public
 */
Server.prototype.add = function add(){
  var args = slice.call(arguments, 0);
  Array.prototype.push.apply(this.origins, args);
  
  this.compile();
  return this;
};

/**
 * Removes a origin from the Flash Policy File.
 *
 * @param {String} origin The origin that needs to be removed from the server
 * @api public
 */
Server.prototype.remove = function remove(origin){
  var position = this.origins.indexOf(origin);
  
  // only remove and recompile if we have a match
  if (position > 0){
    this.origins.splice(position,1);
    this.compile();
  }
  
  return this;
};

/**
 * Closes and cleans up the server
 *
 * @api public
 */
Server.prototype.close = function close(){
  this.socket.removeAllListeners();
  this.socket.close();
  
  if (this.server){
    // @todo remove listeners from the server instance and restore the old listeners
  }
  
  return this;
};

/**
 * Proxy the eventlistener requests to the created Net server
 */
Object.keys(process.EventEmitter.prototype).forEach(function proxy(key){
  Server.prototype[key] = Server.prototype[key] || function (){
    if (this.socket) this.socket[key].apply(this.socket, arguments);
    return this;
  };
});

/**
 * Creates a new server instance.
 *
 * @param {Object} options A options object to override the default config
 * @param {Array} origins The origins that should be allowed by the server
 * @api public
 */
exports.createServer = function createServer(options,origins){
  return new Server(origins && options ? options : {}, origins);
};

/**
 * Provide a hook to the origional server, so it can be exended if needed.
 */
exports.Server = Server;

/**
 * Module version
 */
exports.version = '0.0.1';