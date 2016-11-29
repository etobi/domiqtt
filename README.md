
# DoMiQTT / node-domiqMqtt

## TL;DR

Connects to a Domiq Base (LCN) and translate from and to MQTT.

## What does it?

The DOMIQ base (https://domiq.eu/products/d_bl_1b) is a DIN rail mounted device which connects to LCN (http://lcn.de/) building automation.
Beside of a Abode flash based webinterface it provides a proprietary and text based event stream on TCP port 4224. Using this port one 
can read (almost) all LCN events and also trigger actions.

MQTT (http://mqtt.org/) is a very lightweight protocol for e.g. sensor data. Many home automation systems 
(like OpenHAB http://www.openhab.org/ or Home Assistant https://home-assistant.io/) can talk to MQTT.

This software connects the Domiq's port 4244 on one side and implements a MQTT client to connect to a MQTT broker (e.g. mosquitto https://mosquitto.org) on the other.
Thus it's acting a a bridge and enables software like OpenHAB or Home-Assistant to read from and control LCN based smart homes.

## Requirements

* Domiq base
* a MQTT broker (e.g. mosquitto)
* node.js/npm

## Installation

    git clone https://github.com/etobi/domiqtt.git 
    cd domiqtt
    npm install
    cp defaultConfig.js config.js
    # edit config.js and adjust the IP of the domiq and MQTT
    npm start

## Using

Domiq's LCN "channel" adresses look like this

    LCN.output.0.20.1

* "LCN" - control something with LCN; Domiq also support other systems like SATEL and provides some internal Values ("VAR." / "MEM."), too.
* "output" - adress a output (e.g. for a light) of given LCN module
* "0" - segment address
* "20" - module address
* "1" - which output of this module.
* check Domiq's manual for details

The DoMiQTT will translate these into MQTT topics like

    mqttjs_12345678/james/lcn/LCN/output/0/20/1
    
* "mqttjs_12345678" - SenderID
* "james/lcn" - a custom prefix configuraable in config.js
* "LCN/output/0/20/1" - LCN channel address separated with / ínstead of .

## Ideas

* send MQTT birth/will messages
* more readable LCN/Domiq-address / MQTT-topic mapping
  * mqttjs_12345678/james/lcn/livingroom/light/ceiling instead of mqttjs_12345678/james/lcn/LCN/output/0/20/1
* trigger to read a current LCN value on demand (instead of waiting it to change) (sending "LCN.output.0.20.1=?" to Domiq)
* regulary check all values (sending "?" to domiq) to make sure we dont miss something
* cache LCN values
* calculate ages of changed values
* provide linux init script
* check using MQTT username/password
* more.
