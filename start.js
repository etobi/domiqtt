process.title = 'domiqtt';

process.on('uncaughtException', function (e) {
	console.log('Uncaught Exception...');
	console.log(e.stack);
	process.exit(99);
});

var nconf = require('nconf'),
		defaultConfig = require('./defaultConfig.json'),
		DomiqClient = require('./lib/domiqClient.js'),

		SimpleLogger = require('simple-node-logger'),

		mqtt = require('mqtt'),

		logManager = new SimpleLogger(),
		logger = logManager.createLogger();

main = function () {
	nconf.env('__').argv();
	nconf.file('custom', './config.json');
	nconf.file('etc', '/etc/domiqtt/config.json');
	nconf.defaults(defaultConfig);

	logManager.createConsoleAppender();

	var domiqClient = new DomiqClient(
			nconf.get('domiq')
	);
	domiqClient.connect();
	domiqClient.on('connect', function () {
		logger.info('domiq connected');
	});

	domiqClient.on('close', function () {
		console.log('Connection closed');

	});

	var errorCounter = 0
	domiqClient.on('error', function (e) {
		console.log('error:', e);
		errorCounter++;
		if (errorCounter > 5) {
			console.log('giving up. exiting.');
			console.log(getDateTime());
			process.exit(1);
		}
		setTimeout(4000 * errorCounter, function () {
			domiqClient.connect();
		});
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
		mqttClient.publish(nconf.get('mqtt:options:will:topic'), 'online');
	});

	domiqClient.on('event', function (address, value) {

		// TODO ignore events by list

		logger.info('< domiq', ' ', address, ' = ', value);
		var topic = nconf.get('mqtt:prefix') +
					address.replace(/\./g, '/');

		logger.info('> mqtt', ' ', topic, ' : ', value);
		mqttClient.publish(topic, value);

		var addressParts = address.split('.');
		if (addressParts[1] === 'output') {
			mqttClient.publish(topic + '/_brightness_state', value);
			mqttClient.publish(topic + '/_state', value == 0 ? 'OFF' : 'ON');
		}
		if (addressParts[1] === 'relay') {
			mqttClient.publish(topic + '/_state', value == 0 ? 'OFF' : 'ON');
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
//					if (specialCommand === '_brightness_set') {
// 						ignoreNextMessage[specialCommand.replace('_brightness_set', '_set')] = true;
// 					}

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
			}
		}
	})
};

main();
