
// Event-Driven EV3 Data Parser: CORS
// By: Benjamin Zackin
// Last Modified: 8/9/16
// Notes:   Loops through all triggers checking if a state change occurred.
// 				If a state change occurs, sets all the corresponding actions
//			Added object wrapper to this file.  All functions in this file
//				must now be accessed externally as modelParse.myfunction() 
//				and internally as this.myfunction()
//			Added stop function.  This ends the state-change checking loop and
//				stops all active EV3 motors.
//			Added TODO's to the header comments for many of this file's functions,
//				They list some major not-yet-implemented functionalities each function currently lacks.
//			Switched Get and Set to use dictionary mapping instead of if statements.
//			Added support for all EV3 peripherals
//
var modelParse = {
	url: "http://130.64.154.33:5000", // storage variable for Juliana's EV3 (running Linux server) that we are using for testing.
	url2: "http://130.64.188.166:5000", // storage variable for Ben's EV3 (running Linux server) that we are using for testing
	url3: "http://130.64.95.192:5000", // storage variable for Bianca's GrovePI that we are using for testing.
	//startTime: 0, // timer variable for computing send latency
	lastValues: {}, // object that will store the last value of each trigger input
	config: {}, // object for storing the port configuration info
	triggerList: [], // array of trigger data
	delayedLoop: {}, // object holding the trigger check loop, assigning it to an object allows the loop to be exited at will (think: a stop button in the interface that can abort the current code)

	// parse_data()
	// 		Main function of the modelParse object.
	// 		Implements the code constructed in the interface and encoded in the data model by: 
	//			-Parsing the input JSON data model
	//			-Checking for state changes
	//			-Sending HTTP requests to retrieve input values and execute output actions.
	//
	parse_data: function (dataFile) { 
		//console.log(dataFile);
		//Start Data Parsing
		var data = JSON.parse(dataFile);
		//console.log(data);
		//console.log("parse_data Fcn://\tJSON parsed to variable 'data'");
		var raw_config = data.portConfig;
		//for (var d = 0; d < data.triggers.length; d++) {};
		this.triggerList = data.triggers;
		for (portID in data.portConfig) { // truncate portConfig to only contain assigned ports
			if (data.portConfig[portID] != "None") {
				this.config[portID] = data.portConfig[portID];
			}
		}
		//console.log("parse_data Fcn://\tport config truncated");
		var trigger_len = this.triggerList.length;
		// preset all the old values (so we can detect state changes!)
		for(var i = 0; i < trigger_len; i++) {
			if (!this.triggerList[i].channel) {
				this.triggerList[i].channel = this.config[this.triggerList[i].port];
			}
			this.triggerList[i].requestPending = false; // initialize request pending field for all triggers to false
			if (this.triggerList[i].actions) {
				for (var numActs = 0; numActs < this.triggerList[i].actions.length; numActs++){
					if (!this.triggerList[i].actions[numActs].channel) {
						this.triggerList[i].actions[numActs].channel = this.config[this.triggerList[i].actions[numActs].port];
					}
				}
			}
			if (this.triggerList[i].mode === "programStart") {
				this.send_set(this.triggerList[i].actions); // loop through the outputs for that state change and send set requests for all of them
			}
			else { // if the trigger is not the program start block, populate the lastValues object.
				this.send_get(this.triggerList[i], i, true);
			}
		}
		//console.log("parse_data Fcn://\tstart values for all triggers set");
		var j = 0;
		delayedLoop = setInterval(function(){ 
			//console.log("parse_data Fcn://\t delayed loop entered, iteration: " + j);

			if(j < trigger_len) {
			 	//console.log("parse_data Fcn://\t about to send get for trigger #: " + j);
			 	console.log("parse_data Fcn://\trequestPending status is: " + modelParse.triggerList[j].requestPending);
			 	console.log("parse_data Fcn://\tfor device in port: " + modelParse.triggerList[j].port);
				if (!modelParse.triggerList[j].requestPending) {
					modelParse.triggerList[j].requestPending = true; // set the pending variable to true for this trigger (ok to do this here b/c pass by reference)
					modelParse.send_get(modelParse.triggerList[j], j, false);
				}
				//console.log("parse_data Fcn://\tget sent for peripheral #: " + j + " type: " + modelParse.triggerList[j].channel);
				j++;
			} else {
				j = 0;
			}
		}, 400);
	},

	// handleStop()
	// 		Emergency Stop function.
	//		Stops all motors and exits the state-checking loop.
	//		TODO:
	//			-Also tie this function to the "End of Program" action block, so that the user can programmatically end their code.
	//			
	handleStop: function () { // not currently working.
			// stop all EV3 motors
			this.makeCorsRequest({"status":"set","io_type":"stop all"}, 0, false);
			
			 // stop trigger scanning loop
			clearInterval(delayedLoop);
	},

	// createCORSRequest()
	//		HTTP POST w/ CORS assembly and compatibility checker function.
	//		Sets up an XMLHttpRequest object in the correct format for the browser
	//		Credit for this function goes to CORS tutorial by Monsur Hossain, http://www.html5rocks.com/en/tutorials/cors/
	//		Note: This function does not send the HTTP request, it only builds the object and checks for browser compatibility.
	//
	createCORSRequest: function (method) {
		var xhr = new XMLHttpRequest();
		if ("withCredentials" in xhr) { // confirm browser compatibility
			// Check if the XMLHttpRequest object has a "withCredentials" property.
			// "withCredentials" only exists on XMLHTTPRequest2 objects.
			xhr.open(method, modelParse.url, true);
		} else if (typeof XDomainRequest != "undefined") {
			// Otherwise, check if XDomainRequest.
			// XDomainRequest only exists in IE, and is IE's way of making CORS requests.
			xhr = new XDomainRequest();
			xhr.open(method, modelParse.url);
		} else {
			// Otherwise, CORS is not supported by the browser.
			xhr = null;
		}
		return xhr;
	},

	
	// makeCorsRequest()
	// 		HTTP POST w/ CORS sending and callback handling function.
	//		Calls 'createCORSRequest' to construct a POST request object, then sends the HTTP request.
	//		Contains 'onload' and 'onerror' methods to handle successful and failed HTTP responses respectively.
	//		The 'onload'  method calls the 'callback' function, which processes successful HTTP responses by checking for
	//			state changes, sending the corresponding set instructions if a state change is detected, 
	//			and updating the lastValues object to match that newest response value.
	// 		Credit for the 'makeCoresRequest' function and 'onload'/'onerror' response handling goes to CORS tutorial by Monsur Hossain, http://www.html5rocks.com/en/tutorials/cors/
	//
	makeCorsRequest: function(data, index, isStart) { 
		// start send timer, this prints out the latency between each send and receiving its response.
		//startTime = Date.now();

		var xhr = this.createCORSRequest('POST'); // create XMLHttpRequest object

		if (!xhr) { // prints alert if CORS isn't supported on the user's browser.
			alert('CORS not supported');
			return;
		}

		// manage callbacks from EV3, test for state change, and if a state changed, request the corresponding actions
		function callback(response) {
			//console.log('\t\tcallback FCN://\t' + JSON.stringify(response)); // print out the response to the console
			if (response.value == "Not found") { 
				// response value for invalid instruction format
			}
			else if (response.value == "none") { // response if missing return value on EV3 side
				//console.log(JSON.stringify(response)); // log response
			}
			else if (response.value == 'successful set') {
				//console.log("\t\tcallbackFCN://\tSET response received");
				console.log(JSON.stringify(response)); // log response
			}
			else if (response.value != 'successful set' && response.httpCode == 200) { // if valid data and not the response to a 'set' instruction, it must be a 'get' instruction
				//console.log("\t\tcallback FCN://\tGET response: " + response.value +" received with code: " + response.httpCode);
				//console.log(JSON.stringify(response));// log response

				if (isStart) { // if first time contacting EV3, just add the requested value to lastValues object
					modelParse.lastValues[modelParse.triggerList[index].port] = response.value; // lastValues object is indexed by port name.
					//console.log(modelParse.lastValues[modelParse.triggerList[index].port])
				} 
				else if (modelParse.is_state_change(response.value, modelParse.triggerList[index], modelParse.lastValues[modelParse.triggerList[index].port])) {
					// if not first time contacting the EV3, check if the value has broken the designated threshold

					modelParse.lastValues[modelParse.triggerList[index].port] = response.value; // if a state change occurs, change the last value to be the current value.
					modelParse.send_set(modelParse.triggerList[index].actions); // loop through the outputs for that state change and send set requests for all of them

				}
				else { // if no state change detected, do nothing
					modelParse.lastValues[modelParse.triggerList[index].port] = response.value; // if a state change occurs, change the last value to be the current value.

					// console.log("\t\tcallback FCN://\t No state change detected in trigger #: " + index);
				}
			}
		}

		// Response handlers.
		xhr.onload = function() { // asynchronous event fires when HTTP request send is successful
			console.log ("\txhr.load EVENT://\tstatus is: " + data.status);
			if (data.status === "get") {
				modelParse.triggerList[index].requestPending = false;
			}
			callback(JSON.parse(xhr.responseText)); // callback function handles state change checking and response_log updates
			console.log("\txhr.load EVENT://\trequestPending status is now: " + modelParse.triggerList[index].requestPending);

			//console.log("\txhr.load EVENT://\t Request successfully sent.");
			//var endTime = Date.now(); // timestamp at end of send, used to compute total HTTP send latency
			//console.log("\txhr.onload EVENT://\tmessage sent in: " + (endTime - startTime) + " msec"); // log elapsed send time
		};
		xhr.onerror = function() { // asynchronous event fires when HTTP request fails
			console.log('\txhr.onerror EVENT://\tWoops, there was an error making the request.');
			console.log ("\txhr.onerror EVENT://\tstatus is: " + data.status);
			if (data.status === "get") {
				modelParse.triggerList[index].requestPending = false;
			}
			console.log("\txhr.onerror EVENT://\trequestPending status is now: " + modelParse.triggerList[index].requestPending);

			//var endTime = Date.now(); // timestamp at end of send, used to compute total HTTP send latency
			//console.log("\txhr.onerror EVENT://\tmessage sent in: " + (endTime - startTime) + " msec"); // log elapsed send time
		};

		xhr.send(JSON.stringify(data)); // send the HTTP request
		//console.log("this.makeCorsRequest FCN://\t CORS Request Sent.");
	},


	// is_state_change()
	//		State Change checking function
	//		Compares the value received in a "get" instruction to that trigger's last detected value.
	//			Returns true if the value broke the set threshold, returns false if not.
	//		Currently is only implemented for the EV3 touch sensor
	//		TODO:
	//			-Implement state change detection for all GrovePI inputs
	//
	is_state_change: function(response, thisTrigger, lastVal) {
		//console.log("trigger is: ");
		//console.log(thisTrigger);
		//console.log("last value: " + lastVal);
		if (response === "program start"){
			return false;
		}
		else if (thisTrigger.mode === "press") { // if current button state is different from last state and is now pressed
			if ((lastVal != response) && (response == 1)) {
				//console.log("is_state_change Fcn://\t button press state change detected");
				return true;
			}
		}
		else if (thisTrigger.mode === "release") { // if current button state is different from last state and is now released
			if ((lastVal != response) && (response == 0)) {
				//console.log("is_state_change Fcn://\t button release state change detected");
				return true;
			}
		}
		else if (thisTrigger.mode === "switchColor") {
			 if((thisTrigger.settings.transitionType === "to") && (lastVal != response) && (response == thisTrigger.settings.color)) {
				return true;
			}
			else if ((thisTrigger.settings.transitionType === "from") && (lastVal == response) && (response != thisTrigger.settings.color)) {
				return true;
			}
		}
		else if (thisTrigger.mode === "countExceeds") {
			if ((lastVal < parseThreshold(thisTrigger.settings.threshold)) && (response >= parseThreshold(thisTrigger.settings.threshold))) {
				return true;
			}
		}
		else if (this.detect_comparison(thisTrigger.settings.comparisonType) === "passes above") {
			if ((lastVal < parseThreshold(thisTrigger.settings.threshold)) && (response >= parseThreshold(thisTrigger.settings.threshold))) {
				return true;
			}
		}
		else if (this.detect_comparison(thisTrigger.settings.comparisonType) === "passes below") {
			if ((lastVal > parseThreshold(thisTrigger.settings.threshold)) && (response <= parseThreshold(thisTrigger.settings.threshold))) {
				return true;
			}
		}

		/* FORMAT:
		else if((CONFIRM COMPARISON TYPE) && (CHECK THAT LAST VALUE DID NOT BREAK THE THRESHOLD) && (CHECK THAT THE RESPONSE BREAKS THE THRESHOLD)) {
			return true;
		}
		*/

		// if no state change detected
		return false;
	},

	parseThreshold: function(threshold) {
		if (threshold === "dark") {
			return 30;
		}
		else if (threshold === "dim") {
			return 45;
		}
		else if (threshold === "bright") {
			return 60;
		} 
		return threshold;
	},

	detect_comparison: function(comparison) {
		if (comparison === "above" || comparison === "exit") {
			return "passes above";
		}
		else if (comparison === "below" || comparison === "enter") {
			return "passes below";
		}
	},

	// Dictionary object for parsing the port names to a EV3-recognizable format.
	// 		TODO:
	//			-Add GrovePI port mapping capability
	//
	parsePortTranslations: { // dictionary to convert port names to EV3 readable format
		"ev3PortA":"outA",
		"ev3PortB":"outB",
		"ev3PortC":"outC",
		"ev3PortD":"outD",
		"ev3Port1":"in1",
		"ev3Port2":"in2",
		"ev3Port3":"in3",
		"ev3Port4":"in4",
		"ev3Brick":"onboard"
	},

	// parse_port()
	//		Function uses the 'parsePortTranslations' object to map the EV3 port names.
	//
	parse_port: function(portName) {
		if (!portName) {
			return this.parsePortTranslations["ev3Brick"];
		}
		else {
			return this.parsePortTranslations[portName];
		}
	},

	// Dictionary object for parsing peripheral names to an EV3-recognizable format.
	//	TODO:
	//		-Add all GrovePI peripherals.
	//
	parseNameTranslations: {
		"ev3TouchSensor":"touch",
		"ev3UltrasonicSensor":"ultrasonic", 
		"ev3ColorSensor":"color",
		"ev3GyroSensor":"gyro",
		"ev3BrickButton":"nav button",
		"ev3BrickLight":"led",
		"ev3BrickSound":"sound",
		"ev3LargeMotor":"large motor",
		"ev3MediumMotor":"medium motor",
		"program":"stop all"
	},

	// parse_name()
	//		Function uses the 'parseNameTranslations' object to map the EV3 peripheral names.
	//		All name outputs of the 'parseNameTranslations' dictionary must match the channel names used to call the get and set functions used here.
	//
	parse_name: function(io_type) {
		return this.parseNameTranslations[io_type];
	},


	// send_get()
	//		'get' instruction assembly and sending function
	//		Constructs 'get' instruction object as a JSON formatted string and 
	//			sends it via HTTP POST request using the 'makeCorsRequest()' function.
	//		Currently is only configured for interactions with the EV3.
	//		TODO:
	//			-Add port and peripheral name mapping for the GrovePI.
	//			-Handle sending to different url's 
	//				(we probably need to store the URL for each connected device with its
	//					corresponding triggers so we can dynamically handle multiple devices)
	//
	send_get: function(trig,index,isFirst) {
		/*SEND A REQUEST WITH:*/
		var getInstruction = {};
		getInstruction.status = "get";
		getInstruction.io_type = this.parse_name(trig.channel);
		getInstruction.port = this.parse_port(trig.port);
		getInstruction.settings = this.access_io_builder("get",trig);


		//console.log("-------------------------------------------------------");
		//console.log(getInstruction); // print the get instruction to the console

		/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
		// var destinationURL = trig.deviceURL; // maybe adding a field to each trigger encoding the URL of the device it goes with could be used to allow multi-device handling.
		//										// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
		***************************END PSEUDOCODE*******************************/

		this.makeCorsRequest(getInstruction,index,isFirst); // send the 'get' instruction via HTTP POST request
	},


	// send_set()
	//		'set' instruction assembly and sending function
	//		Constructs 'set' instruction object as a JSON formatted string and 
	//			sends it via HTTP POST request using the 'makeCorsRequest()' function.
	//		Currently is only configured for interactions with the EV3.
	//		TODO:
	//			-Add port and peripheral name mapping for the GrovePI.
	//			-Handle sending to different url's 
	//				(Same as with the 'send_get()' function, we probably need to store the URL for each connected device with its
	//					corresponding actions so we can dynamically handle multiple devices)
	//
	send_set: function(action_arr) {
		var len = action_arr.length;
		for (var k = 0; k < len; k++) {

			var setInstruction = {};
			setInstruction.status = "set";
			setInstruction.io_type = this.parse_name(action_arr[k].channel);
			setInstruction.port = this.parse_port(action_arr[k].port);
			setInstruction.settings = this.access_io_builder("set",action_arr[k]);

			console.log("-------------------------------------------------------");
			console.log(setInstruction); // print the set instruction to the console
			console.log(JSON.stringify(setInstruction));

			/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
			// var destinationURL = action_arr[k].deviceURL; // maybe adding a field to each action encoding the URL of the device it goes with could be used to allow multi-device handling.
			//												// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
			***************************END PSEUDOCODE*******************************/

			this.makeCorsRequest(setInstruction,k,false); // send the 'set' instruction via HTTP POST request
		}
	},


	ioBuilderFunctions: {
		"get": {
			"touch": function(trigger) { // this.get_touch
				var touchSettings = {};
				if (trigger.mode === "press" || trigger.mode === "release") {
					touchSettings.touch_mode = "raw_touch";
				}
				else if (trigger.mode === "countExceeds") {
					touchSettings.touch_mode = "count";
				}
				return touchSettings;
			},
			"ultrasonic": function(trigger) { //this.get_ultrasonic
				var ultrasonicSettings = {};
				if (trigger.mode === "distancePasses") {
					ultrasonicSettings.us_mode = "distance";

					if (trigger.settings.units === "inches") {
						ultrasonicSettings.units = "in";
					}
					else if (trigger.settings.units === "centimeters") {
						ultrasonicSettings.units = "cm";
					}
				}
				return ultrasonicSettings;
			},
			"color": function(trigger) { //this.get_color
				var colorSettings = {};
				if (trigger.mode === "switchColor") {
					colorSettings.color_mode = "color";
				}
				else if (trigger.mode === "reflectedLightPasses") {
					colorSettings.color_mode = "reflected";
				}
				else if (trigger.mode === "ambientLightPasses") {
					colorSettings.color_mode = "ambient";
				}
				else if (trigger.mode === "rgbValuePasses") {
					colorSettings.color_mode ="rgb_raw";
				}
				return colorSettings;
			},
			"gyro": function(trigger) { //this.get_gyro
				var gyroSettings = {};
				if (trigger.mode === "positionPasses") {
					gyroSettings.gyro_mode = "position";

					if (trigger.settings.units === "degrees") {
						gyroSettings.units = "deg";
					}
					else if (trigger.settings.units === "rotations") {
						gyroSettings.units = "rot";
					}
				}
				else if (trigger.mode === "ratePasses") {
					gyroSettings.gyro_mode = "rate";

					if (trigger.settings.units === "deg/sec") {
						gyroSettings.units = "deg_per_sec";
					}
					else if (trigger.settings.units === "rot/sec") {
						gyroSettings.units = "rot_per_sec";
					}
				}
				return gyroSettings;
			},
			"large motor": function(trigger) { //this.get_l_motor
				var lMotorSettings = {};
				if (trigger.mode === "positionPasses") {
					lMotorSettings.motor_mode = "position";

					if (trigger.settings.units === "degrees") {
						lMotorSettings.units = "deg";
					}
					else if (trigger.settings.units === "rotations") {
						lMotorSettings.units = "rot";
					}
				}
				else if (trigger.mode === "ratePasses") {
					lMotorSettings.motor_mode = "rate";

					if (trigger.settings.units === "deg/sec") {
						lMotorSettings.units = "deg_per_sec";
					}
					else if (trigger.settings.units === "rot/sec") {
						lMotorSettings.units = "rot_per_sec";
					}
				}
				return lMotorSettings;
			},
			"medium motor": function(trigger) { //this.get_m_motor,
				var mMotorSettings = {};
				if (trigger.mode === "positionPasses") {
					mMotorSettings.motor_mode = "position";

					if (trigger.settings.units === "degrees") {
						mMotorSettings.units = "deg";
					}
					else if (trigger.settings.units === "rotations") {
						mMotorSettings.units = "rot";
					}
				}
				else if (trigger.mode === "ratePasses") {
					mMotorSettings.motor_mode = "rate";

					if (trigger.settings.units === "deg/sec") {
						mMotorSettings.units = "deg_per_sec";
					}
					else if (trigger.settings.units === "rot/sec") {
						mMotorSettings.units = "rot_per_sec";
					}
				}
				return mMotorSettings;
			},
			//"infrared": function(trigger) //this.get_infrared 
			"nav button": function(trigger) { //this.get_brick_button
				var brickButtonSettings = {};
				if (trigger.mode === "press" || trigger.mode === "release") {
					brickButtonSettings.touch_mode = "raw_touch";
					brickButtonSettings.button = trigger.settings.button;
				}
				else if (trigger.mode === "countExceeds") {
					brickButtonSettings.touch_mode = "count";
					brickButtonSettings.button = trigger.settings.button;
				}
				return brickButtonSettings;
			}
		},
		"set": {
			"large motor": function(action) { //this.set_l_motor,
				var lMotorSettings = {};
				var sign = {
					"forward": 1,
					"backward": -1
				};
				var powerLevel = {
					"high": 100,
					"medium": 66,
					"low": 33
				};

				if (action.mode === "start") {
					lMotorSettings.motor_mode = "run forever";
					lMotorSettings.power = powerLevel[action.settings.power] * sign[action.settings.direction];
				}
				else if (action.mode === "switchDirection") {
					lMotorSettings.motor_mode === "switch";
				}
				else if (action.mode === "stop") {
					lMotorSettings.motor_mode = "stop";
					lMotorSettings.stop_type = action.settings.stopType;
					lMotorSettings.power = 25; // temporary for stop testing, for some reason a power value is still needed for multi-send only (single-send works without it) even though the EV3 throws that value away, not sure why...
				}
				else if (action.mode === "resetEncoders") {
					lMotorSettings.motor_mode = "reset"; // Not yet implemented on EV3
				}
				return lMotorSettings;
			},
			"medium motor": function(action) { //this.set_m_motor,
				var mMotorSettings = {};
				var sign = {
					"forward": 1,
					"backward": -1
				};
				var powerLevel = {
					"high": 100,
					"medium": 66,
					"low": 33
				};

				if (action.mode === "start") {
					mMotorSettings.motor_mode = "run forever";
					mMotorSettings.power = powerLevel[action.settings.power] * sign[action.settings.direction];
				}
				else if (action.mode === "switchDirection") {
					mMotorSettings.motor_mode === "switch";
				}
				else if (action.mode === "stop") {
					mMotorSettings.motor_mode = "stop";
					mMotorSettings.stop_type = action.settings.stopType;
					mMotorSettings.power = 25; // temporary for stop testing
				}
				else if (action.mode === "resetEncoders") {
					mMotorSettings.motor_mode = "reset"; // Not yet implemented on EV3
				}
				return mMotorSettings;
			},
			"sound": function(action) { //this.set_sound
				var soundSettings = {};
				if (action.mode === "playTone") {
					soundSettings.sound_mode = "tone";
					soundSettings.frequency = action.settings.frequency;
					soundSettings.volume = action.settings.volume;
					soundSettings.duration = action.settings.duration;
				}
				else if (action.mode === "playNote") {
					soundSettings.sound_mode = "note";
					soundSettings.note = action.settings.note;
					soundSettings.octave = action.settings.octave;
					soundSettings.volume = action.settings.volume;
					soundSettings.duration =  action.settings.duration;
				}
				else if (action.mode === "playFile") {
					soundSettings.sound_mode = "file";
					soundSettings.filename = action.settings.filename;
					soundSettings.volume = action.settings.volume;
				}
				else if (action.settings.mode === "textToSpeech") {
					soundSettings.sound_mode = "speech";
					soundSettings.message = action.settings.message;
					soundSettings.volume = action.settings.volume;
				}
				return soundSettings;
			},
			"led": function(action) { // this.get_led
				var lightSettings = {};
				if (action.mode === "lightOn"){
					lightSettings.led_mode = "on";
					lightSettings.brick_lights = "both"; // the ev3 can display up to two colors at a time, to include that, add "right" and "left" as "brick_lights" options in the interface
					lightSettings.color = action.settings.color;
				}
				else if (action.mode === "lightOff") {
					lightSettings.led_mode = "off";
				}
				return lightSettings;
			}
		}
	},

	access_io_builder: function(status, io_object) {
		//console.log("status is: " + status);
		//console.log("io_object channel is: ");
		//console.log(this.parse_name(io_object.channel));
		//console.log("ioBuilderFunction Dictionary is: ");
		//console.log(this.ioBuilderFunctions[status][this.parse_name(io_object.channel)]);
		return this.ioBuilderFunctions[status][this.parse_name(io_object.channel)](io_object);
	}
};