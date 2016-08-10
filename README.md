# Event-Driven Robot Programming

## What is this?
The purpose of this project is to design and implement an event-driven programming interface for the LEGO MINDSTORMS EV3 Robotics System and the Internet of Things.

## Why Event-Driven Programming?
New EV3 users often encounter challenges translating their ideas into functioning code. It seems, intuitively, like the solution to certain problems should be obvious, but it is actually syntactically complex. One such problem is how to perform an operation whenever a certain input happens (for example, play a sound whenever a button is pressed). The solution using procedural program flow requires constant polling using a while loop (likely with switch cases if more than one value needs to be polled for). These data structures, while fundamental to computer programming, can be daunting to new programmers.

A new programmer's first coding experience is often with a procedural system: operations happen in a set order. Yet, the real world is full of systems and processes interacting concurrently, like a state machine. Our proposed event-driven model reflects this reality, putting state changes front and center in each program. Our goal is to create a streamlined interface for event-driven programming, replacing the while-loop-and-case-statement structure and thus lowering the syntactic barrier-to-entry. 

Our event-driven paradigm encourages builders to design robots based on sensor inputs, resulting in more extensive use of the kit’s sensors. It puts the focus of robot design on physical robots rather than on code. Our system is intended primarily as an introduction, an easy way to get a robot to behave how you want it to, and also as a way to easily connect robots to the larger Internet of Things.

## Guide to this Repository

### Prototypes
Several interactive prototypes have been made to demonstrate various aspects of our interface.

#### Drag and Drop
This prototype demonstrates some early ideas of how placing code blocks could work. Future prototypes will likely feature a single channel bank rather than separating channels into "trigger channels" and "action channels."

#### Configurable Layout
This prototype is the most current version. It can represent any simple "When-This-Then-That" program, and export it as a JSON string. Code blocks can be configured in various modes.

#### Communicative Interface
This prototype is a mock-up of a "smart browser, dumb brick" implementation of the configurable interface. It consists of a version of the configurable interface linked to an in-browser program for controlling an EV3 Intelligent Brick.

### Data Transfer Model Examples
Every program that can currently be made in our most current configurable interface prototype can be represented as a JSON string in a certain format. Several examples are included here.

### LabView Code Examples
It is possible to emulate the event-driven behavior in LabView and the standard EV3 firmware. Several examples of LabView code that emulates the desired behavior to varying degrees are ncluded here.

### Device Capabailities
This folder contains lists of commands that can be recognized by connected devices (EV3, Raspberry Pi with the GrovePi sensor suite).

## Instructions for Working on this Project
1. Open the terminal on your computer
2. Install `git` if you don't have it yet
3. Navigate to the folder where you want the project directory to go
4. `git clone https://github.com/CEEO-DrEsLab/event-driven.git`
5. A directory called `event-driven` will have been created. All of the project files from the Master branch should be inside.
6. Use git as normal (`git pull` to update your local repository, `git add` to track files, `git commit -m "message"` to register changes, `git push` to upload committed changes)

## Credit
Made at the LEGO Discovery Lab at the Tufts University Center for Engineering Education and Outreach.