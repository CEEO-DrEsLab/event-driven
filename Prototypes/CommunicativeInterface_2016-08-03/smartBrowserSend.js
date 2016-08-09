// Smart Browser Sending Script
// By: Benjamin Zackin
// Last Modified: 8/8/16
// Notes: Handles HTTP request sending and response handling for the Smart Browser setup
//

//var startTime = 0;

//set up and send a CORS HTTP POST request
function createCORSRequest(method, url) {
	var xhr = new XMLHttpRequest();
	if ("withCredentials" in xhr) { // confirm browser compatibility
		// Check if the XMLHttpRequest object has a "withCredentials" property.
		// "withCredentials" only exists on XMLHTTPRequest2 objects.
		xhr.open(method, url, true);
	} else if (typeof XDomainRequest != "undefined") {
		// Otherwise, check if XDomainRequest.
		// XDomainRequest only exists in IE, and is IE's way of making CORS requests.
		xhr = new XDomainRequest();
		xhr.open(method, url);
	} else {
		// Otherwise, CORS is not supported by the browser.
		xhr = null;
	}
	return xhr;
}

// Make the actual CORS request.
function makeCorsRequest(url, data, index, isStart) {
	// start send timer, this prints out the latency between each send and receiving its response.
	//startTime = Date.now();

	var xhr = createCORSRequest('POST', url); // create XMLHttpRequest object

	if (!xhr) { // prints alert if CORS isn't supported on the user's browser.
		alert('CORS not supported');
		return;
	}

	// manage callbacks from EV3, test for state change, and if a state changed, request the corresponding actions
	function callback(response,triggerIndex,firstIter) {
		//console.log('\t\tcallback FCN://\t' + JSON.stringify(response)); // print out the response to the console
		if (response.value == "Not found") { // response value for invalid instruction format

		}
		else if (response.value == "none") { // response value for successful set instruction.
			//console.log(JSON.stringify(response)); // log response
		}
		else if (response.value == 'successful set') {
			//console.log("\t\tcallbackFCN://\tSET response received");
			console.log(JSON.stringify(response)); // log response
		}
		else if (response.value != 'successful set' && response.httpCode == 200){ // if valid data and not the response to a 'set' instruction, it must be a 'get' instruction
			//console.log("\t\tcallback FCN://\tGET response: " + response.value +" received with code: " + response.httpCode);
			//console.log(JSON.stringify(response));// log response

			if (firstIter) { // if first time contacting EV3, just add the requested value to lastValues object
				if (response.value != "program start") {
					modelParse.lastValues[modelParse.triggerList[triggerIndex].port] = response.value; // lastValues object is indexed by port name.
					//console.log(modelParse.lastValues[modelParse.triggerList[triggerIndex].port])
				}
			} 
			else if (modelParse.is_state_change(response.value, modelParse.triggerList[triggerIndex], modelParse.lastValues[modelParse.triggerList[triggerIndex].port])) {
				// if not first time contacting the EV3, check if the value has broken the designated threshold

				modelParse.lastValues[modelParse.triggerList[triggerIndex].port] = response.value; // if a state change occurs, change the last value to be the current value.
				modelParse.send_set(modelParse.triggerList[triggerIndex].actions); // loop through the outputs for that state change and send set requests for all of them

			}
			else { // if no state change detected, do nothing
				modelParse.lastValues[modelParse.triggerList[triggerIndex].port] = response.value; // if a state change occurs, change the last value to be the current value.

				// console.log("\t\tcallback FCN://\t No state change detected in trigger #: " + triggerIndex);
			}
		}
	}

	// Response handlers.
	xhr.onload = function() { // asynchronous event fires when HTTP request send is successful
		callback(JSON.parse(xhr.responseText),index,isStart); // callback function handles state change checking and response_log updates
		//console.log("\txhr.onload EVENT://\t Request successfully sent.");
		//var endTime = Date.now(); // timestamp at end of send, used to compute total HTTP send latency
		//console.log("\txhr.onload EVENT://\tmessage sent in: " + (endTime - startTime) + " msec"); // log elapsed send time
	};
	xhr.onerror = function() { // asynchronous event fires when HTTP request fails
		//console.log('\txhr.onerror EVENT://\tWoops, there was an error making the request.');
		//var endTime = Date.now(); // timestamp at end of send, used to compute total HTTP send latency
		//console.log("\txhr.onerror EVENT://\tmessage sent in: " + (endTime - startTime) + " msec"); // log elapsed send time
	};

	xhr.send(data); // send the HTTP request
	//console.log("makeCorsRequest FCN://\t CORS Request Sent.");
}