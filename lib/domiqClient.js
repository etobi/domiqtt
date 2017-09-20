var net = require('net'),
		reconnect = require('net-socket-reconnect'),
		events = require('events'),
		inherits = require('inherits');


function DomiqClient(options) {
	var defaultOptions = {
		"host": "192.168.50.50",
		"port": 4224
	};
	this.options = options || {};
    for (var option in defaultOptions) {
		if (defaultOptions.hasOwnProperty(option) && !options.hasOwnProperty(option)) {
			this.options[option] = defaultOptions[option];
		}
	}
	events.EventEmitter.call(this);
}
inherits(DomiqClient, events.EventEmitter);

DomiqClient.prototype._setupStream = function() {
	this.stream = reconnect({
		port: this.options.port,
		host: this.options.host,
		reconnectOnError: true,
		reconnectOnTimeout: true
	});

	this.receivedData = '';
	this.ignoreOnce = [];
	this.lastChange = [];

	var self = this;
	this.stream.on('connect', function () {
		self.emit('connect');
	});

	this.stream.on('reconnect', function () {
		self.emit('reconnect');
	});

	this.stream.on('reconnectFailed', function () {
		self.emit('reconnectFailed');
	});

	this.stream.on('data', function (data) {
		self.receivedData += data.toString();
		self._parseReceivedData();
	});

	this.stream.on('close', function () {
		self.emit('close');
	});

	this.stream.on('error', function (error) {
		self.emit('error', error);
	});

	this.on('error', function (error) {
		console.log('DomiqClient Error:', error);
	})
};

DomiqClient.prototype._parseReceivedData = function() {
	var index = this.receivedData.indexOf("\n");
	while (index > 1) {
		var command = this.receivedData.substring(0, index);
		this.receivedData = this.receivedData.substring(index + 1);
		this._parseLcnCommand(command);
		index = this.receivedData.indexOf("\n");
	}
};

DomiqClient.prototype._parseLcnCommand = function(command) {
	var parts = command.split('=');
	var address = parts[0],
			value = parts[1];

	if (!this.lastChange[address]
		|| !this.lastChange[address]['timestamp']
		|| this.lastChange[address]['value'] != value) {
			this.lastChange[address] = {
				'timestamp': Date.now(),
				'value': value
			};
	}

	if (this.ignoreOnce[address] === true) {
		this.ignoreOnce[address] = undefined;
	} else {
		this.emit('event', address, value);
	}
};

DomiqClient.prototype.connect = function() {
	this._setupStream();
};

DomiqClient.prototype.write = function (address, value) {
	this.ignoreOnce[address] = value != '?';
	this.writeRaw(address + '=' + value);
};

DomiqClient.prototype.writeRaw = function (content) {
	this.stream.write(content + '\n');
};

DomiqClient.prototype.get = function (address, callback) {
	this.write(address, '?');
};

DomiqClient.prototype.getAge = function (address, callback) {
	if (!this.lastChange[address] || !this.lastChange[address]['timestamp']) {
		callback(-1);
		return;
	}
	callback(Date.now() - this.lastChange[address]['timestamp']);
};

module.exports = DomiqClient;