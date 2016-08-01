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
	lastValues: {}, // object that will store the last value of each trigger input
	config: {}, // object for storing the port configuration info
	trigger_list: [], // array of trigger data
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
		this.trigger_list = data.triggers;
		for (portID in data.portConfig) { // truncate portConfig to only contain assigned ports
			if (data.portConfig[portID] != "None") {
				this.config[portID] = data.portConfig[portID];
			}
		}
		//console.log("parse_data Fcn://\tport config truncated");
		var trigger_len = this.trigger_list.length;
		// preset all the old values (so we can detect state changes!)
		for(var i = 0; i < trigger_len; i++) {
			this.send_get(this.config[this.trigger_list[i].port], this.trigger_list[i], i, true);
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
					modelParse.send_get(modelParse.config[modelParse.trigger_list[j].port], modelParse.trigger_list[j], j, false);
					console.log("parse_data Fcn://\tget sent for peripheral #: " + j + " type: " + modelParse.config[modelParse.trigger_list[j].port]);
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
			makeCorsRequest(modelParse.url,'{"status":"set","sm_type":"large motor","port":"outA","info":"stop","value":"break"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","sm_type":"large motor","port":"outB","info":"stop","value":"break"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","sm_type":"large motor","port":"outC","info":"stop","value":"break"}', 0, false);
			makeCorsRequest(modelParse.url,'{"status":"set","sm_type":"large motor","port":"outD","info":"stop","value":"break"}', 0, false);
			
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
	is_state_change: function(response, this_trigger, lastVal) {
		if ((this_trigger.mode == "press_in") && (lastVal != response) && (response == 1)) { // if current button state is different from last state and is now pressed
			console.log("is_state_change Fcn://\t button press state change detected");
			return true;
		}
		else if ((this_trigger.mode == "release") && (lastVal != response) && (response == 0)) { // if current button state is different from last state and is now released
			console.log("is_state_change Fcn://\t button release state change detected");
			return true;
		}
		else if ((this_trigger.mode == "enter_range") && (lastVal > this_trigger.threshold) && (response <= this_trigger.threshold)) { // Ultrasonic sensor implementation
			return true;
		}
		else if ((this_trigger.mode == "exit_range") && (lastVal < this_trigger.threshold) && (response >= this_trigger.threshold)) { // Ultrasonic sensor implementation
			return true;
		}
		else if ((this_trigger.mode == "exit_range") && (lastVal < this_trigger.threshold) && (response >= this_trigger.threshold)) { // Ultrasonic sensor implementation
			return true;
		}
		else if ((this_trigger.mode == "position_passes") && (this_trigger.comparisonType == "<") && (lastVal > this_trigger.threshold) && (response <= this_trigger.threshold)) { // Ultrasonic sensor implementation
			// "degrees" or "rotations"
			return true; // do we need to differentiate for different units or will juliana send them back in the right units??????????????????????????
		}
		else if ((this_trigger.mode == "position_passes") && (this_trigger.comparisonType == ">") && (lastVal < this_trigger.threshold) && (response >= this_trigger.threshold)) { // Ultrasonic sensor implementation
			// "degrees" or "rotations"
			return true;// do we need to differentiate for different units or will juliana send them back in the right units??????????????????????????
		}
		else if ((this_trigger.mode == "rate_passes") && (this_trigger.comparisonType == "<") && (lastVal > this_trigger.threshold) && (response <= this_trigger.threshold)) { // Ultrasonic sensor implementation
			// "deg/sec" or "rot/sec"
			return true; // do we need to differentiate for different units or will juliana send them back in the right units??????????????????????????
		}
		else if ((this_trigger.mode == "rate_passes") && (this_trigger.comparisonType == ">") && (lastVal < this_trigger.threshold) && (response >= this_trigger.threshold)) { // Ultrasonic sensor implementation
			// "deg/sec" or "rot/sec"
			return true;// do we need to differentiate for different units or will juliana send them back in the right units??????????????????????????
		}

		/* FORMAT:
		else if((CONFIRM THE MODE) && (CHECK THAT LAST VALUE DID NOT BREAK THE THRESHOLD) && (CHECK THAT IT BREAKS THE THRESHOLD)) {
			return true;
		}
		*/
		else { // if no state change detected
			return false;
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
	send_get: function(sensorName,trig,index,isFirst) {
		/*SEND A REQUEST WITH:*/
		var get_str = '{"status":"';
			get_str += 'get';
			get_str += '","sm_type":"';
			get_str += this.parse_name(sensorName);
			get_str += '","port":"';
			get_str += this.parse_port(trig.port);
			get_str += '","info":"';
			get_str += this.trigger_settings(sensorName,trig.settings);
			get_str += '","value":';
			get_str += -1;// dummy value to make this the right number of arguments (EV3 doesn't use value field for "get"s)	
			get_str += '}';

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
	send_set: function(full_config,action_arr) {
		var len = action_arr.length;
		for (var k = 0; k < len; k++) {
			/*SEND A REQUEST WITH:*/
			var set_str = '{"status":"';
			set_str += 'set';
			set_str += '","sm_type":"';
			set_str += this.parse_name(full_config[action_arr[k].port]);
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

	// trigger_setting()
	//		Function for inserting trigger setting keys for 'get' instructions.
	//		For 'get' instructions to the EV3's sensors, and only the sensors,
	//			the info field must just be 'value'.  However, other peripherals
	//			may reqire different 'info' arguments. 
	//		TODO:
	//			-Add compatibility for reading the EV3 motor's encoders/ reading their rotation data
	//			-Add compatibility with the GrovePI
	//			-Consider switching to Javascript dictionary mapping (like the ones used for port and sensor name parsing below)
	//
	trigger_settings: function(inputName, setting) {
		if (inputName != "Large Motor" && inputName != "Medium Motor") {
			return "value"; // "value" is used for all EV3 sensors
		}
		else {
			return "value"; // change this to whatever the motors need to run
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
		"4":"in4"
	},

	// parse_port()
	//		Function uses the 'parsePortTranslations' object to map the EV3 port names.
	//
	parse_port: function(portName) {
		return this.parsePortTranslations[portName];
	},

	// Dictionary object for parsing peripheral names to an EV3-recognizable format.
	//	TODO:
	//		-Add the rest of the EV3 peripherals (ultrasonic, color, gyro, brick sound, brick light)
	//		-Add all GrovePI peripherals.
	//
	parseNameTranslations: {
		"Touch Sensor":"touch",
		"Ultrasonic Sensor":"", // fill these in!!
		"Color Sensor":"",// fill these in!!
		"Gyro Sensor":"",// fill these in!!
		"Brick Button":"",// fill these in!!
		"Brick Light":"",// fill these in!!
		"Brick Sound":"",// fill these in!!

		"Large Motor":"large motor",
		"Medium Motor":"medium motor"
	},

	// parse_name()
	//		Function uses the 'parseNameTranslations' object to map the EV3 peripheral names.
	//
	parse_name: function(sm_type) {
		return this.parseNameTranslations[sm_type];
	},

	// set_act_info()
	//		Function parses the action's mode to match the EV3's corresponding command
	//		TODO: 
	//			-Add the rest of the EV3's outputs (Brick lights, Brick sounds, etc) here and to the data model
	//			-Add all GrovePI output peripherals
	//			-Consider switching to Javascript dictionary mapping (like the ones used for port and sensor name parsing above)
	//			
	set_act_info: function(mode) {
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
