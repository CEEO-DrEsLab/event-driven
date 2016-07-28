// Event-Driven EV3 Data Parser: CORS
// By: Benjamin Zackin
// Last Modified: 7/28/16
// Notes: loops through all triggers, asking if they are true. if one is, all
// 		the corresponding actions are set on the brick
//		Added object wrapper to this file
modelParse = {
	url: "http://130.64.94.159:5000",
	lastValues: {},
	config: {},
	trigger_list: {},
	currentValues: {},
	parse_data: function (dataFile) { 
		//Start Data Parsing
		var data = JSON.parse(dataFile);
		console.log("parse_data Fcn://\tJSON parsed to variable 'data'");
		var raw_config = data.portConfig;
		var trigger_list = data.triggers;
		for (portID in raw_config) { // truncate portConfig to only contain assigned ports
			if (raw_config[portID] != "None") {
				config[portID] = raw_config[portID];
			}
		}
		console.log("parse_data Fcn://\tport config truncated");
		var trigger_len = trigger_list.length;
		// preset all the old values (so we can detect state changes!)
		for(var i = 0; i < trigger_len; i++) {
			send_get(config[trigger_list[i].port], trigger_list[i], i, true);
		}
		console.log("parse_data Fcn://\tstart values for all triggers set");
		while(true) {
			for(var j = 0; j < trigger_len; j++) {
				console.log("parse_data Fcn://\t about to send get for trigger #: " + j);
				send_get(config[trigger_list[j].port], trigger_list[j],j,false);
				console.log("parse_data Fcn://\tget sent for peripheral #: " + j + " type: " + config[trigger_list[j].port] + "!!!!!");
				if (is_state_change(currentValues[trigger_list[j]],trigger_list[j],lastValues[trigger_list[j]])) {
					console.log("parse_data Fcn://\t state change detected in: " + config[trigger_list[j].port]);
					lastValues[trigger_list[j]] = currentValues[trigger_list[j]]; // if a state change occurs, change the last value to be the current value.
					send_set(config,trigger_list[j].actions);
					console.log("parse_data Fcn://\t set sent for all corresponding actions! Woohoo!!!!");

				}
			}
		}
	},
	is_state_change: function(response, this_trigger, lastVal) {
		if ((this_trigger.mode == "press_in") && (lastVal != response) && (response == 1)) {
			console.log("is_state_change Fcn://\t button press state change detected");
			return true;
		}
		else if ((this_trigger.mode == "release") && (lastVal != response) && (response == 0)) {
			console.log("is_state_change Fcn://\t button release state change detected");
			return true;
		}
	},

	send_get: function(sensorName,trig,index,isFirst) {
		/*SEND A REQUEST WITH:*/
		var get_str = "{'status':'";
			get_str += "get";
			get_str += "','sm_type':'";
			get_str += sensorName;
			get_str += "','port':'";
			get_str += parse_port(trig.port);
			get_str += "','info':'";
			get_str += trigger_settings(sensorName,trig.settings);
			get_str += "','value':";
			get_str += -1;// dummy value to make this the right number of arguments (EV3 doesn't use value field for "get"s)	
			get_str += "}";
			makeCorsRequest(url,get_str,index,isFirst);	
	},

	send_set: function(full_config,action_arr) {
		var len = action_arr.length;
		for (var k = 0; k < len; k++) {
			/*SEND A REQUEST WITH:*/
			var set_str = "{'status':'";
			set_str = "set";
			set_str += "','sm_type':'";
			set_str += full_config[action_arr[k].port];
			set_str += "','port':'";
			set_str += parse_port(action_arr[k].port);
			set_str += "','info':'";
			set_str += set_act_info(action_arr[k].mode);
			set_str += "','value':";
			set_str += set_act_val(action_arr[k].mode, action_arr[k].settings);
			set_str += "}";
			makeCorsRequest(url,set_str,k,false);
		}
	},

	trigger_settings: function(inputName, setting) {
		if (inputName != "Large Motor" && inputName != "Medium Motor") {
			return "value"; // "value" is used for all sensor
		}
		else {
			return "value"; // change this to whatever the motors need to run
		}
	},

	parseNameTranslations: { // dictionary to convert port names to EV3 readable format
		"A":"outA",
		"B":"outB",
		"C":"outC",
		"D":"outD",
		"1":"in1",
		"2":"in2",
		"3":"in3",
		"4":"in4"
	},

	parse_port: function(portName) {
		return parseNameTranslations[portName];
	},

	set_act_info: function(mode) {
		if (mode == "start_fwd" || mode == "start_bkwd") {
			return "run_forever";
		}
		if (mode == "stop") {
			return "stop";
		}
	},

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
			else if (setting.stopType == "coast") {return "coast";}
		}
	}
}
