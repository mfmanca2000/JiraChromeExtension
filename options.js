// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var gmail = "https://mail.google.com/mail/?extsrc=mailto&url=%s";

function toggle(radioButton) {
  // Use chrome.storage instead of localStorage
  if (document.getElementById('gmail').checked) {
    chrome.storage.local.set({ 'customMailtoUrl': gmail });
  } else {
    chrome.storage.local.set({ 'customMailtoUrl': "" });
  }
}

function main() {
  // Check for stored preference
  chrome.storage.local.get('customMailtoUrl', function (result) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      alert("Storage must be enabled for changing options.");
      document.getElementById('default').disabled = true;
      document.getElementById('gmail').disabled = true;
      return;
    }

    // Default handler is checked. If we've chosen another provider, we must
    // change the checkmark.
    if (result.customMailtoUrl === gmail) {
      document.getElementById('gmail').checked = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  main();
  document.querySelector('#default').addEventListener('click', toggle);
  document.querySelector('#gmail').addEventListener('click', toggle);
});