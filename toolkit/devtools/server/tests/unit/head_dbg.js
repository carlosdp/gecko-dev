/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { worker } = Cu.import("resource://gre/modules/devtools/worker-loader.js", {})
const {Promise: promise} = Cu.import("resource://gre/modules/Promise.jsm", {});

const Services = devtools.require("Services");
const DevToolsUtils = devtools.require("devtools/toolkit/DevToolsUtils.js");
const { DebuggerServer } = devtools.require("devtools/server/main");
const { DebuggerServer: WorkerDebuggerServer } = worker.require("devtools/server/main");

// Always log packets when running tests. runxpcshelltests.py will throw
// the output away anyway, unless you give it the --verbose flag.
Services.prefs.setBoolPref("devtools.debugger.log", true);
// Enable remote debugging for the relevant tests.
Services.prefs.setBoolPref("devtools.debugger.remote-enabled", true);

function tryImport(url) {
  try {
    Cu.import(url);
  } catch (e) {
    dump("Error importing " + url + "\n");
    dump(DevToolsUtils.safeErrorString(e) + "\n");
    throw e;
  }
}

tryImport("resource://gre/modules/devtools/dbg-client.jsm");
tryImport("resource://gre/modules/devtools/Loader.jsm");
tryImport("resource://gre/modules/devtools/Console.jsm");

function testExceptionHook(ex) {
  try {
    do_report_unexpected_exception(ex);
  } catch(ex) {
    return {throw: ex}
  }
  return undefined;
}

// Convert an nsIScriptError 'aFlags' value into an appropriate string.
function scriptErrorFlagsToKind(aFlags) {
  var kind;
  if (aFlags & Ci.nsIScriptError.warningFlag)
    kind = "warning";
  if (aFlags & Ci.nsIScriptError.exceptionFlag)
    kind = "exception";
  else
    kind = "error";

  if (aFlags & Ci.nsIScriptError.strictFlag)
    kind = "strict " + kind;

  return kind;
}

// Redeclare dbg_assert with a fatal behavior.
function dbg_assert(cond, e) {
  if (!cond) {
    throw e;
  }
}

// Register a console listener, so console messages don't just disappear
// into the ether.
let errorCount = 0;
let listener = {
  observe: function (aMessage) {
    errorCount++;
    try {
      // If we've been given an nsIScriptError, then we can print out
      // something nicely formatted, for tools like Emacs to pick up.
      var scriptError = aMessage.QueryInterface(Ci.nsIScriptError);
      dump(aMessage.sourceName + ":" + aMessage.lineNumber + ": " +
           scriptErrorFlagsToKind(aMessage.flags) + ": " +
           aMessage.errorMessage + "\n");
      var string = aMessage.errorMessage;
    } catch (x) {
      // Be a little paranoid with message, as the whole goal here is to lose
      // no information.
      try {
        var string = "" + aMessage.message;
      } catch (x) {
        var string = "<error converting error message to string>";
      }
    }

    // Make sure we exit all nested event loops so that the test can finish.
    while (DebuggerServer.xpcInspector.eventLoopNestLevel > 0) {
      DebuggerServer.xpcInspector.exitNestedEventLoop();
    }

    // In the world before bug 997440, exceptions were getting lost because of
    // the arbitrary JSContext being used in nsXPCWrappedJSClass::CallMethod.
    // In the new world, the wanderers have returned. However, because of the,
    // currently very-broken, exception reporting machinery in XPCWrappedJSClass
    // these get reported as errors to the console, even if there's actually JS
    // on the stack above that will catch them.
    // If we throw an error here because of them our tests start failing.
    // So, we'll just dump the message to the logs instead, to make sure the
    // information isn't lost.
    dump("head_dbg.js observed a console message: " + string + "\n");
  }
};

let consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
consoleService.registerListener(listener);

function check_except(func)
{
  try {
    func();
  } catch (e) {
    do_check_true(true);
    return;
  }
  dump("Should have thrown an exception: " + func.toString());
  do_check_true(false);
}

function testGlobal(aName) {
  let systemPrincipal = Cc["@mozilla.org/systemprincipal;1"]
    .createInstance(Ci.nsIPrincipal);

  let sandbox = Cu.Sandbox(systemPrincipal);
  sandbox.__name = aName;
  return sandbox;
}

