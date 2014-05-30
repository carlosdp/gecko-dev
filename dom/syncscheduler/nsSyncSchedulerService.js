/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {interfaces: Ci, utils: Cu} = Components;

dump("** nsSyncSchedulerService loaded\n");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

this.SyncSchedulerService = function SyncSchedulerService() {
  this.wrappedJSObject = this;
};

this.SyncSchedulerService.prototype = {
  classID: Components.ID("{1260058b-a131-48cd-841f-fa738ba6a0b9}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  observe: (subject, topic, data) => {
    switch (topic) {
      case "app-startup":
        // XXX is this ok on app-startup? or do we need to wait for
        // final-ui-startup for some reason?
        dump("** app-startup - loading SyncScheduler.jsm\n");
        Cu.import("resource://gre/modules/SyncScheduler.jsm");
        SyncScheduler.init();
        break;
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([SyncSchedulerService]);
