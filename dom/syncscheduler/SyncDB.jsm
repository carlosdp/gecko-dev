/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["SyncDB"];

/* static functions */
const DEBUG = true;

function debug(aStr) {
  if (DEBUG)
    dump("SyncDB: " + aStr + "\n");
}

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/IndexedDBHelper.jsm");

const SYNCDB_NAME    = "syncs";
const SYNCDB_VERSION = 1;
const SYNCSTORE_NAME = "syncs";

this.SyncDB = function SyncDB() {
  debug("SyncDB()");
}

SyncDB.prototype = {
  __proto__: IndexedDBHelper.prototype,

  init: function init() {
    debug("init()");

    this.initDBHelper(SYNCDB_NAME, SYNCDB_VERSION, [SYNCSTORE_NAME]);
  },

  upgradeSchema: function upgradeSchema(aTransaction, aDb, aOldVersion, aNewVersion) {
    debug("upgradeSchema()");

    let objectStore = aDb.createObjectStore(SYNCSTORE_NAME, { keyPath: "id", autoIncrement: true });

    objectStore.createIndex("syncId",         "syncId",         { unique: false });
    objectStore.createIndex("minInterval",    "minInterval",    { unique: false });
    objectStore.createIndex("repeating",      "repeating",      { unique: false });
    objectStore.createIndex("data",           "data",           { unique: false });
    objectStore.createIndex("pageURL",        "pageURL",        { unique: false });
    objectStore.createIndex("manifestURL",    "manifestURL",    { unique: false });

    debug("Created object stores and indexes");
  },

  /**
   * @param aSync
   *        The record to be added.
   * @param aSuccessCb
   *        Callback function to invoke with result ID.
   * @param aErrorCb [optional]
   *        Callback function to invoke when there was an error.
   */
  add: function add(aSync, aSuccessCb, aErrorCb) {
    debug("add()");

    this.newTxn(
      "readwrite",
      SYNCSTORE_NAME,
      function txnCb(aTxn, aStore) {
        debug("Going to add " + JSON.stringify(aSync));
        aStore.put(aSync).onsuccess = function setTxnResult(aEvent) {
          aTxn.result = aEvent.target.result;
          debug("Request successful. New record ID: " + aTxn.result);
        };
      },
      aSuccessCb,
      aErrorCb
    );
  },

  /**
   * @param aId
   *        The ID of record to be removed.
   * @param aManifestURL
   *        The manifest URL of the app that alarm belongs to.
   *        If null, directly remove the ID record; otherwise,
   *        need to check if the alarm belongs to this app.
   * @param aSuccessCb
   *        Callback function to invoke with result.
   * @param aErrorCb [optional]
   *        Callback function to invoke when there was an error.
   */
  remove: function remove(aId, aManifestURL, aSuccessCb, aErrorCb) {
    debug("remove()");

    this.newTxn(
      "readwrite",
      SYNCSTORE_NAME,
      function txnCb(aTxn, aStore) {
        debug("Going to remove " + aId);

        // Look up the existing record and compare the manifestURL
        // to see if the alarm to be removed belongs to this app.
        aStore.get(aId).onsuccess = function doRemove(aEvent) {
          let alarm = aEvent.target.result;

          if (!alarm) {
            debug("Alarm doesn't exist. No need to remove it.");
            return;
          }

          if (aManifestURL && aManifestURL != alarm.manifestURL) {
            debug("Cannot remove the alarm added by other apps.");
            return;
          }

          aStore.delete(aId);
        };
      },
      aSuccessCb,
      aErrorCb
    );
  },

  /**
   * @param aManifestURL
   *        The manifest URL of the app that syncs belong to.
   *        If null, directly return all syncs; otherwise,
   *        only return the syncs that belong to this app.
   * @param aSuccessCb
   *        Callback function to invoke with result array.
   * @param aErrorCb [optional]
   *        Callback function to invoke when there was an error.
   */
  getAll: function getAll(aId, aSuccessCb, aErrorCb) {
    debug("getAll()");

    this.newTxn(
      "readonly",
      SYNCSTORE_NAME,
      function txnCb(aTxn, aStore) {
        if (!aTxn.result) {
          aTxn.result = [];
        }

        aStore.mozGetAll().onsuccess = function setTxnResult(aEvent) {
          aTxn.result = aEvent.target.result;
          debug("Request successful. Record count: " + aTxn.result.length);
        };
      },
      aSuccessCb,
      aErrorCb
    );
  }
};