function addTestGlobal(aName, aServer = DebuggerServer)
{
  let global = testGlobal(aName);
  aServer.addTestGlobal(global);
  return global;
}

// List the DebuggerClient |aClient|'s tabs, look for one whose title is
// |aTitle|, and apply |aCallback| to the packet's entry for that tab.
function getTestTab(aClient, aTitle, aCallback) {
  aClient.listTabs(function (aResponse) {
    for (let tab of aResponse.tabs) {
      if (tab.title === aTitle) {
        aCallback(tab);
        return;
      }
    }
    aCallback(null);
  });
}

// Attach to |aClient|'s tab whose title is |aTitle|; pass |aCallback| the
// response packet and a TabClient instance referring to that tab.
function attachTestTab(aClient, aTitle, aCallback) {
  getTestTab(aClient, aTitle, function (aTab) {
    aClient.attachTab(aTab.actor, aCallback);
  });
}

// Attach to |aClient|'s tab whose title is |aTitle|, and then attach to
// that tab's thread. Pass |aCallback| the thread attach response packet, a
// TabClient referring to the tab, and a ThreadClient referring to the
// thread.
function attachTestThread(aClient, aTitle, aCallback) {
  attachTestTab(aClient, aTitle, function (aResponse, aTabClient) {
    function onAttach(aResponse, aThreadClient) {
      aCallback(aResponse, aTabClient, aThreadClient);
    }
    aTabClient.attachThread({ useSourceMaps: true }, onAttach);
  });
}

// Attach to |aClient|'s tab whose title is |aTitle|, attach to the tab's
// thread, and then resume it. Pass |aCallback| the thread's response to
// the 'resume' packet, a TabClient for the tab, and a ThreadClient for the
// thread.
function attachTestTabAndResume(aClient, aTitle, aCallback) {
  attachTestThread(aClient, aTitle, function(aResponse, aTabClient, aThreadClient) {
    aThreadClient.resume(function (aResponse) {
      aCallback(aResponse, aTabClient, aThreadClient);
    });
  });
}

/**
 * Initialize the testing debugger server.
 */
function initTestDebuggerServer(aServer = DebuggerServer)
{
  aServer.registerModule("devtools/server/actors/script");
  aServer.registerModule("xpcshell-test/testactors");
  // Allow incoming connections.
  aServer.init(function () { return true; });
}

function initTestTracerServer(aServer = DebuggerServer)
{
  aServer.registerModule("devtools/server/actors/script");
  aServer.registerModule("xpcshell-test/testactors");
  aServer.registerModule("devtools/server/actors/tracer");
  // Allow incoming connections.
  aServer.init(function () { return true; });
}

function finishClient(aClient)
{
  aClient.close(function() {
    do_test_finished();
  });
}

/**
 * Takes a relative file path and returns the absolute file url for it.
 */
function getFileUrl(aName, aAllowMissing=false) {
  let file = do_get_file(aName, aAllowMissing);
  return Services.io.newFileURI(file).spec;
}

/**
 * Returns the full path of the file with the specified name in a
 * platform-independent and URL-like form.
 */
function getFilePath(aName, aAllowMissing=false)
{
  let file = do_get_file(aName, aAllowMissing);
  let path = Services.io.newFileURI(file).spec;
  let filePrePath = "file://";
  if ("nsILocalFileWin" in Ci &&
      file instanceof Ci.nsILocalFileWin) {
    filePrePath += "/";
  }
  return path.slice(filePrePath.length);
}

Cu.import("resource://gre/modules/NetUtil.jsm");

/**
 * Returns the full text contents of the given file.
 */
