
// Event-Driven EV3 Data Parser: CORS
// By: Benjamin Zackin
// Last Modified: 8/3/16
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
	url: "http://130.64.94.159:5000", // storage variable for Juliana's EV3 (running Linux server) that we are using for testing.
	url2: "http://130.64.95.192:5000", // storage variable for Bianca's GrovePI that we are using for testing.
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
		console.log(dataFile);
		//Start Data Parsing
		var data = JSON.parse(dataFile);
		console.log(data);
		console.log("parse_data Fcn://\tJSON parsed to variable 'data'");
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
			if (this.triggerList[i].actions) {
				for (var numActs = 0; numActs < this.triggerList[i].actions.length; numActs++){
					if (!this.triggerList[i].actions[numActs].channel) {
						this.triggerList[i].actions[numActs].channel = this.config[this.triggerList[i].actions[numActs].port];
					}
				}
			}
			if (this.triggerList[triggerIndex].channel === "program") {
				this.send_set(this.triggerList[triggerIndex].actions); // loop through the outputs for that state change and send set requests for all of them
			}
			this.send_get(this.triggerList[i], i, true);
		}
		//console.log("parse_data Fcn://\tstart values for all triggers set");
		var j = 0;
		delayedLoop = setInterval(function(){ 
			console.log("parse_data Fcn://\t delayed loop entered, iteration: " + j);

			if(j < trigger_len) {
			 	//console.log("parse_data Fcn://\t about to send get for trigger #: " + j);
				modelParse.send_get(modelParse.triggerList[j], j, false);
				console.log("parse_data Fcn://\tget sent for peripheral #: " + j + " type: " + modelParse.triggerList[j].channel);
				j++;
			} else {
				j = 0;
			}
		}, 1000);
	},

	// handleStop()
	// 		Emergency Stop function.
	//		Stops all motors and exits the state-checking loop.
	//		TODO:
	//			-Also tie this function to the "End of Program" action block, so that the user can programmatically end their code.
	//			
	handleStop: function () { // not currently working.
			// stop all EV3 motors
			makeCorsRequest(modelParse.url,'{"status":"set","io_type":"large motor","port":"outA","info":"stop all","value":"coast"}', 0, false);
			
			 // stop trigger scanning loop
			clearInterval(delayedLoop);
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
		if (response === "program start"){
			return false;
		}
		if ((thisTrigger.mode === "press") && (lastVal != response) && (response === 1)) { // if current button state is different from last state and is now pressed
			console.log("is_state_change Fcn://\t button press state change detected");
			return true;
		}
		else if ((thisTrigger.mode === "release") && (lastVal != response) && (response === 0)) { // if current button state is different from last state and is now released
			console.log("is_state_change Fcn://\t button release state change detected");
			return true;
		}
		else if ((thisTrigger.mode === "switchColor") && (thisTrigger.settings.transitionType === "to") && (lastVal != response) && (response === thisTrigger.settings.color)) {
			return true;
		}
		else if ((thisTrigger.mode === "switchColor") && (thisTrigger.settings.transitionType === "from") && (lastVal === response) && (response != thisTrigger.settings.color)) {
			return true;
		}
		else if ((thisTrigger.mode === "countExceeds") && (lastVal < parseThreshold(thisTrigger.settings.threshold)) && (response >= parseThreshold(thisTrigger.settings.threshold))) {
			return true;
		}
		else if ((this.detect_comparison(thisTrigger.settings.comparisonType) === "passes above") && (lastVal < parseThreshold(thisTrigger.settings.threshold) && (response >= parseThreshold(thisTrigger.settings.threshold))) {
			return true;
		}
		else if ((this.detect_comparison(thisTrigger.settings.comparisonType) === "passes below") && (lastVal > parseThreshold(thisTrigger.settings.threshold)) && (response <= parseThreshold(thisTrigger.settings.threshold))) {
			return true;
		}

		/* FORMAT:
		else if((CONFIRM COMPARISON TYPE) && (CHECK THAT LAST VALUE DID NOT BREAK THE THRESHOLD) && (CHECK THAT THE RESPONSE BREAKS THE THRESHOLD)) {
			return true;
		}
		*/
		else { // if no state change detected
			return false;
		}
	},

	parseThreshold: function(threshold) {
		if (threshold ==== "dark") {
			return 30;
		}
		else if (threshold ==== "dim") {
			return 45;
		}
		else if (threshold ==== "bright") {
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
		getInstruction.io_type = this.parse_name(trigger.channel);
		getInstruction.port = this.parse_port(trigger.port);
		getInstruction.settings = access_io_builder(trig);


		console.log("-------------------------------------------------------");
		console.log(getInstruction); // print the get instruction to the console

		/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
		// var destinationURL = trig.deviceURL; // maybe adding a field to each trigger encoding the URL of the device it goes with could be used to allow multi-device handling.
		//										// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
		***************************END PSEUDOCODE*******************************/

		makeCorsRequest(this.url,JSON.stringify(getInstruction),index,isFirst); // send the 'get' instruction via HTTP POST request
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
		"ev3MediumMotor":"medium motor"
		"program":"stop all"
	},

	// parse_name()
	//		Function uses the 'parseNameTranslations' object to map the EV3 peripheral names.
	//
	parse_name: function(io_type) {
		return this.parseNameTranslations[io_type];
	},

	access_io_builder: function(io_object, status, channel) {
		return this.ioBuilderFunctions[io_object.status][io_object.channel](io_object);
	},

	ioBuilderFunctions = {
		"get": {
			"Touch Sensor": this.get_touch,
			"Ultrasonic Sensor": this.get_ultrasonic,
			"Color Sensor": this.get_color,
			"Gyro Sensor": this.get_gyro,
			"Large Motor": this.get_l_motor,
			"Medium Motor": this.get_m_motor,
			//"Infrared Sensor": this.get_infrared,
			"Brick Button": this.get_brick_button
		},
		"set": {
			"Program": this.program_stop,
			"Large Motor": this.set_l_motor,
			"Medium Motor": this.set_m_motor,
			"Brick Sound": this.set_sound,
			"Brick Light": this.set_light
		}
	},

	get_touch: function(trigger) {
		var touchSettings = {};
		if (trigger.settings.mode === "press" || trigger.settings.mode === "release") {
			touchSettings.touch_mode = "raw_touch";
		}
		else if (trigger.settings.mode === "countExceeds") {
			touchSettings.touch_mode = "count";
		}
		return touchSettings;
	},

	get_ultrasonic: function(trigger) {
		var ultrasonicSettings = {};
		if (trigger.settings.mode === "distancePasses") {
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

	get_color: function(trigger) {
		var colorSettings = {};
		if (trigger.settings.mode === "switchColor") {
			colorSettings.color_mode = "color";
		}
		else if (trigger.settings.mode === "reflectedLightPasses") {
			colorSettings.color_mode = "reflected";
		}
		else if (trigger.settings.mode === "ambientLightPasses") {
			colorSettings.color_mode = "ambient";
		}
		else if (trigger.settings.mode === "rgbValuePasses") {
			colorSettings.color_mode ="rgb_raw";
		}
		return colorSettings;
	},

	get_gyro: function(trigger) {
		var gyroSettings = {};
		if (trigger.settings.mode === "positionPasses") {
			gyroSettings.gyro_mode = "position";

			if (trigger.settings.units === "degrees") {
				gyroSettings.units = "deg";
			}
			else if (trigger.settings.units === "rotations") {
				gyroSettings.units = "rot";
			}
		}
		else if (trigger.settings.mode === "ratePasses") {
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

	get_l_motor: function(trigger) {
		var lMotorSettings = {};
		if (trigger.settings.mode === "positionPasses") {
			lMotorSettings.motor_mode = "position";

			if (trigger.settings.units === "degrees") {
				lMotorSettings.units = "deg";
			}
			else if (trigger.settings.units === "rotations") {
				lMotorSettings.units = "rot";
			}
		}
		else if (trigger.settings.mode === "ratePasses") {
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

	get_m_motor: function(trigger) {
		var mMotorSettings = {};
		if (trigger.settings.mode === "positionPasses") {
			mMotorSettings.motor_mode = "position";

			if (trigger.settings.units === "degrees") {
				mMotorSettings.units = "deg";
			}
			else if (trigger.settings.units === "rotations") {
				mMotorSettings.units = "rot";
			}
		}
		else if (trigger.settings.mode === "ratePasses") {
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

	get_brick_button: function(trigger) {
		var brickButtonSettings = {};
		if (trigger.settings.mode === "press" || trigger.settings.mode === "release") {
			brickButtonSettings.touch_mode = "raw_touch";
			brickButtonSettings.button = trigger.settings.button;
		}
		else if (trigger.settings.mode === "countExceeds") {
			brickButtonSettings.touch_mode = "count";
			brickButtonSettings.button = trigger.settings.button;
		}
		return brickButtonSettings;
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
			setInstruction.settings = access_io_builder(action_arr[k]);

			console.log("-------------------------------------------------------");
			console.log(setInstruction); // print the set instruction to the console

			/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
			// var destinationURL = action_arr[k].deviceURL; // maybe adding a field to each action encoding the URL of the device it goes with could be used to allow multi-device handling.
			//												// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
			***************************END PSEUDOCODE*******************************/

			makeCorsRequest(this.url,JSON.stringify(setInstruction),k,false); // send the 'set' instruction via HTTP POST request
		}
	},

	set_l_motor: function(action) {
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

		if (action.settings.mode === "start") {
			lMotorSettings.motor_mode = "run_forever";
			lMotorSettings.power = powerLevel[action.settings.power] * sign[action.settings.direction];
		}
		else if (action.settings.mode === "switchDirection") {
			lMotorSettings.motor_mode === "switch";
		}
		else if (action.settings.mode === "stop") {
			lMotorSettings.motor_mode = "stop";
			lMotorSettings.stop_type = action.settings.stopType;
		}
		else if (action.settings.mode === "resetEncoders") {
			lMotorSettings.motor_mode = "reset"; // Not yet implemented on EV3
		}
		return lMotorSettings;
	},

	set_m_motor: function(action) {
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

		if (action.settings.mode === "start") {
			mMotorSettings.motor_mode = "run_forever";
			mMotorSettings.power = powerLevel[action.settings.power] * sign[action.settings.direction];
		}
		else if (action.settings.mode === "switchDirection") {
			mMotorSettings.motor_mode === "switch";
		}
		else if (action.settings.mode === "stop") {
			mMotorSettings.motor_mode = "stop";
			mMotorSettings.stop_type = action.settings.stopType;
		}
		else if (action.settings.mode === "resetEncoders") {
			mMotorSettings.motor_mode = "reset"; // Not yet implemented on EV3
		}
		return mMotorSettings;
	},


	set_sound: function(action) {
		var soundSettings = {};
		if (action.settings.mode === "playTone") {
			soundSettings.sound_mode = "tone";
			soundSettings.frequency = action.settings.frequency;
			soundSettings.volume = action.settings.volume;
			soundSettings.duration = action.settings.duration;
		}
		else if (action.settings.mode === "playNote") {
			soundSettings.sound_mode = "note";
			soundSettings.note = action.settings.note;
			soundSettings.octave = action.settings.octave;
			soundSettings.volume = action.settings.volume;
			soundSettings.duration =  action.settings.duration;
		}
		else if (action.settings.mode === "playFile") {
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

		set_light: function(action) {
		var soundSettings = {};
		if (action.settings.mode === "playTone") {
			soundSettings.sound_mode = "tone";
			soundSettings.frequency = action.settings.frequency;
			soundSettings.volume = action.settings.volume;
			soundSettings.duration = action.settings.duration;
		}
		else if (action.settings.mode === "playNote") {
			soundSettings.sound_mode = "note";
			soundSettings.note = action.settings.note;
			soundSettings.octave = action.settings.octave;
			soundSettings.volume = action.settings.volume;
			soundSettings.duration =  action.settings.duration;
		}
		else if (action.settings.mode === "playFile") {
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

	set_light: function(action) {
		var lightSettings = {};
		if (action.settings.mode === "lightOn"){
			lightSettings.led_mode = "on";
			lightSettings.brick_lights = "both"; // the ev3 can handle different colors at the same time, to include that, encorporate "right" and "left" as options in the interface
			lightSettings.color = action.settings.color;
		}
		else if (action.settings.mode === "lightOff") {
			lightSettings.led_mode = "off";
		}
		return lightSettings;
	},
}