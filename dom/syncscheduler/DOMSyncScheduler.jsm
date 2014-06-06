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

  receiveMessage: function(message) {
    let data = message.data;

    switch (message.name) {
      case "SyncScheduler:RequestSync":
        this.enqueue(data, message.principal);
        break;

      case "SyncScheduler:UnregisterSync":
        this.unregister(data.id, message.principal);
        break;

      default:
        dump("** SyncScheduler got unexpected message: " + data.name + "\n");
        break;
    }
  },

  enqueue: function(message, principal) {
    let appsService = Cc["@mozilla.org/AppsService;1"]
                         .getService(Ci.nsIAppsService);

    if (!principal.appId) {
      dump("!! Sorry, this is a b2g thing only\n");
      return;
    }

    // Enqueue the message in the singleton SyncScheduler toolkit module
    SyncSchedulerService.enqueue(message, principal);
  },

  unregister: function(id) {
    // Unregister the id with the singleton SyncScheduler toolkit module
    SyncSchedulerService.unregister(id);
  },
};

this.SyncScheduler.init();
