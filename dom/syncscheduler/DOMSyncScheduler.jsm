"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/SyncScheduler.jsm");

// This is the parent process corresponding to nsSyncScheduler
this.EXPORTED_SYMBOLS = ["SyncScheduler"];

XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");

this.SyncScheduler = {
  messages: [
    "SyncScheduler:RequestSync",
    "SyncScheduler:UnregisterSync",
  ],

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsIMessageListener,
                                         Ci.nsISupportsWeakReference]),

  init: function() {
    dump("** DOMSyncScheduler init\n");
    if (!ppmm) {
      return;
    }
    for (let message of this.messages) {
      ppmm.addMessageListener(message, this);
    }
  },

  observe: function(subject, topic, data) {
    switch (topic) {
      case "xpcom-shutdown":
        if (!ppmm) {
          return;
        }
        for (let messsage of this.messages) {
          ppmm.removeMessageListener(message, this);
        }
        break;
    }
  },

  receiveMessage: function(data) {
    let msg = data.json;

    dump("** DOMSyncScheduler observed: " + JSON.stringify(msg) + "\n");

    switch (data.name) {
      case "SyncScheduler:RequestSync":
        this.enqueue(msg);
        break;

      case "SyncScheduler:UnregisterSync":
        this.unregister(msg.id);
        break;

      default:
        dump("** SyncScheduler got unexpected message: " + data.name + "\n");
        break;
    }
  },

  enqueue: function(message) {
    // Enqueue the message in the singleton SyncScheduler toolkit module
    SyncSchedulerService.enqueue(message);
  },

  unregister: function(id) {
    // Unregister the id with the singleton SyncScheduler toolkit module
    SyncSchedulerService.unregister(id);
  },
};

this.SyncScheduler.init();
