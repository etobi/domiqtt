process.title = 'domiqtt';

process.on('uncaughtException', function (e) {
	console.log('Uncaught Exception...');
	console.log(e.stack);
	process.exit(99);
});

var nconf = require('nconf'),
		DomiqClient = require('./lib/domiqClient.js'),

		SimpleLogger = require('simple-node-logger'),

		mqtt = require('mqtt'),

		logManager = new SimpleLogger(),
		logger = logManager.createLogger();

main = function () {
	nconf.env('__').argv();
	nconf.file('config', './config.json');

	logManager.createConsoleAppender();

	var initialState = false;
	var domiqClient = new DomiqClient(
			nconf.get('domiq')
	);
	domiqClient.connect();
	domiqClient.on('connect', function () {
		initialState = false;
		logger.info('domiq connected');
	});

	domiqClient.on('close', function () {
		console.log('Connection closed');
	});

	var errorCounter = 0;

	domiqClient.on('error', function (e) {
		console.log('error:', e);
		errorCounter++;
		if (errorCounter > 5) {
			console.log('giving up. exiting.');
			console.log(getDateTime());
			process.exit(1);
		}
		setTimeout(function () {
			domiqClient.connect();
		}, 4000 * errorCounter);
	});

	console.log(nconf.get('mqtt'));
	var mqttClient = mqtt.connect(
			nconf.get('mqtt:url'),
			nconf.get('mqtt:options')
	);
	mqttClient.on('connect', function () {
		logger.info('mqtt connected');
		mqttClient.subscribe(
				nconf.get('mqtt:prefix') + '#'
		);
		mqttClient.publish(nconf.get('mqtt:options:will:topic'), 'online', {retain: true});
	});

	domiqClient.on('event', function (address, value) {
		// TODO ignore events by list

		if (!initialState) {
			initialState = true;
			domiqClient.writeRaw("?");
		}

		logger.info('< domiq', ' ', address, ' = ', value);
		var topic = nconf.get('mqtt:prefix') +
					address.replace(/\./g, '/');

		logger.info('> mqtt', ' ', topic, ' : ', value);
		mqttClient.publish(topic, value, {retain: true});

		var addressParts = address.split('.');
		if (addressParts[1] === 'output') {
			mqttClient.publish(topic + '/_brightness_state', value, {retain: true});
			mqttClient.publish(topic + '/_state', value === '0' ? 'OFF' : 'ON', {retain: true});
		}
		if (addressParts[1] === 'relay' || addressParts[1] === 'variable') {
			mqttClient.publish(topic + '/_state', value === '0' ? 'OFF' : 'ON', {retain: true});
		}
		if (addressParts[1] === 'key' && value === 'hit') {
			setTimeout(function () {
				mqttClient.publish(topic, 'break', {retain: true});
			}, 150);
		}
		if (addressParts[1] === 'regulator') {
			var mode = 'auto';
			if (value === '1050') {
				mode = 'off';
			}
			if (value === '1300') {
				mode = 'on';
			}
			mqttClient.publish(topic + '/_mode', mode, {retain: true});
		}
		var nValue = Number(value);
		if (addressParts[1] === 'regulator' || (addressParts[1] === 'variable' && nValue > 800 && nValue < 6000)) {
			mqttClient.publish(topic + '/_c', ((Number(value) - 1000) / 10).toString(), {retain: true});
		}
	});

	var ignoreNextMessage = {};
	mqttClient.on('message', function (topic, message) {
		logger.info('< mqtt', ' ', topic, ' : ', message.toString());
		var regex = new RegExp('^' + nconf.get('mqtt:prefix'));
		var lastSlashIndex = topic.lastIndexOf("/");
		var specialCommand = topic.substring(lastSlashIndex + 1);

		if (ignoreNextMessage[specialCommand]) {
			ignoreNextMessage[specialCommand] = false;
			return;
		}

		if (specialCommand.substr(0, 1) === '_') {
			topic = topic.substring(0, lastSlashIndex);
			var address = topic
					.replace(regex, '')
					.replace(/\//g, '.');
			var value = message.toString();
			var addressParts = address.split('.');

			switch (specialCommand) {
				case '_get':
					domiqClient.get(address);
					domiqClient.getAge(address, function (age) {
						mqttClient.publish(topic + '/_age', age + "");
					});
					break;

				case '_getAge':
					domiqClient.getAge(address, function (age) {
						mqttClient.publish(topic + '/_age', age + "");
					});

					break;

				case '_set':
				case '_brightness_set':
					if (message.toString() === 'ON') {
						value = 'on';
					}
					if (message.toString() === 'OFF') {
						value = 'off';
					}
					if (addressParts[1] === 'output') {
						value = value + ';ramp:4';
					}
					logger.info('> domiq', ' ', address, ' = ', value);
					domiqClient.write(address, value);

					break;

				case '_mode_set':
					if (message.toString() === 'on') {
						value = '30';
					}
					if (message.toString() === 'off') {
						value = '5';
					}
					if (message.toString() === 'auto') {
						value = '21';
					}
					value = (Number(value) * 10 + 1000).toString();
					domiqClient.write(address, value);
					break;

				case '_temp_set':
					value = (Number(value) * 10 + 1000).toString();
					domiqClient.write(address, value);
					break;

				case '_gate_set':
					if (message.toString() === 'OPEN') {
						logger.info('> domiq', ' ', address, ' = ', '1');
						domiqClient.write(address, 1);
						setTimeout(function () {
							logger.info('> domiq', ' ', address, ' = ', '0');
							domiqClient.write(address, '0');
						}, 200);
					}

					if (message.toString() === 'CLOSE') {
						var newAddressParts = addressParts;
						newAddressParts[4]++;
						var newAddress = newAddressParts.join('.');
						logger.info('> domiq', ' ', newAddress, ' = ', '1');
						domiqClient.write(newAddress, '1');
						setTimeout(function () {
							logger.info('> domiq', ' ', newAddress, ' = ', '0');
							domiqClient.write(newAddress, '0');
						}, 200);
					}
					break;
			}
		}
	})
};

main();
