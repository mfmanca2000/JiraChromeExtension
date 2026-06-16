// Copyright (c) 2009 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

(async function() {
  // Detect issue type to distinguish RFC from incidents
  var typeEl = document.getElementById("type-val");
  var isRFC = typeEl && typeEl.textContent.indexOf("Request for Change") !== -1;

  // ITSM/INC number — only present on incident pages
  var itsm = '';
  if (!isRFC) {
    var itsmEl = document.getElementById("customfield_10521-val");
    if (itsmEl) itsm = itsmEl.innerHTML.trim();
  }

  // Recipient email
  var mailto = '';
  if (!isRFC) {
    // Incidents: email is stored as plain text in customfield_10537
    var emailEl = document.getElementById("customfield_10537-val");
    if (emailEl) {
      var raw = emailEl.innerHTML;
      mailto = raw.substring(raw.indexOf(">") + 1, raw.lastIndexOf("<"));
      mailto = mailto + ';JIRA.Finnova@swisscom.com';
    }
  } else {
    // RFC: fetch email from Contact Details Customer user profile
    var contactEl = document.querySelector('#customfield_10616-val .user-hover[rel]');
    if (contactEl) {
      var username = contactEl.getAttribute('rel');
      if (username) {
        try {
          var res = await fetch('/rest/api/2/user?username=' + encodeURIComponent(username), { credentials: 'include' });
          if (res.ok) {
            var userData = await res.json();
            mailto = userData.emailAddress || '';
          }
        } catch (e) {
          // leave mailto empty
        }
      }
    }
  }

  var op = document.title.substring(document.title.indexOf("[") + 1, document.title.indexOf("]"));
  var title = '[JIRA] Updates for ' + document.title.replace('[', '').replace(']', '');

  chrome.runtime.connect().postMessage({
    "title": title,
    "selection": window.getSelection().toString(),
    "mailto": mailto,
    "itsm": itsm,
    "op": op
  });
})();