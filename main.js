#!/usr/bin/env node
"use strict";
const _ = require('lodash');
const util = require('util');
const rest = require('restler');
const argv = require('optimist')
        .default('interval', 2000)
        .usage('Store your hue lights state and restore them after power off\nUsage: $0 --host [string] --username [string]')
        .demand(['host','username'])
        .argv;

let baseUrl = `http://${argv.host}/api/${argv.username}`
let prevStates = {};

let firmwareDefaultState = {
  bri: 254,
  hue: 8418,
  sat: 140,
  xy: [ 0.4573, 0.41 ],
  ct: 366,
  colormode: 'ct'
};

// concentrate
let myDefaultState = {
     bri: 254,
     hue: 39392,
     sat: 13,
     xy: [ 0.3691, 0.3719 ],
     ct: 230,
     colormode: 'xy'
};

function resetLamp(lampName, state) {
  util.log(`going to reset lamp ${lampName}`);
  // only pick the brightness and hue if present in state
  let updatePayload = (state) ? _.pick(state, ['bri', 'hue']) : myDefaultState;

  util.log(updatePayload);
  rest.putJson(`${baseUrl}/lights/${lampName}/state`, updatePayload).on('complete', (data, response) => {
    // TODO handle failure
  });
};

function checkStates() {
  rest.get(baseUrl + '/lights').on('complete', result => {
    if (result instanceof Error) {
      util.log('Error:', result.message);
    } else {
      let states = _.mapValues(result, v => v.state);
      // detect a newly reachable lamp
      _.each(states, (state, lampName) => {
        let currentState = _.pick(state, ['bri', 'hue', 'sat', 'xy', 'ct', 'colormode']);
        let previousState =  _.pick(prevStates[lampName], ['bri', 'hue', 'sat', 'xy', 'ct', 'colormode']);

        if (prevStates[lampName] && (JSON.stringify(currentState) !== JSON.stringify(previousState))) {
          //util.log('state changed', currentState, prevStates[lampName]);
        }

        if (state.reachable && prevStates[lampName] && !prevStates[lampName].reachable) {
          util.log('state changed', state, prevStates);
          resetLamp(lampName, prevStates[lampName]);
        } else {
          if (JSON.stringify(currentState) === JSON.stringify(firmwareDefaultState)) {
              util.log('Light', lampName, 'on default');
              resetLamp(lampName);
          }
        }
      });
      // replace prev states with current
      prevStates = states;
    }
  });
};

util.log('started hue state deamon');
setInterval(checkStates, argv.interval);
