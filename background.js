// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// In MV3, we need to use chrome.storage instead of localStorage
function getCustomMailtoUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get('customMailtoUrl', (result) => {
      resolve(result.customMailtoUrl || "");
    });
  });
}

async function executeMailto(tab_id, to, subject, body, selection) {
  const customUrl = await getCustomMailtoUrl();
  const default_handler = customUrl.length === 0;

  let action_url = "mailto:" + to;
  action_url += "?";

  if (subject.length > 0)
    action_url += "subject=" + encodeURIComponent(subject) + "&";

  if (body.length > 0) {
    action_url += "body=" + encodeURIComponent(body);

    // Append the current selection to the end of the text message.
    if (selection.length > 0) {
      action_url += encodeURIComponent("\n\n") +
        encodeURIComponent(selection);
    }
  }

  if (!default_handler) {
    // Custom URL's (such as opening mailto in Gmail tab) should have a
    // separate tab to avoid clobbering the page you are on.
    action_url = customUrl.replace("%s", encodeURIComponent(action_url));
    console.log('Custom url: ' + action_url);
    chrome.tabs.create({ url: action_url });
  } else {
    // Plain vanilla mailto links open up in the same tab to prevent
    // blank tabs being left behind.
    console.log('Action url: ' + action_url);
    chrome.tabs.update(tab_id, { url: action_url });
  }
}

// Stores the template body chosen in the popup until the content script responds.
let pendingTemplateBody = null;

chrome.runtime.onConnect.addListener(function (port) {
  var tab = port.sender.tab;
  const templateBody = pendingTemplateBody;
  pendingTemplateBody = null;

  // This will get called by the content script we execute in
  // the tab as a result of the user pressing the browser action.
  port.onMessage.addListener(function (info) {
    var max_length = 1024;

    if (info.selection.length > max_length)
      info.selection = info.selection.substring(0, max_length);

    // Prepend the template body (if any) before the page URL.
    let body = tab.url;
    if (templateBody !== null && templateBody.length > 0) {
      body = templateBody + "\n\n" + tab.url;
    }

    executeMailto(tab.id, info.mailto, info.title, body, info.selection);

    // Copy to clipboard using modern clipboard API in content script context
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        navigator.clipboard.writeText(text)
          .then(() => console.log('Copied to clipboard:', text))
          .catch(err => console.error('Failed to copy:', err));
      },
      args: [info.itsm + ":" + info.op]
    });
  });
});

// Handles the sendMail message sent from popup.js when the user picks a template.
chrome.runtime.onMessage.addListener(function (message) {
  if (message.action === 'sendMail') {
    pendingTemplateBody = message.templateBody;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (tab.url.indexOf("https://issue.swisscom.ch") !== 0) {
        // Not a JIRA page — open mail with just the URL, no template body.
        executeMailto(tab.id, "", "", tab.url, "");
        pendingTemplateBody = null;
      } else {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content_script.js"]
        });
      }
    });
  }
});

// Called when the user clicks on the browser action icon.
// NOTE: This handler is only active when no default_popup is set in manifest.json.
// With a popup configured it will not fire, but is kept here for reference.
chrome.action.onClicked.addListener(function (tab) {
  // We can only inject scripts to find the title on pages loaded with http
  // and https so for all other pages, we don't ask for the title.
  if (tab.url.indexOf("https://issue.swisscom.ch") != 0) {
    executeMailto(tab.id, "", "", tab.url, "");
  } else {
    // Updated to use the scripting API
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_script.js"]
    });
  }
});
