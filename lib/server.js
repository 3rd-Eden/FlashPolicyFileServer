var slice = Array.prototype.slice
  , net = require('net');

function Server(options,origins){
  var me = this;
  
  this.origins = origins || ['*:*'];
  this.port = 843;
  this.log = true;
  
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
    // Error nr 13, port not availble
    if (err.errno == 13){
      console.error(
        "Unable to listen to port `" + me.port + "` as your node instance does not have root privileges." +
        (
          me.server
          ? "The Flash Policy file will now be served inline over the supplied HTTP server, Flash Policy files request will suffer."
          : "No fallback server supplied."
        )
      );
      
      me.socket.removeAllListeners();
      me.socket.close();
      delete me.socket;
    }
  });
  
  this.socket.on('timeout', function serverTimeout(){});
  this.socket.on('close', function serverClosed(err){});
  
  // Compile the inital `buffer`
  this.compile();
  
}

/**
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
  
  // Check if we need to intercept responses on the supplied HTTP server
  // this can be needed for when your `net.Server` instance fails to response.
  // In order to make this work we need to remove all `request` listeners so our
  // listener will be the first that receives the request emit and we forword the
  // request once we have checked it's not a request for us.
  if (this.server){
    this.listeners = this.server.listeners('request');
    this.server.removeAllListeners('request');
    
    this.server.on('request', function(){
    
    });
    
    this.server.on('close', function(){
    
    });
  }
  
  return this;
};

/**
 * Sends the XML policy response to the server
 *
 * @param {net.Socket} socket The socket that needs to receive the error
 * @api private
 */
Server.prototype.responder = function responder(socket){
  if (socket && socket.readyState == 'open' && socket.end)
    socket.end(this.buffer);
};

/**
 * Compiles the origins in to a Buffer that we will use to send over the connections.
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
 */
Server.prototype.remove = function(origin){
  var position = this.origins.indexOf(origin);
  
  // only remove and recompile if we have a match
  if (position > 0){
    this.origins.splice(position,1);
    this.compile();
  }
  
  return this;
};

Server.prototype.close = function(){
  this.socket.removeAllListeners();
  this.socket.close();
  
  if (this.server){
    // @todo remove listeners from the server instance and restore the old listeners
  }
};

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