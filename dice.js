goog.provide('goog.hangouts.HangoutUserData');

goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('goog.json');
goog.require('goog.object');


window.onload = (function () {

var Event = goog.events.Event;
var EventTarget = goog.events.EventTarget;
var base = goog.base;
var bind = goog.bind;
var json = goog.json;
var hangout = gapi.hangout;
var data = gapi.hangout.data;

/**
 * @param {string} id A unique id to be used to identify the shared data.
 * @param {*} initialValue The initial value for the local user.
 * @constructor
 */
goog.hangouts.HangoutUserData = function(id, initialValue) {
  if (id.indexOf('$') != -1) throw 'Ids cannot contain $.';
  if (!goog.isDef(initialValue)) throw 'initialValue must be defined';

  base(this);

  this.id_ = id;
  this.keyPrefix_ = id + '$';
  this.key_ = this.keyPrefix_ + hangout.getParticipantId();
  this.dataCallback_ = bind(this.onStateChanged_, this);
  this.values_ = {};

  data.onStateChanged.add(this.dataCallback_);
  hangout.onParticipantDisabled.add(this.dataCallback_);
  // Force the current value to be reset.
  this.setValue(undefined);
  this.setValue(initialValue);
};
goog.inherits(goog.hangouts.HangoutUserData, EventTarget);


var HangoutUserData = goog.hangouts.HangoutUserData;


HangoutUserData.VALUES_CHANGED_EVENT_TYPE = 'values changed event';


/**
 * @constructor
 */
HangoutUserData.ValuesChangedEvent = function(target, newValues) {
  base(this, HangoutUserData.VALUES_CHANGED_EVENT_TYPE, target);
  this.values = newValues;
};
goog.inherits(HangoutUserData.ValuesChangedEvent, Event);


/**
 * @constructor
 */
HangoutUserData.ParticipantChangedEvent = function(target, participant, value) {
  base (this, participant);
  this.participant = participant;
  this.value = value;
};
goog.inherits(HangoutUserData.ParticipantChangedEvent, Event);


HangoutUserData.prototype.disposeInternal = function() {
  data.onStateChanged.remove(this.dataCallback_);
  hangout.onParticipantDisabled.remove(this.dataCallback_);

  base(this, 'disposeInternal');
};


HangoutUserData.prototype.onStateChanged_ = function(event) {

  var state = event.state;
  var newValues = {};
  goog.object.forEach(state, function(value, key) {
    if (key.indexOf(this.keyPrefix_) == 0) {
      var participant = key.substr(this.keyPrefix_.length);
      if (goog.isDefAndNotNull(gapi.hangout.getParticipantById(participant))) {
        var value = state[key];
        newValues[participant] = json.parse(value);
      }
    }
  }, this);

  var oldValues = this.values_;
  this.values_ = newValues;

  // overall change event
  this.dispatchEvent(new HangoutUserData.ValuesChangedEvent(this,
      goog.object.clone(this.values_)));

  // added/changed values
  goog.object.forEach(this.values_, function(value, key) {
    this.dispatchEvent(
        new HangoutUserData.ParticipantChangedEvent(this, key,
            this.values_[key]));
  }, this);

  // removed values
  goog.object.forEach(oldValues, function(value, key) {
    if (!(key in this.values_)) {
      this.dispatchEvent(
          new HangoutUserData.ParticipantChangedEvent(this, key,
              undefined));
    }
  }, this);
};


HangoutUserData.prototype.setValue = function(value) {
  var delta = {};
  delta[this.key_] = json.serialize(value);
  data.submitDelta(delta);
};


HangoutUserData.prototype.getValue = function(participant) {
  return this.values_[participant]
};


HangoutUserData.prototype.participants = function() {
  return goog.object.getKeys(this.values_);
};

}); // end scope


var readyStates;

var start = function() {
  readyStates = new goog.hangouts.HangoutUserData('ReadyState', false);

  function createDiv() {
    return document.createElement('div');
  }

  function createLabel(name) {
    var label = createDiv();
    label.style.display = 'inline-block';
    label.style.padding = '3px';
    label.style.margin = '5px';
    label.textContent = name;
    return label;
  }

  function createButton(label) {
    var button = createLabel(label);
    button.style.borderWidth = '1px';
    button.style.borderStyle = 'solid';
    return button;
  }

  function foreach(values, action) {
    for (var i = 0; i < values.length; i++) {
      action(values[i]);
    }
  }

  function ReadyList() {
    var that = this;
    this.element = createDiv();
    var participants = gapi.hangout.getParticipants();
    var nameOfParticipant = function(p) {
      return (p.person && p.person.displayName) + p.id;
    }
    var createParticipant = function(p) {
      var div = createDiv();
      div.appendChild(createLabel(nameOfParticipant(p)));
      div.appendChild(createButton(readyStates.getValue(p.id)));
      that.element.appendChild(div);
    }
    foreach(participants, createParticipant);
  }

  var list;
  function updateReadyList() {
    if (list) {
      document.body.removeChild(list.element);
    }
    list = new ReadyList();
    document.body.appendChild(list.element);
  }

  updateReadyList();
  readyStates.addEventListener(
      goog.hangouts.HangoutUserData.VALUES_CHANGED_EVENT_TYPE,
      function() { debugger; updateReadyList(); });
};

gapi.hangout.onApiReady.add(start);
