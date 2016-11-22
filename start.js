process.title = 'domiqMqtt';

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
	nconf.file('etc', '/etc/domiqMqtt/config.json');
	nconf.defaults(defaultConfig);

	logManager.createConsoleAppender();

	var domiqClient = new DomiqClient(nconf.get('domiq'));
	domiqClient.connect();
	domiqClient.on('connect', function() {
		logger.info('domiq connected');
	});

	console.log(nconf.get('mqtt'));
	var mqttClient = mqtt.connect(nconf.get('mqtt:url'), nconf.get('mqtt:options'));
	mqttClient.on('connect', function () {
		logger.info('mqtt connected');
		mqttClient.subscribe('+/' + nconf.get('mqtt:prefix') + '#');
	});

	domiqClient.on('event', function(address, value) {
		logger.info('domiq', ' ', address, ' = ', value);
		var topic = mqttClient.options.clientId +
				'/' +
				nconf.get('mqtt:prefix') +
				address.replace(/\./g, '/');
		mqttClient.publish(topic, value);
	});

	mqttClient.on('message', function (topic, message) {
		var firstSlashIndex = topic.indexOf("/");
		var senderId = topic.substring(0, firstSlashIndex);
		if (senderId != mqttClient.options.clientId) {
			logger.info('mqtt', ' ', topic, ' ', message.toString());
			var regex = new RegExp('^/' + nconf.get('mqtt:prefix'));
			var address = topic
					.substring(firstSlashIndex)
					.replace(regex, '')
					.replace(/\//g, '.');
			var value = message.toString();
			domiqClient.write(address, value);
		}
	})
};

main();