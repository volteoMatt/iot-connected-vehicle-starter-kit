/*******************************************************************************
 * Copyright (c) 2014 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution.
 *
 * The Eclipse Public License is available at
 *   http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at
 *   http://www.eclipse.org/org/documents/edl-v10.php.
 *
 * Contributors:
 *   Bryan Boyd - Initial implementation
 *******************************************************************************/

var request = require('request');
var fs = require('fs');
var Client = require("ibmiotf");
var mqtt = require('mqtt');
var http = require('http');
var settings = require('./config/settings');
var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
var appHost = appInfo.host || "localhost";

//iotf settings
var org = settings.iot_deviceOrg;
var iot_server = "mqtt://" + org + ".messaging.internetofthings.ibmcloud.com";
var iot_port = 1883;
var deviceType = settings.iot_deviceType;
var deviceId = settings.iot_deviceId;
var iot_password = settings.iot_token;
var iot_clientid = "d:" + org + ":" + settings.iot_deviceType + ":" + deviceId;

//mqtt topic
var telemetryTopic = "telemetry";
//var telemetryTopic = "iot-2/evt/telemetry/fmt/json";

//trimet api and app ID
var allVehiclesUrl = settings.vehicleApi + "appID=" + settings.appId;

var config = {
    "org" : org,
    "id" : deviceId,
    "type" : deviceType,
    "auth-method" : "token",
    "auth-token" : iot_password
};

var deviceClient = new Client.IotfDevice(config);

deviceClient.connect();

//connect to iotf and publish trimet data
deviceClient.on('connect', function () {
  console.log('mqtt connected');
  init();
});

deviceClient.on("error", function (err) {
    console.log("Error : "+err);
});

function init() {
  setInterval(function() {
    getVehicleIds(allVehiclesUrl);
  }, 10000);
  getVehicleIds(allVehiclesUrl);
}

function getVehicleIds(url) {
  request({
    url: url
  }, function (error, response, body) {
    if (error || response.statusCode !== 200) {
      console.log('Error getting vehicle IDs: ' + error);
    }
	vehicles = getVehiclePayload(JSON.parse(body));
	publishVehicleData(vehicles);
  });
}

function getVehiclePayload(info) {
	var vehicles = [];
    var allVehicles = info.resultSet.vehicle;

	for (var i=0; i<allVehicles.length; i++) {
		vehicleId = info.resultSet.vehicle[i].vehicleID;

		if ( vehicleId < 200 ) {
			vehicles.push(info.resultSet.vehicle[i]);
		}
	}
	return vehicles;
}

function getVehicleData(vehicleData) {
	try {
		// URL of the Trimet API
		var vehicleId = vehicleData.vehicleID;
		var lat = vehicleData.latitude;
        var lng = vehicleData.longitude;
		var name = vehicleData.signMessage;
		var heading = vehicleData.bearing;
		var type = vehicleData.type;
		var description = vehicleData.signMessageLong;

    // NOTE: we assume the color of the line is the first word in the signMessage
    var color = vehicleData.signMessage.split(" ")[0].toLowerCase();

		var vehicleData = {"id": vehicleId, "color": color, "name": name, 'lng': lng, "lat": lat, "heading": heading, "description": description, "type": type};
		return vehicleData;
	}
	catch(error) {
		console.log('Error getting vehicle data: ' + error);
	}
}

function publishVehicleData(vehicles) {
	//var payload = [];
	console.log(vehicles.length);
	for (var i = 0; i < vehicles.length; i++) {
		payload = getVehicleData(vehicles[i]);
		console.log("publishing data: " + telemetryTopic + " | " + JSON.stringify(payload));
		deviceClient.publish(telemetryTopic, "json", JSON.stringify(payload));
	}
}



// setup middleware
var express = require('express'),
	https = require('https'),
	path = require('path');
var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get("/credentials", function(req, res) {
  res.send(settings);
});

http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});
