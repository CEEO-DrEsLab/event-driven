#Communicative Interface Prototype

## Files
#####`bluestud.png`
Background image for the application. Tiled. This file is identical to the one in the "Configurable Interface."
#####`edp-cell.html`
HTML template for the individual code blocks. To be used with the edpCell AngularJS directive. This file is identical to the one in the "Configurable Interface."
#####`edp-static-layout.html`
HTML document for the web application. Uses AngularJS, which must be downloaded from the internet; thus, an internet connection is required to run. This file is identical to the one in the "Configurable Interface."
#####`edp-style.css`
Stylesheet for the web application. This file is identical to the one in the "Configurable Interface."
#####`ev3DataParser.js`
JavaScript file containing the methods for parsing the interface's data model and constructing and sending HTTP POST requests to the target device.  These requests are used to executing the program by managing sensor polling and output value assignment (via 'get' and 'set' instructions) on the target device.


## How to Run
1. Download `edp-static-layout-communicative.html`, `edp-cell.html`, `edp-style.css`, `ev3DataParser.js`, and `bluestud.png` and save them all to single local folder
2. Download and run some web-server host application (`MAMP`/`LAMP`/`WAMP`, etc. for Mac, Linux, and Windows respectively. `MAMP` is confirmed to work for this, although any server will do).
3. Point the web-server application to the folder containing the interface prototype files.
4. Open `edp-static-layout-communicative.html` through the web-server application.

Note: Sample code models for use with this interface can be found in the DataTransferModelExamples folder of this repository.
