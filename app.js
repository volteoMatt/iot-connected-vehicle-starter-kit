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
var vehicleApi = "https://developer.trimet.org/ws/v2/vehicles?";
var appId = "3C51B99B07D7A286055D3203C";
var allVehiclesUrl = vehicleApi + "appID=" + appId;

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
  getVehicleIds(allVehiclesUrl);
});

deviceClient.on("error", function (err) {
    console.log("Error : "+err);
});

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

		var vehicleData = {"id": vehicleId, "name": name, 'lng': lng, "lat": lat, "heading": heading, "description": description, "type": type};
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