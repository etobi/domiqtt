process.title = 'domiqtt';

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
		if (addressParts[1] == 'output') {
			mqttClient.publish(topic + '/_brightness_state', value);
			mqttClient.publish(topic + '/_state', value == 0 ? 'OFF' : 'ON');
		}
	});

	mqttClient.on('message', function (topic, message) {
		logger.info('< mqtt', ' ', topic, ' : ', message.toString());
		var regex = new RegExp('^' + nconf.get('mqtt:prefix'));
		var lastSlashIndex = topic.lastIndexOf("/");
		var specialCommand = topic.substring(lastSlashIndex + 1);
		if (specialCommand.substr(0, 1) == '_') {
			switch (specialCommand) {
				case '_set':
				case '_brightness_set':
					topic = topic.substring(0, lastSlashIndex);

					var address = topic
							.replace(regex, '')
							.replace(/\//g, '.');

					var value = message.toString();
					if (message.toString() == 'ON') {
						value = '100';
					}
					if (message.toString() == 'OFF') {
						value = '0';
					}
					logger.info('> domiq', ' ', address, ' = ', value);
					domiqClient.write(address, value);

					break;
			}
		}
	})
};

main();
