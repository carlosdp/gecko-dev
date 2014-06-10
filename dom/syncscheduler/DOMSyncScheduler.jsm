"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/SyncScheduler.jsm");

// This is the parent process corresponding to nsSyncScheduler
this.EXPORTED_SYMBOLS = ["SyncScheduler"];

const DEBUG = true;

function debug(message) {
  if(DEBUG)
    dump("**SYNC: " + message + "\n");
};

XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");

XPCOMUtils.defineLazyServiceGetter(this, "timer",
                                    "@mozilla.org/timer;1",
                                    "nsITimer");

XPCOMUtils.defineLazyGetter(this, "appsService", function() {
  return Cc["@mozilla.org/AppsService;1"].getService(Ci.nsIAppsService);
});

this.SyncScheduler = {
  messages: [
    "SyncScheduler:RequestSync",
    "SyncScheduler:UnregisterSync",
  ],

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsIMessageListener,
                                         Ci.nsISupportsWeakReference]),

  init: function() {
    debug("service init");
    if (!ppmm) {
      return;
    }
    for (let msgName of this.messages) {
      ppmm.addMessageListener(msgName, this);
    }

    this.queue = {};
    this.timerSet = false;
    this.currentId = 0;

    timer.init(this, 5*1000, 0);
  },

  observe: function(subject, topic, data) {
    debug("observe: " + topic);
    switch (topic) {
      case "xpcom-shutdown":
        if (!ppmm) {
          return;
        }
        for (let messsage of this.messages) {
          ppmm.removeMessageListener(message, this);
        }
        break;
      case "timer-callback":
        break;
    }
  },

  processRequests: function() {
    // Here we would check for connection params
    // we would also reset the timer if necessary.
    // This would be the callback for onChange for
    // connections.
    for (let id in this.queue) {
      debug("PROCESS: "+this.queue[id].id);
    }
  },

  receiveMessage: function(message) {
    let data = message.json;

    switch (message.name) {
      case "SyncScheduler:RequestSync":
        this.enqueue(data, message.principal);
        break;

      case "SyncScheduler:UnregisterSync":
        this.unregister(data.id, message.principal);
        break;

      default:
        debug("got unexpected message: " + data.name);
        break;
    }
  },

  enqueue: function(data, principal) {
    if (!principal.appId) {
      debug("Sorry, this is a b2g thing only");
      return;
    }

    this.queue[this.currentId] = data;
    this.currentId++;
    debug("enqueue: " + data.id);

    this.processRequests();
  },

  unregister: function(id) {
    // Unregister the id with the singleton SyncScheduler toolkit module
    SyncSchedulerService.unregister(id);
  },
};

SyncScheduler.init();