function readFile(aFileName) {
  let f = do_get_file(aFileName);
  let s = Cc["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Ci.nsIFileInputStream);
  s.init(f, -1, -1, false);
  try {
    return NetUtil.readInputStreamToString(s, s.available());
  } finally {
    s.close();
  }
}

function writeFile(aFileName, aContent) {
  let file = do_get_file(aFileName, true);
  let stream = Cc["@mozilla.org/network/file-output-stream;1"]
    .createInstance(Ci.nsIFileOutputStream);
  stream.init(file, -1, -1, 0);
  try {
    do {
      let numWritten = stream.write(aContent, aContent.length);
      aContent = aContent.slice(numWritten);
    } while (aContent.length > 0);
  } finally {
    stream.close();
  }
}

function connectPipeTracing() {
  return new TracingTransport(DebuggerServer.connectPipe());
}

function TracingTransport(childTransport) {
  this.hooks = null;
  this.child = childTransport;
  this.child.hooks = this;

  this.expectations = [];
  this.packets = [];
  this.checkIndex = 0;
}

function deepEqual(a, b) {
  if (a === b)
    return true;
  if (typeof a != "object" || typeof b != "object")
    return false;
  if (a === null || b === null)
    return false;
  if (Object.keys(a).length != Object.keys(b).length)
    return false;
  for (let k in a) {
    if (!deepEqual(a[k], b[k]))
      return false;
  }
  return true;
}

TracingTransport.prototype = {
  // Remove actor names
  normalize: function(packet) {
    return JSON.parse(JSON.stringify(packet, (key, value) => {
      if (key === "to" || key === "from" || key === "actor") {
        return "<actorid>";
      }
      return value;
    }));
  },
  send: function(packet) {
    this.packets.push({
      type: "sent",
      packet: this.normalize(packet)
    });
    return this.child.send(packet);
  },
  close: function() {
    return this.child.close();
  },
  ready: function() {
    return this.child.ready();
  },
  onPacket: function(packet) {
    this.packets.push({
      type: "received",
      packet: this.normalize(packet)
    });
    this.hooks.onPacket(packet);
  },
  onClosed: function() {
    this.hooks.onClosed();
  },

  expectSend: function(expected) {
    let packet = this.packets[this.checkIndex++];
    do_check_eq(packet.type, "sent");
    do_check_true(deepEqual(packet.packet, this.normalize(expected)));
  },

  expectReceive: function(expected) {
    let packet = this.packets[this.checkIndex++];
    do_check_eq(packet.type, "received");
    do_check_true(deepEqual(packet.packet, this.normalize(expected)));
  },

  // Write your tests, call dumpLog at the end, inspect the output,
  // then sprinkle the calls through the right places in your test.
  dumpLog: function() {
    for (let entry of this.packets) {
      if (entry.type === "sent") {
        dump("trace.expectSend(" + entry.packet + ");\n");
      } else {
        dump("trace.expectReceive(" + entry.packet + ");\n");
      }
    }
  }
};

function StubTransport() { }
StubTransport.prototype.ready = function () {};
StubTransport.prototype.send  = function () {};
StubTransport.prototype.close = function () {};

function executeSoon(aFunc) {
  Services.tm.mainThread.dispatch({
    run: DevToolsUtils.makeInfallible(aFunc)
  }, Ci.nsIThread.DISPATCH_NORMAL);
}

// The do_check_* family of functions expect their last argument to be an
// optional stack object. Unfortunately, most tests actually pass a in a string
// containing an error message instead, which causes error reporting to break if
// strict warnings as errors is turned on. To avoid this, we wrap these
// functions here below to ensure the correct number of arguments is passed.
//
// TODO: Remove this once bug 906232 is resolved
//
let do_check_true_old = do_check_true;
let do_check_true = function (condition) {
  do_check_true_old(condition);
};

let do_check_false_old = do_check_false;
let do_check_false = function (condition) {
  do_check_false_old(condition);
};

let do_check_eq_old = do_check_eq;
let do_check_eq = function (left, right) {
  do_check_eq_old(left, right);
};

let do_check_neq_old = do_check_neq;
let do_check_neq = function (left, right) {
  do_check_neq_old(left, right);
};

let do_check_matches_old = do_check_matches;
let do_check_matches = function (pattern, value) {
  do_check_matches_old(pattern, value);
};

// Create async version of the object where calling each method
// is equivalent of calling it with asyncall. Mainly useful for
// destructuring objects with methods that take callbacks.
const Async = target => new Proxy(target, Async);
Async.get = (target, name) =>
  typeof(target[name]) === "function" ? asyncall.bind(null, target[name], target) :
  target[name];

// Calls async function that takes callback and errorback and returns
// returns promise representing result.
const asyncall = (fn, self, ...args) =>
  new Promise((...etc) => fn.call(self, ...args, ...etc));

const Test = task => () => {
  add_task(task);
  run_next_test();
};

const assert = do_check_true;
