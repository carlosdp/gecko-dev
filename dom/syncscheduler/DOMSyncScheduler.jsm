"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/SyncScheduler.jsm");

// This is the parent process corresponding to nsSyncScheduler
this.EXPORTED_SYMBOLS = ["SyncScheduler"];

const DEBUG = true;
const REFRESH_INTERVAL = 10;

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

XPCOMUtils.defineLazyGetter(this, "messenger", function() {
  return Cc["@mozilla.org/system-message-internal;1"].getService(Ci.nsISystemMessagesInternal);
});

XPCOMUtils.defineLazyGetter(this, "appsService", function() {
  return Cc["@mozilla.org/AppsService;1"].getService(Ci.nsIAppsService);
});

#ifdef MOZ_B2G_RIL
XPCOMUtils.defineLazyServiceGetter(this, "mobileConnection",
                                   "@mozilla.org/ril/content-helper;1",
                                   "nsIMobileConnectionProvider");
#endif

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
        this.timerSet = false;
        this.processRequests();
        break;
    }
  },

  processRequests: function() {
    // Here we would check for connection params
    // we would also reset the timer if necessary.
    // This would be the callback for onChange for
    // connections.

    let dataConn = mobileConnection.getDataConnectionInfo(0);

    if (dataConn && dataConn.connected) {
      for (let id in this.queue) {
        // Check for conditions and fire

        let request = this.queue[id];
        debug("PROCESS: " + request.id);
        let manifestURI = Services.io.newURI(request.manifestURL, null, null);
        let pageURI = Services.io.newURI(request.pageURL, null, null);
        messenger.sendMessage("sync", request, pageURI, manifestURI);
      }
    } else {
      debug("Not Connected, try again in 10 sec");

      if (!this.timerSet) {
        timer.init(this, REFRESH_INTERVAL*1000, 0);
        this.timerSet = true;
      }
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
