#Communicative Interface Prototype

## How to Run
1. Download `edp-static-layout-communicative.html`, `edp-cell.html`, `edp-style.css`, `smartBrowserSend.js`, `ev3DataParser.js`, and `bluestud.png` and save them all to single local folder
2. Download and run some web-server host application (`MAMP`/`LAMP`/`WAMP`, etc. for Mac, Linux, and Windows respectively. `MAMP` is confirmed to work for this, although any server will do).
3. Point the web-server application to the folder containing the interface prototype files.
4. Open `edp-static-layout-communicative.html` through the web-server application.

Note: Sample code models for use with this interface can be found in the DataTransferModelExamples folder of this repository.

## Files:
1. `edp-static-layout-communicative.html` - 
2.  
3.  
4.
5. `smartBrowserSend.js` - Headless JavaScript file containing the methods for constructing and sending HTTP POST requests to the target device.  It also handles HTTP responses in a callback function which checks for state changes on the returned data and if true sends the appropriate set instructions.
6. `ev3DataParser.js` - 
