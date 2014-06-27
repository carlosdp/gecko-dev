/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/SyncDB.jsm");

// This is the parent process corresponding to nsSyncScheduler
this.EXPORTED_SYMBOLS = ["SyncScheduler"];

const DEBUG = true;
const CHECK_INTERVAL = 10;

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

    Services.obs.addObserver(this, "webapps-clear-data",false);

    this.queue = {};
    this.timerSet = false;

    this.currentInterval = CHECK_INTERVAL;

    this._mm = Cc["@mozilla.org/childprocessmessagemanager;1"].getService(Ci.nsISyncMessageSender);

    this.db = new SyncDB();
    this.db.init();

    this.db.getAll(
      "",
      function getAllSuccessCb(aSyncs) {
        debug("Sync from DB: " +
              JSON.stringify(aSyncs));
        this.queue = aSyncs;
        this.processRequests();
      }.bind(this),
      function getAllErrorCb(aErrorMsg) {
      }.bind(this)
    );
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

    let dataConn = null;

    if (mobileConnection)
      dataConn = mobileConnection.getDataConnectionInfo(0);
    let wifiConn = this._mm.sendSyncMessage("WifiManager:getState")[0];

    debug(JSON.stringify(dataConn));
    debug(JSON.stringify(wifiConn));

    if ((dataConn && dataConn.connected) || (wifiConn && wifiConn.status == "connected")) {
      this.currentInterval = 0;

      for (let id in this.queue) {
        // Check for conditions and fire

        let request = this.queue[id];

        if (!request.params.wifiOnly || wifiConn.status == "connected") {
          debug("PROCESS: " + request.id);
          let manifestURI = Services.io.newURI(request.manifestURL, null, null);
          let pageURI = Services.io.newURI(request.pageURL, null, null);
          messenger.sendMessage("sync", request, pageURI, manifestURI);

          if (request.params.repeating) {
            if (request.params.minInterval && (this.currentInterval == 0 || request.params.minInterval < this.currentInterval)) {
              this.currentInterval = request.params.minInterval;
            }
          } else {
            this.db.remove(id, null, function() {
              delete this.queue[id];
            }, function() {
            });
          }
        } else {
          debug(request.id + " requires wifi connection");

          if (request.params.minInterval && (this.currentInterval == 0 || request.params.minInterval < this.currentInterval))
            this.currentInterval = request.params.minInterval;
        }
      }

      if (!this.timerSet && this.currentInterval > 0) {
        timer.init(this, this.currentInterval*1000, 0);
        this.timerSet = true;
      }
    } else {
      debug("Not Connected, try again in 10 sec");

      if (!this.timerSet) {
        this.currentInterval = CHECK_INTERVAL;
        timer.init(this, this.currentInterval*1000, 0);
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

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "webapps-clear-data":
        let params =
          aSubject.QueryInterface(Ci.mozIApplicationClearPrivateDataParams);
        if (!params) {
          debug("Error! Fail to remove scheduled syncs for an uninstalled app.");
          return;
        }

        // Only remove alarms for apps.
        if (params.browserOnly) {
          return;
        }

        let manifestURL = appsService.getManifestURLByLocalId(params.appId);
        if (!manifestURL) {
          debug("Error! Fail to remove scheduled syncs for an uninstalled app.");
          return;

        this.db.getAll(manifestURL,
          function(aSyncs) {
            aSync.forEach(function(aSync) {
              this.db.remove(aSync.id, null, function() {
                delete this.queue[id];
              }, function() {
              });
            }, this);
          }.bind(this),
          function(){}
        );
        break;
    }
  },

  enqueue: function(data, principal) {
    if (!principal.appId) {
      debug("Sorry, this is a b2g thing only");
      return;
    }

    data.id = principal.appId + "+" + data.id;

    this.db.add(
      data,
      function addSuccessCb(aNewId) {
        debug("Callback after adding alarm in database.");

        data['id'] = aNewId;

        this.queue[data.syncId] = data;
        debug("enqueue: " + data.id);

        if (data.params.minInterval && data.params.minInterval > 0 && (this.currentInterval == 0 || data.params.minInterval < this.currentInterval))
          this.currentInterval = data.params.minInterval;

        this.processRequests();
      }.bind(this),
      function addErrorCb(aErrorMsg) {
      }.bind(this)
    );
  },

  unregister: function(id, principal) {
    // Unregister the id with the singleton SyncScheduler toolkit module
    let syncId = principal.appId + "+" + id;
    this.db.remove(syncId, null, function() {
      delete this.queue[syncId];
    }, function() {
    });
  },
};

SyncScheduler.init();
