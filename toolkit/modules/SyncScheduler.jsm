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

function Service() {
  dump("** creating toolkit sync scheduler service\n");
  Services.obs.addObserver(this, "quit-application-granted", false);
}

Service.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports,
                                         Ci.nsIObserver]),

  observe: function (subject, topic, data) {
    switch (topic) {
      case "quit-application-granted":
        this.shutdown();
        break;
    }
  },

  shutdown: function() {
    dump("** sync scheduler toolkit module shutting down\n");
    Services.obs.removeObserver(this, "quit-application-granted");
  },

  enqueue: function(message, principal) {
    let appsService = Cc["@mozilla.org/AppsService;1"]
                         .getService(Ci.nsIAppsService);

    let manifestURL = appsService.getManifestURLByLocalId(principal.appId);
    let pageURL = principal.URI;

    dump("** here's where we stash the manifestURL and pageURL: " +
         manifestURL + ", " + pageURL + "\n");

    dump("** STUB - enqueue: " + JSON.stringify(message) + "\n");
  },

  unregister: function(id) {
    dump("** STUB - unregister: " + id + "\n");
  }

};

this.SyncSchedulerService = new Service();


