"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

dump("** SyncScheduler.jsm\n");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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
    dump("** init SyncScheduler\n");
    if (!ppmm) {
      return;
    }
    for (let message of this.messages) {
      ppmm.addMessageListener(message, this);
    }
    dump("   ** done with init\n");
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

    dump("** yay! got a message: " + JSON.stringify(msg) + "\n");

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
    dump("$$$ great! you called enqueue\n");
    // this is where we'd subscribe to, say, contacts changes, if the
    // message comes with onChange
    //
    // associate changes with caller ids
    // { 'contacts': [id1, id2, ...] }
    //
    //
  },

  unregister: function(id) {
    dump("$$$ great! you called unregister\n");
  },
};

this.SyncScheduler.init();
