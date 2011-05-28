var fspfs = require('../')
  , should = require('should')
  , assert = require('assert');

module.exports = {
  'Library version': function(){
     fspfs.version.should.match(/^\d+\.\d+\.\d+$/);
  }
, 'Create Server instance': function(){
    var server = fspfs.createServer()
      , server2 = new fspfs.Server({log:false}, ['blog.3rd-Eden.com:1337']);
    
    // server 2 options test
    server2.log.should.be.false;
    server2.origins.length.should.equal(1);
    server2.origins[0].should.equal('blog.3rd-Eden.com:1337');
    
    // server defaults
    server.log.should.be.true;
    server.origins.length.should.equal(1);
    server.origins[0].should.equal('*:*');
    
    // instance checking, sanity check
    assert.ok(server instanceof fspfs.Server);
    assert.ok(!!server.buffer);
  }
, 'Add origin': function(){
    var server = fspfs.createServer();
    server.add('google.com:80', 'blog.3rd-Eden.com:1337');
    
    server.origins.length.should.equal(3);
    server.origins.indexOf('google.com:80').should.be.above(0);
  }
, 'Remove origin': function(){
    var server = fspfs.createServer();
    server.add('google.com:80', 'blog.3rd-Eden.com:1337');
    server.origins.length.should.equal(3);
    
    server.remove('google.com:80');
    server.origins.length.should.equal(2);
    server.origins.indexOf('google.com:80').should.equal(-1);
  }
, 'Buffer': function(){
    var server = fspfs.createServer();
    
    Buffer.isBuffer(server.buffer).should.be.true;
    server.buffer.toString().indexOf('to-ports="*"').should.be.above(0);
    server.buffer.toString().indexOf('domain="*"').should.be.above(0);
    server.buffer.toString().indexOf('domain="google.com"').should.equal(-1);
    
    // The buffers should be rebuild when new origins are added
    server.add('google.com:80');
    server.buffer.toString().indexOf('to-ports="80"').should.be.above(0);
    server.buffer.toString().indexOf('domain="google.com"').should.be.above(0);
    
    server.remove('google.com:80');
    server.buffer.toString().indexOf('to-ports="80"').should.equal(-1);
    server.buffer.toString().indexOf('domain="google.com"').should.equal(-1);
  }
, 'Responder': function(){
    var server = fspfs.createServer()
      , calls = 0
      // dummy socket to emulate a `real` socket
      , dummySocket = {
          readyState: 'open'
        , end: function(buffer){
          calls++;
          Buffer.isBuffer(buffer).should.be.true;
          buffer.toString().should.equal(server.buffer.toString());
        }
      };
    
    server.responder(dummySocket);
    calls.should.equal(1);
  }
, 'Event proxy': function(){
    var server = fspfs.createServer()
      , calls = 0;
    
    Object.keys(process.EventEmitter.prototype).forEach(function proxy(key){
      assert.ok(!!server[key] && typeof server[key] === 'function');
    });
    
    // test if it works by calling a none default event
    server.on('pew', function(){
      calls++;
    });
    
    server.emit('pew');
    calls.should.equal(1);
  }
};