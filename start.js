process.title = 'james-httpentrance';

var config = require('./config.json'),
		DomiqClient = require('./lib/domiqClient.js'),

		SimpleLogger = require('simple-node-logger'),

		mqtt = require('mqtt'),

		logManager = new SimpleLogger(),
		logger = logManager.createLogger();


main = function () {
	logManager.createConsoleAppender();

	var domiqClient = new DomiqClient(config.domiq);
	domiqClient.connect();
	domiqClient.on('connect', function() {
		logger.info('domiq connected');
	});

	var mqttClient = mqtt.connect(config.mqtt.url);
	mqttClient.on('connect', function () {
		logger.info('mqtt connected');
		mqttClient.subscribe('+/' + config.mqtt.prefix + '#');
	});

	domiqClient.on('event', function(address, value) {
		logger.info('domiq', ' ', address, ' = ', value);
		var topic = mqttClient.options.clientId +
				'/' +
				config.mqtt.prefix +
				address.replace(/\./g, '/');
		mqttClient.publish(topic, value);
	});

	mqttClient.on('message', function (topic, message) {
		var firstSlashIndex = topic.indexOf("/");
		var senderId = topic.substring(0, firstSlashIndex);
		if (senderId != mqttClient.options.clientId) {
			logger.info('mqtt', ' ', topic, ' ', message.toString());
			var regex = new RegExp('^/' + config.mqtt.prefix);
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