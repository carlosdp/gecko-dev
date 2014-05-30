/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

enum IntervalOption {
  "nextOnline",
  "semi-daily",
  "daily",
  "weekly"
};

dictionary RequestSyncParams {
  DOMString? onChange;
  DOMString? entryPoint;
  IntervalOption? interval;
  DOMString? data;
};

[JSImplementation="@mozilla.org/dom/syncscheduler;1",
 NavigatorProperty="syncScheduler"]
interface SyncScheduler {
  void requestSync (DOMString id, optional RequestSyncParams params);
  void unregisterSync (DOMString id);
};
