// Copyright (c) 2009 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var mailto = document.getElementById("customfield_10537-val").innerHTML;
mailto = mailto.substring(mailto.indexOf(">") + 1, mailto.lastIndexOf("<"));
mailto = mailto + ';JIRA.Finnova@swisscom.com' + ';supportonboarding@bcge.ch'

var itsm = document.getElementById("customfield_10521-val").innerHTML.trim();
var op = document.title.substring(document.title.indexOf("[") + 1, document.title.indexOf("]"));

var title = '[JIRA] Updates for ' + document.title.replace('[','').replace(']','');

var additionalInfo = {
  "title": title,
  "selection": window.getSelection().toString(),
  "mailto" : mailto,
  "itsm" : itsm,
  "op" : op
};

chrome.runtime.connect().postMessage(additionalInfo);
