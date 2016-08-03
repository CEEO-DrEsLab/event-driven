// Event-Driven EV3 Data Parser: CORS
// By: Benjamin Zackin
// Last Modified: 8/1/16
// Notes:   Loops through all triggers checking if a state change occurred.
// 				If a state change occurs, sets all the corresponding actions
//			Added object wrapper to this file.  All functions in this file
//				must now be accessed externally as modelParse.myfunction() 
//				and internally as this.myfunction()
//			Added stop function.  This ends the state-change checking loop and
//				stops all active EV3 motors.
//			Added TODO's to the header comments for many of this file's functions,
//				They list some major not-yet-implemented functionalities each function currently lacks.
//
var modelParse = {
	url: "http://130.64.94.159:5000", // storage variable for Juliana's EV3 (running Linux server) that we are using for testing.
	url2: "http://130.64.95.192:5000",
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
						this.triggerList[i].actions[numActs].channel = this.config[this.actions[numActs].port];
					}
				}
			}
			this.send_get(this.triggerList[i], i, true);
		}
		//console.log("parse_data Fcn://\tstart values for all triggers set");
		var j = 0;
		// while(true) {
		// 	console.log("parse_data Fcn://\tinfinite loop entered");
		// 	j = 0;
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
	//		Stops all outputs and exits the state-checking loop.
	//		TODO:
	//			-Make this function accessable from the interface so the user can stop their code's execution at will
	//			-Tie this function to the "End of Program" action block, so that the user can programmatically end their code.
	//			-
	handleStop: function () { // not currently working.
			// stop all EV3 motors
			makeCorsRequest(modelParse.url,'{"status":"set","io_type":"large motor","port":"outA","info":"stop","value":"brake"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","io_type":"large motor","port":"outB","info":"stop","value":"brake"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","io_type":"large motor","port":"outC","info":"stop","value":"brake"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","io_type":"large motor","port":"outD","info":"stop","value":"brake"}', 0, false);
			
			 // stop trigger scanning loop
			clearInterval(delayedLoop);
},

	// is_state_change()
	//		State Change checking function
	//		Compares the value received in a "get" instruction to that trigger's last detected value.
	//			Returns true if the value broke the set threshold, returns false if not.
	//		Currently is only implemented for the EV3 touch sensor
	//		TODO:
	//			-Implement state change detection for EV3 ultrasonic, color, gyro, brick button, etc.
	//			-Consider switching to Javascript dictionary mapping (like the ones used for port and sensor name parsing below)
	//			-Implement state change detection for all GrovePI inputs
	//
	is_state_change: function(response, thisTrigger, lastVal) {
		if ((thisTrigger.mode == "press") && (lastVal != response) && (response == 1)) { // if current button state is different from last state and is now pressed
			console.log("is_state_change Fcn://\t button press state change detected");
			return true;
		}
		else if ((thisTrigger.mode == "release") && (lastVal != response) && (response == 0)) { // if current button state is different from last state and is now released
			console.log("is_state_change Fcn://\t button release state change detected");
			return true;
		}
		else if ((thisTrigger.mode == "switchColor") && (thisTrigger.settings.transitionType == "to") && (lastVal != response) && (response == thisTrigger.settings.color) {
			return true;
		}
		else if ((thisTrigger.mode == "switchColor") && (thisTrigger.settings.transitionType == "from") && (lastVal == response) && (response != thisTrigger.settings.color) {
			return true;
		}
		else if ((thisTrigger.mode == "countExceeds") && (lastVal < thisTrigger.settings.threshold) && (response >= thisTrigger.settings.threshold)) {
			return true;
		}
		else if ((this.detect_comparison(thisTrigger.settings.comparisonType) == "passes above") && (lastVal < thisTrigger.settings.threshold) && (response >= thisTrigger.settings.threshold)) {
			return true;
		}
		else if ((this.detect_comparison(thisTrigger.settings.comparisonType) == "passes below") && (lastVal > thisTrigger.threshold) && (response <= thisTrigger.threshold)) {
			return true;
		}

		/* FORMAT:
		else if((CONFIRM COMPARISON TYPE) && (CHECK THAT LAST VALUE DID NOT BREAK THE THRESHOLD) && (CHECK THAT IT BREAKS THE THRESHOLD)) {
			return true;
		}
		*/
		else { // if no state change detected
			return false;
		}
	},

	detect_comparison: function(comparison) {
		if (comparison == "above" || comparison == "exit" || "countExceeds") {
			return "passes above";
		}
		else if (comparison == "below" || comparison == "enter") {
			return "passes below";
		}
		else if (comparison == "") {}
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
		var get_str = '{"status":"';
			get_str += 'get';
			get_str += '","io_type":"';
			get_str += this.parse_name(trig.channel);
			get_str += '","port":"';
			get_str += this.parse_port(trig.port);
			get_str += '","info":"';
			get_str += this.parse_identifier(trig.mode);
			get_str += '","mode":"';
			get_str += this.get_trigger_units(trig);// dummy value to make this the right number of arguments (EV3 doesn't use value field for "get"s)	
			get_str += '"}';

			/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
			// var destinationURL = trig.deviceURL; // maybe adding a field to each trigger encoding the URL of the device it goes with could be used to allow multi-device handling.
			//										// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
			***************************END PSEUDOCODE*******************************/

			makeCorsRequest(this.url,get_str,index,isFirst); // send the 'get' instruction via HTTP POST request
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
			/*SEND A REQUEST WITH:*/
			var set_str = '{"status":"';
			set_str += 'set';
			set_str += '","io_type":"';
			set_str += this.parse_name(action_arr[k].channel]);
			set_str += '","port":"';
			set_str += this.parse_port(action_arr[k].port);
			set_str += '","info":"';
			set_str += this.set_act_info(action_arr[k].mode);
			set_str += '","value":"';
			set_str += this.set_act_val(action_arr[k].mode, action_arr[k].settings);
			set_str += '"}';

			console.log("-------------------------------------------------------");
			console.log(set_str); // print the set instruction to the console

			/*****************PSEUDOCODE, NOT IMPLEMENTED YET!**********************
			// var destinationURL = action_arr[k].deviceURL; // maybe adding a field to each action encoding the URL of the device it goes with could be used to allow multi-device handling.
			//												// you could then pass in 'destinationURL' instead of the hard coded 'this.url' to the 'makeCorsRequest()' function to send to whichever device you want.
			***************************END PSEUDOCODE*******************************/

			makeCorsRequest(this.url,set_str,k,false); // send the 'set' instruction via HTTP POST request
		}
	},

	// parse_identifier()
	//		Function for inserting trigger setting keys for 'get' instructions.
	//		For 'get' instructions to some EV3 sensors, the info field may just be 'value'.
	//			However, other peripherals may reqire different 'info' arguments. 
	//		TODO:
	//			-Add compatibility for reading the EV3 motor's encoders/ reading their rotation data
	//			-Add compatibility with the GrovePI
	//
	parse_identifier: function(identifier) {
		return parseIdentifierTranslations[identifier];
	},

	// Dictionary object for parsing peripheral identifiers to an EV3-recognizable format.
	//	TODO:
	//		-Add all GrovePI peripherals.
	//
	parseIdentifierTranslations: {
		"press":"value",
		"release":"value",
		"distancePasses":"value",
		//"detectColor":"color"
		"reflectedLightPasses":"value",
		"ambientLightPasses":"value",
		//"rgbValuePasses":"value",
		"positionPasses":"angle",
		"ratePasses":"rate",

		"press":"value",
		"press":"value",
		"press":"value",
	},
	

	// get_trigger_units()
	//		Returns the units field of the input trigger object
	//		For peripherals that measure non-boolean values, return the desired units.
	//			otherwise, we request the raw peripheral value.
	//		TODO:
	//			-Add compatibility with GrovePI
	//
	get_trigger_units: function(trigger){
		if (trigger.channel == "Large Motor" || trigger.channel == "Medium Motor" || trigger.channel == "Ultrasonic Sensor" || trigger.channel == "Gyro Sensor") {
			return trigger.settings.units;
		}
		else if (trigger.channel == "Brick Button") {
			return trigger.settings.button;
		}
		else {
			return "raw";
		}
	},

	// Dictionary object for parsing the port names to a EV3-recognizable format.
	// 		TODO:
	//			-Add onboard EV3 Brick as a port both here and to the data model (to implement Brick Buttons)
	//			-Add GrovePI port mapping capability
	//
	parsePortTranslations: { // dictionary to convert port names to EV3 readable format
		"A":"outA",
		"B":"outB",
		"C":"outC",
		"D":"outD",
		"1":"in1",
		"2":"in2",
		"3":"in3",
		"4":"in4",
		"Brick":"brick"
	},

	// parse_port()
	//		Function uses the 'parsePortTranslations' object to map the EV3 port names.
	//
	parse_port: function(portName) {
		if (!portName) {
			return this.parsePortTranslations["Brick"];
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
		"Touch Sensor":"touch",
		"Ultrasonic Sensor":"ultrasonic", 
		"Color Sensor":"color",
		"Gyro Sensor":"gyro",
		"Brick Button":"nav button",
		"Brick Light":"led",
		"Brick Sound":"sound",
		"Large Motor":"large motor",
		"Medium Motor":"medium motor"
	},

	// parse_name()
	//		Function uses the 'parseNameTranslations' object to map the EV3 peripheral names.
	//
	parse_name: function(io_type) {
		return this.parseNameTranslations[io_type];
	},

	// set_act_info()
	//		Function parses the action's mode to match the EV3's corresponding command
	//		TODO: 
	//			-Add the rest of the EV3's outputs (Brick lights, Brick sounds, etc) here and to the data model
	//			-Add all GrovePI output peripherals
	//			-Consider switching to Javascript dictionary mapping (like the ones used for port and sensor name parsing above)
	//			
	set_act_info: function(mode) {
		if (mode == ""){}
		if (mode == "start_fwd" || mode == "start_bkwd") {
			return "run_forever";
		}
		if (mode == "stop") {
			return "stop";
		}
		// add in action info for all others
	},

	// set_act_val()
	//		Function parses the action's settings to an EV3-recognizable format
	//		TODO:
	//			-Add the rest of the EV3's outputs (Brick lights, Brick sounds, etc) here and to the data model
	//			-Add all GrovePI output peripherals
	//			-Consider switching to Javascript dictionary mapping (like the ones used for port and sensor name parsing above)
	//
	set_act_val: function(mode, settings) {
		if (mode == "start_fwd") {
			if (settings.power == "high") {return 100;}
			else if (settings.power == "medium") {return 66;}
			else if (settings.power == "low") {return 33;}
		} else if (mode == "start_bkwd") {
			if (settings.power == "high") {return -100;}
			else if (settings.power == "medium") {return -66;}
			else if (settings.power == "low") {return -33;}
		}
		else if (mode == "stop") {
			if (settings.stopType == "brake") {return "brake";}
			else if (settings.stopType == "coast") {return "coast";}
		}
		// add in value info for all others
	}
}
