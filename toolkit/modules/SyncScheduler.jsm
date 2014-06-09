/* -*- Mode: js2; js2-basic-offset: 2; indent-tabs-mode: nil; -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

this.EXPORTED_SYMBOLS = ["SyncSchedulerService"];

dump("** Ye Olde Sync Scheduler module\n");

XPCOMUtils.defineLazyGetter(this, "messenger", function() {
  return Cc["@mozilla.org/system-message-internal;1"]
            .getService(Ci.nsISystemMessagesInternal);
});

function Service() {
  dump("** creating toolkit sync scheduler service\n");
  Services.obs.addObserver(this, "quit-application-granted", false);
  // XXX subscribe to app-uninstalled and unregister
}

Service.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports,
                                         Ci.nsIObserver]),

  observe: function (subject, topic, data) {
    switch (topic) {
      case "quit-application-granted":
        this._shutdown();
        break;
    }
  },

  _fireSystemMessage: function(alarm) {
    let message = {
      id: alarm.id,
      date: alarm.date,
      data: alarm.data
    };
    let pageURI = Services.io.newURI(alarm.pageURL, null, null);
    let manifestURI = Services.io.newURI(alarm.manifestURL, null, null);

    messenger.sendMessage("sync", message, pageURI, manifestURI);
  },

  _notifySyncRequester: function(alarm) {
    if (alarm.manifestURL) {
      return this._fireSystemMessage(alarm);
    }
  },
 
  _shutdown: function() {
    dump("** sync scheduler toolkit module shutting down\n");
    Services.obs.removeObserver(this, "quit-application-granted");
  },

  /*
   * Public methods
   */

  enqueue: function(message, principal) {
    let appsService = Cc["@mozilla.org/AppsService;1"]
                         .getService(Ci.nsIAppsService);

    let manifestURL = appsService.getManifestURLByLocalId(principal.appId);
    let pageURL = principal.URI;

    dump("** here's where we stash the manifestURL and pageURL: " +
         manifestURL + ", " + pageURL + "\n");

    dump("** STUB - enqueue: " + JSON.stringify(message) + "\n");

    // XXX for testing, fire a system message right back at the app
    this._notifySyncRequester({
      id: message.id,
      manifestURL: manifestURL,
      pageURL: pageURL,
      date: Date.now(),
      data: "I like pie",
    });
  },

  unregister: function(id) {
    dump("** STUB - unregister: " + id + "\n");
  },

};

this.SyncSchedulerService = new Service();


