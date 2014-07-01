/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
#ifndef MOZ_B2G
Cu.import('resource://gre/modules/DOMSyncScheduler.jsm');
#endif

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
                                   "@mozilla.org/childprocessmessagemanager;1",
                                   "nsIMessageSender");

XPCOMUtils.defineLazyServiceGetter(this, "uuidgen",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");

XPCOMUtils.defineLazyGetter(this, "appsService", function() {
  return Cc["@mozilla.org/AppsService;1"].getService(Ci.nsIAppsService);
});

function nsSyncScheduler() {
}

nsSyncScheduler.prototype = {

  // nsIDOMGlobalPropertyInitializer
  init: function(window) {
    dump("** init nsDOMSyncScheduler\n");
    // Unique id for this caller.  We do not use the window id, because that
    // is not guaranteed (or even likely) to be unique in a multi-proc world
    // like b2g.

    this._id = uuidgen.generateUUID().toString();
    this._mm = cpmm;
    let principal = this._principal = window.document.nodePrincipal;
    this._pageURL = principal.URI.spec;
    this._manifestURL = appsService.getManifestURLByLocalId(principal.appId);

    Services.obs.addObserver(this, "inner-window-destroyed", false);
  },

  // nsIObserver
  observe: function(subject, topic, data) {
    Services.obs.removeObserver(this, "inner-window-destroyed");
  },

  classID: Components.ID("{c73897ea-ffd2-4df4-bcba-a0636e5d1013}"),

  contractID: "@mozilla.org/dom/syncScheduler;1",

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIDOMGlobalPropertyInitializer,
    Ci.nsISupports,
    Ci.nsIObserver,
    Ci.nsIMessageListener]),

  /*
   * Request to be scheduled for a synchronization opportunity
   * https://github.com/slightlyoff/BackgroundSync/blob/master/explainer.md
   *
   * @string id            The name given to the sync request. This name is
   *                       required to later unregister the request. A new
   *                       request will override an old request with the same id.
   *
   * @object params
   *
   *         onChange:     Temporary and non-standard.  Change listener to
   *                       subscribe to.  One of the identifiers in
   *                       dom/apps/src/PermissionsTable.jsm.
   *
   *         entryPoint:   Temporary and non-standard.  URL entry point to
   *                       be used when awakening an app.
   *
   *         interval:     A choice of nextOnline, semi-daily, daily, and weekly.
   *                       The UA makes no guarantee as to when the event will
   *                       be fired, but takes note of the suggested interval.
   *                       The UA may fire more-or-less frequently than requested
   *                       based on usage.
   *
   *         data:         Any additional data that may be needed by the event.
   *
   *         wifiOnly:     If true, only fire sync event when a wifi connection
   *                       is established.
   *
   */
  requestSync: function(id, params = {}) {
    dump("NSSYNC: " + JSON.stringify(params));
    let message = {
      id: id,
      params: params,
      pageURL: this._pageURL,
      manifestURL: this._manifestURL
    };

    this._mm.sendAsyncMessage("SyncScheduler:RequestSync", message, null, this._principal);
  },

  /*
   * Unregister the sync request with the given id
   */

  unregisterSync: function(id) {
    this._mm.sendAsyncMessage("SyncScheduler:UnregisterSync", {id: id}, null, this._principal);
  },
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([nsSyncScheduler]);
