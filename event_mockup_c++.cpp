// Event-Driven UM Pseudocode, C++
// By: Ben Zackin
// Created: 7/25/16
// Notes: pseudocode for a LEGO MINDSTORMS EV3 configured as a Useless Machine


struct Touch_Sensors { 
	char[] port;
	bool last_val;// false == unpressed, true == pressed
	bool read_touch() {
			return digitalRead(port); // true == pressed, false == unpressed
	}
};

struct Motors {
	char[] port;
	bool status; // false == off, true == on
	void toggle_motor(int power_level) {
		analogWrite(port, power_level);
	}
	void toggle_motor(bool stop_type) { // overloaded toggle function for stopping
		analogWrite(port, stop_type); // true == brake, false == coast
	}
};

void main() {
	struct Touch_Sensors Touch1;
	Touch1.port = "in1";
	Touch1.last_val = false;

	struct Touch_Sensors Touch2;
	Touch2.port = "in2";
	Touch2.last_val = false;

	struct Motors MotorA
	MotorA.port = "outA";
	MotorA.status = false; // off
	loop();
}

void loop() {
	while(true) {
		// if Touch1 changes to false
		if ((Touch1.read_touch() != Touch1.last_val) && (Touch1.read_touch() == false)) {
			MotorA.toggle_motor(45);
			Touch1.last_val == Touch1.read_touch(); // this may conflict with the next if statement for priority
		}

		if ((Touch1.read_touch() != Touch1.last_val) && (Touch1.read_touch() == true)) {
			MotorA.toggle_motor(-20);
			Touch1.last_val = Touch1.read_touch();
		}

		if ((Touch2.read_touch() != Touch2.last_val) && (Touch2.read_touch() == true)) {
			MotorA.toggle_motor(false); // false == coast
		}
	}
}