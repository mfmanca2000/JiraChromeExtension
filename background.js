// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Keep the service worker alive so the popup opens without a cold-start delay.
// The alarm fires every ~24 seconds, below Chrome's 30-second idle threshold.
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });

// Periodically re-counts unassigned issues on the configured board (badging the
// toolbar icon with the count, see updateUnassignedBadge below) and pings SAP to
// keep its session from idling out (see keepSapSessionAlive below).
const PERIODIC_REFRESH_ALARM = 'periodicRefresh';
chrome.alarms.create(PERIODIC_REFRESH_ALARM, { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === PERIODIC_REFRESH_ALARM) {
    updateUnassignedBadge();
    keepSapSessionAlive();
  }
});

chrome.runtime.onInstalled.addListener(function() { updateUnassignedBadge(); });
chrome.runtime.onStartup.addListener(function() { updateUnassignedBadge(); });

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

// Copies text to the clipboard inside the given tab.
// Tries the modern Clipboard API first; falls back to execCommand when the
// tab's document does not have focus (e.g. while the popup is open).
function copyTextInTab(tabId, text) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (t) => {
      return navigator.clipboard.writeText(t).catch(() => {
        const el = document.createElement('textarea');
        el.value = t;
        document.body.appendChild(el);
        el.select();
        // execCommand is deprecated but used here as a focus-independent fallback.
        document.execCommand('copy'); // eslint-disable-line no-document-execcommand
        document.body.removeChild(el);
      });
    },
    args: [text]
  });
}

// Stores the template body chosen in the popup until the content script responds.
let pendingTemplateBody = null;

// Stores a pending copyId callback until the content script responds.
let pendingCopyIdCallback = null;

// Stores the suffix chosen in the popup for the pending copyId action.
let pendingCopyIdSuffix = null;

chrome.runtime.onConnect.addListener(function (port) {
  var tab = port.sender.tab;
  const templateBody = pendingTemplateBody;
  pendingTemplateBody = null;
  const copyIdCallback = pendingCopyIdCallback;
  pendingCopyIdCallback = null;
  const copyIdSuffix = pendingCopyIdSuffix;
  pendingCopyIdSuffix = null;

  // This will get called by the content script we execute in
  // the tab as a result of the user pressing the browser action.
  port.onMessage.addListener(function (info) {
    // Handle copyId action: copy the ID (with optional suffix) to clipboard and respond.
    if (copyIdCallback) {
      const idText = (info.itsm ? info.itsm + ':' : '') + info.op + (copyIdSuffix ? " " + copyIdSuffix : "");
      copyTextInTab(tab.id, idText)
        .then(() => copyIdCallback({ success: true }))
        .catch((err) => copyIdCallback({ success: false, error: err.message }));
      return;
    }

    var max_length = 1024;

    if (info.selection.length > max_length)
      info.selection = info.selection.substring(0, max_length);

    // Prepend the template body (if any) before the page URL.
    let body = tab.url;
    if (templateBody !== null && templateBody.length > 0) {
      body = templateBody + "\n\n" + tab.url;
    }

    executeMailto(tab.id, info.mailto, info.title, body, info.selection);

    copyTextInTab(tab.id, (info.itsm ? info.itsm + ':' : '') + info.op);
  });
});

// Extracts the JIRA issue key (e.g. "PROJ-123") from a JIRA browse URL.
function extractIssueKey(url) {
  if (!url) return null;
  const match = url.match(/\/browse\/([A-Z]+-\d+)/i);
  return match ? match[1] : null;
}

// -- Issue info cache (chrome.storage.session survives SW restarts, cleared on Chrome close) --

function cacheIssueInfo(issueKey, itsm, isRFC) {
  return chrome.storage.session.set({
    ['issueInfo_' + issueKey]: { itsm: itsm, op: issueKey, isRFC: !!isRFC, ts: Date.now() }
  });
}

async function getCachedIssueInfo(issueKey) {
  const key = 'issueInfo_' + issueKey;
  const result = await chrome.storage.session.get(key);
  const entry = result[key];
  if (entry && (Date.now() - entry.ts) < 5 * 60 * 1000) {
    return entry;
  }
  return null;
}

async function prefetchIssueInfo(tab) {
  if (!tab || !tab.url) return;
  const issueKey = extractIssueKey(tab.url);
  if (!issueKey) return;
  if (await getCachedIssueInfo(issueKey)) return;
  try {
    const base = 'https://issue.swisscom.ch/rest/api/2';
    const res = await fetch(`${base}/issue/${issueKey}?fields=customfield_10521,issuetype`, {
      credentials: 'include'
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw = data.fields && data.fields.customfield_10521;
    const isRFC = !!(data.fields && data.fields.issuetype && data.fields.issuetype.name === 'Request for Change');
    await cacheIssueInfo(issueKey, raw ? String(raw).trim() : '', isRFC);
  } catch (e) {
    // Pre-fetch errors are silently ignored; the popup will fetch on demand.
  }
}

// Pre-fetch issue info whenever the user switches to or loads a JIRA tab so
// that clicking "Log Time" can return the cached result instantly.
chrome.tabs.onActivated.addListener(async function(activeInfo) {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    prefetchIssueInfo(tab);
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.active) {
    prefetchIssueInfo(tab);
  }
});

// -- Issues board screen (popup "Issues" tab + unassigned-count badge) --

const ISSUES_BOARD_DEFAULTS = {
  jiraRapidViewId: '2801',
  jiraQuickFilterUnassigned: '14060',
  jiraQuickFilterAssignedToMe: '14047',
  jiraQuickFilterAssignedToMeRecent: '14048'
};

async function getIssuesBoardSettings() {
  const stored = await chrome.storage.local.get(Object.keys(ISSUES_BOARD_DEFAULTS));
  const out = {};
  for (const k in ISSUES_BOARD_DEFAULTS) out[k] = stored[k] || ISSUES_BOARD_DEFAULTS[k];
  return out;
}

// Quick filters aren't exposed by the modern Agile REST API - their JQL
// definitions have to be read from the GreenHopper board-config endpoint
// (requires board edit permission). Fetched once per screen load/badge check
// and reused for all 3 configured filter IDs.
async function fetchQuickFilterQueries(base, rapidViewId) {
  const url = `${base}/rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId=${encodeURIComponent(rapidViewId)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Could not load quick filter definitions (HTTP ${res.status}) - board edit permission may be required`);
  const data = await res.json();
  const filters = (data.quickFilterConfig && data.quickFilterConfig.quickFilters) || [];
  const map = {};
  filters.forEach(f => { map[String(f.id)] = f.query; });
  return map;
}

function lookupQuickFilterQuery(queryMap, id, label) {
  const q = queryMap[String(id)];
  if (!q) throw new Error(`Quick filter ${id} (${label}) not found on this board`);
  return q;
}

// Runs a quick filter's JQL against the board via the modern Agile REST API,
// which (unlike the legacy GreenHopper board-data endpoint) reliably returns
// full field data directly - no separate search call needed. extraJql is
// AND-ed in server-side, e.g. to exclude closed issues.
async function fetchBoardIssuesForFilter(base, rapidViewId, jql, extraJql) {
  const combined = extraJql ? `(${jql}) AND ${extraJql}` : jql;
  const url = `${base}/rest/agile/1.0/board/${encodeURIComponent(rapidViewId)}/issue` +
    `?jql=${encodeURIComponent(combined)}` +
    `&fields=summary,created,updated,project,issuetype,customfield_11725,duedate,status&maxResults=200`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Board issue fetch failed (HTTP ${res.status})`);
  const data = await res.json();
  return data.issues || [];
}

// Unwraps the ITSM Target Date custom field defensively - confirmed to be a
// plain ISO date string on this instance, but an object with a value/date
// property is also handled in case that ever differs by project/config.
function unwrapCustomDateField(v) {
  if (v && typeof v === 'object') return v.value || v.date || null;
  return v || null;
}

// Incidents use the "ITSM Target Date" custom field; RFCs use the standard
// JIRA due date field. Matches the isRFC check already used elsewhere in
// this file (handleGetIssueInfo/prefetchIssueInfo).
function computeRelevantDate(fields) {
  const isRFC = !!(fields.issuetype && fields.issuetype.name === 'Request for Change');
  const raw = isRFC ? fields.duedate : unwrapCustomDateField(fields.customfield_11725);
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function enrichIssue(issue) {
  const f = issue.fields || {};
  const relevantDate = computeRelevantDate(f);
  return {
    key: issue.key,
    summary: f.summary || '',
    created: f.created || null,
    updated: f.updated || null,
    projectKey: (f.project && f.project.key) || issue.key.split('-')[0],
    status: (f.status && f.status.name) || '',
    isRFC: !!(f.issuetype && f.issuetype.name === 'Request for Change'),
    relevantDate: relevantDate ? relevantDate.toISOString() : null
  };
}

const ISSUES_SCREEN_CACHE_KEY = 'issuesScreenData';
// Slightly longer than the 5-minute badge alarm's period, so that alarm keeps
// this cache continuously warm (see updateUnassignedBadge below) and popup
// opens almost always hit the cache instead of live-fetching from Jira.
const ISSUES_SCREEN_TTL_MS = 6 * 60 * 1000;

// Builds the data for the popup's Issues tab: resolves the 3 configured quick
// filters to their JQL, queries each directly via the Agile REST API, and
// buckets the results into the 3 sections shown in the UI. Results are
// cached briefly in session storage so reopening the popup doesn't refetch;
// forceRefresh (the popup's refresh button) bypasses that cache.
async function buildIssuesScreenData(forceRefresh) {
  if (!forceRefresh) {
    const cached = (await chrome.storage.session.get(ISSUES_SCREEN_CACHE_KEY))[ISSUES_SCREEN_CACHE_KEY];
    if (cached && (Date.now() - cached.ts) < ISSUES_SCREEN_TTL_MS) return cached.data;
  }

  const base = 'https://issue.swisscom.ch';
  const s = await getIssuesBoardSettings();
  const queryMap = await fetchQuickFilterQueries(base, s.jiraRapidViewId);

  const unassignedJql = lookupQuickFilterQuery(queryMap, s.jiraQuickFilterUnassigned, 'Unassigned');
  const assignedJql = lookupQuickFilterQuery(queryMap, s.jiraQuickFilterAssignedToMe, 'Assigned to Me');
  const recentJql = lookupQuickFilterQuery(queryMap, s.jiraQuickFilterAssignedToMeRecent, 'Assigned to Me - Recently Updated');

  const [unassignedIssues, assignedIssuesAll, recentIssues] = await Promise.all([
    fetchBoardIssuesForFilter(base, s.jiraRapidViewId, unassignedJql),
    // Restrict to still-open issues server-side - the raw "assigned to me"
    // quick filter has no resolution clause of its own, so without this the
    // result includes years of closed tickets whose old due dates would
    // otherwise flood the "due soon / overdue" section below.
    fetchBoardIssuesForFilter(base, s.jiraRapidViewId, assignedJql, 'resolution = Unresolved'),
    // The board's "Recently Updated" quick filter is just `updatedDate >= -1d`
    // with no assignee clause of its own - on the real board it's meant to be
    // stacked with "Only My Issues" (quick filters AND together when combined),
    // so AND in the "assigned to me" JQL here to match that intent.
    fetchBoardIssuesForFilter(base, s.jiraRapidViewId, recentJql, assignedJql)
  ]);

  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 3);
  windowEnd.setHours(23, 59, 59, 999);

  const unassigned = unassignedIssues.map(enrichIssue);
  const assignedToMeAll = assignedIssuesAll.map(enrichIssue);
  const assignedToMe = assignedToMeAll.filter(i => i.relevantDate && new Date(i.relevantDate) <= windowEnd);
  const assignedToMeInProgress = assignedToMeAll.filter(i => i.status === 'In Progress');
  const assignedToMeRecent = recentIssues.map(enrichIssue);

  const data = { unassigned, assignedToMe, assignedToMeInProgress, assignedToMeRecent, fetchedAt: Date.now() };
  await chrome.storage.session.set({ [ISSUES_SCREEN_CACHE_KEY]: { data, ts: Date.now() } });
  updateBadgeFromCount(unassigned.length);
  return data;
}

async function handleGetIssuesScreenData(forceRefresh, sendResponse) {
  try {
    const data = await buildIssuesScreenData(!!forceRefresh);
    sendResponse({ success: true, data });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function updateBadgeFromCount(count) {
  if (!count) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
}

// Alarm-driven refresh: rebuilds the full Issues tab cache (badging the
// toolbar with the unassigned count as a side effect of buildIssuesScreenData
// above) so the cache stays warm and popup opens don't need to live-fetch.
// No desktop notifications.
async function updateUnassignedBadge() {
  try {
    await buildIssuesScreenData(true);
  } catch (err) {
    // Leave the previous badge value in place rather than showing an error state.
    console.error('[IssuesBadge] update failed:', err);
  }
}

// Fetches available transitions for an issue and returns the ID of the one
// whose target status matches targetStatusName.
async function getTransitionId(baseUrl, issueKey, targetStatusName) {
  const res = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Could not fetch transitions (HTTP ${res.status})`);
  const data = await res.json();
  const t = data.transitions.find(t => t.to.name === targetStatusName);
  if (!t) throw new Error(`Transition to "${targetStatusName}" not available`);
  return t.id;
}

// Like getTransitionId but matches by the transition's own name rather than target status.
// Needed for transitions that stay in the same status (e.g. "Add Label" → Pending).
async function getTransitionIdByName(baseUrl, issueKey, transitionName) {
  const res = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Could not fetch transitions (HTTP ${res.status})`);
  const data = await res.json();
  const t = data.transitions.find(t => t.name === transitionName);
  if (!t) throw new Error(`Transition "${transitionName}" not available`);
  return t.id;
}

// Posts a transition to move the issue to a new status.
// Optional fields object is included in the POST body when provided
// (required for mandatory transition-screen fields such as INC Status Reason).
async function postTransition(baseUrl, issueKey, transitionId, fields, update) {
  const body = { transition: { id: transitionId } };
  if (fields) body.fields = fields;
  if (update) body.update = update;
  const res = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Transition failed (HTTP ${res.status})`);
}

// Handles the setCompleted action: transitions the current issue to Resolved.
// Pending transitions directly; Assigned goes via In Progress first.
// "INC Status Reason" and "INC Resolution" are passed inside the Resolved
// transition POST because they are mandatory fields on the transition screen.
// Field IDs are looked up dynamically by name from GET /rest/api/2/field.
async function handleSetCompleted(incResolution, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const issueKey = extractIssueKey(tab.url);
    if (!issueKey) {
      sendResponse({ success: false, error: 'Not a JIRA issue page' });
      return;
    }

    const base = 'https://issue.swisscom.ch/rest/api/2';

    const issueRes = await fetch(`${base}/issue/${issueKey}?fields=status`, {
      credentials: 'include'
    });
    if (!issueRes.ok) throw new Error(`Could not fetch issue (HTTP ${issueRes.status})`);
    const issueData = await issueRes.json();
    const status = issueData.fields.status.name;

    if (status !== 'Assigned' && status !== 'In Progress' && status !== 'Pending') {
      const msg = status === 'Resolved' ? 'Ticket is already Resolved'
                                        : `Cannot resolve from status "${status}"`;
      sendResponse({ success: false, error: msg });
      return;
    }

    // Look up custom field IDs before transitioning so they can be
    // included as mandatory fields in the Resolved transition POST.
    const fieldsRes = await fetch(`${base}/field`, { credentials: 'include' });
    if (!fieldsRes.ok) throw new Error(`Could not fetch fields (HTTP ${fieldsRes.status})`);
    const allFields = await fieldsRes.json();

    const statusReasonField = allFields.find(f => f.name === 'INC Status Reason');
    const resolutionField = allFields.find(f => f.name === 'INC Resolution');
    if (!statusReasonField) throw new Error('Field "INC Status Reason" not found in JIRA');
    if (!resolutionField) throw new Error('Field "INC Resolution" not found in JIRA');

    const completionFields = {};
    completionFields[statusReasonField.id] = { value: 'No Further Action Required' };
    if (incResolution && incResolution.length > 0) {
      completionFields[resolutionField.id] = incResolution;
    }

    if (status === 'Assigned') {
      const tid1 = await getTransitionId(base, issueKey, 'In Progress');
      await postTransition(base, issueKey, tid1);
      const tid2 = await getTransitionId(base, issueKey, 'Resolved');
      await postTransition(base, issueKey, tid2, completionFields);
    } else {
      // In Progress and Pending both transition directly to Resolved
      const tid = await getTransitionId(base, issueKey, 'Resolved');
      await postTransition(base, issueKey, tid, completionFields);
    }

    sendResponse({ success: true });
    chrome.tabs.reload(tab.id);
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// Adds a label via the "Add Label" workflow transition (same pattern as handleSetCompleted).
async function handleAddLabel(label, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const issueKey = extractIssueKey(tab.url);
    if (!issueKey) {
      sendResponse({ success: false, error: 'Not a JIRA issue page' });
      return;
    }

    const base = 'https://issue.swisscom.ch/rest/api/2';

    const labels = label.trim().split(/\s+/).filter(Boolean).map(l => ({ add: l }));
    if (labels.length === 0) {
      sendResponse({ success: false, error: 'No label specified' });
      return;
    }
    const transitionId = await getTransitionIdByName(base, issueKey, 'Add Label');
    await postTransition(base, issueKey, transitionId, null, { labels });

    sendResponse({ success: true });
    chrome.tabs.reload(tab.id);
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// Checks whether the current issue's assignee is already the logged-in user.
async function handleGetAssignmentStatus(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const issueKey = extractIssueKey(tab.url);
    if (!issueKey) {
      sendResponse({ success: false, error: 'Not a JIRA issue page' });
      return;
    }

    const base = 'https://issue.swisscom.ch/rest/api/2';

    const [meRes, issueRes] = await Promise.all([
      fetch(`${base}/myself`, { credentials: 'include' }),
      fetch(`${base}/issue/${issueKey}?fields=assignee`, { credentials: 'include' })
    ]);
    if (!meRes.ok) throw new Error(`Could not fetch current user (HTTP ${meRes.status})`);
    if (!issueRes.ok) throw new Error(`Could not fetch issue (HTTP ${issueRes.status})`);

    const me = await meRes.json();
    const issueData = await issueRes.json();
    const assignee = issueData.fields && issueData.fields.assignee;
    const isAssignedToMe = !!assignee && (assignee.key === me.key || assignee.name === me.name);

    sendResponse({ success: true, isAssignedToMe, currentUserName: me.displayName });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// Assigns an issue to the logged-in user. When issueKeyOverride is given (e.g.
// from the Issues tab's unassigned list), that issue is used directly instead
// of requiring the active tab to be on that issue's JIRA page; the active tab
// is only reloaded afterwards if it happens to already be showing that issue.
async function handleAssignToMe(sendResponse, issueKeyOverride) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const issueKey = issueKeyOverride || extractIssueKey(tab && tab.url);
    if (!issueKey) {
      sendResponse({ success: false, error: 'Not a JIRA issue page' });
      return;
    }

    const base = 'https://issue.swisscom.ch/rest/api/2';

    const meRes = await fetch(`${base}/myself`, { credentials: 'include' });
    if (!meRes.ok) throw new Error(`Could not fetch current user (HTTP ${meRes.status})`);
    const me = await meRes.json();

    // Assignment here isn't done by setting the standard "assignee" field —
    // it's done via the self-looping "Edit Issue" transition (Assigned →
    // Assigned), whose screen exposes the "INC Assignee" cascading-select
    // custom field. A workflow post-function on that transition derives the
    // standard Assignee and "INC Assignee Detail" fields from the selected
    // option, mirroring the manual "Edit Issue" → Assignment tab flow.
    const transRes = await fetch(`${base}/issue/${issueKey}/transitions?expand=transitions.fields`, {
      credentials: 'include'
    });
    if (!transRes.ok) throw new Error(`Could not fetch transitions (HTTP ${transRes.status})`);
    const transData = await transRes.json();
    const editTransition = transData.transitions.find(t => t.name === 'Edit Issue');
    if (!editTransition) throw new Error('"Edit Issue" transition not available from the current status');

    const incAssigneeField = editTransition.fields && Object.values(editTransition.fields)
      .find(f => f.name === 'INC Assignee');
    if (!incAssigneeField) throw new Error('"INC Assignee" field not found on the "Edit Issue" transition');

    // INC Assignee's options are plain-text names ("First Last") rather than
    // user objects, while me.displayName is formatted "Last First, OrgUnit" —
    // compare by word set (ignoring order and the org-unit suffix) instead
    // of an exact string match so this works for whoever runs the extension.
    const normalizeName = s => s.split(/\s+/).filter(Boolean).map(w => w.toLowerCase()).sort().join(' ');
    const myNameWords = normalizeName(me.displayName.split(',')[0]);
    const option = incAssigneeField.allowedValues.find(o => normalizeName(o.value) === myNameWords);
    if (!option) throw new Error(`No "INC Assignee" option found for "${me.displayName}"`);

    await postTransition(base, issueKey, editTransition.id, {
      [incAssigneeField.fieldId]: { id: option.id }
    });

    // Assignment doesn't move the workflow on its own — push the ticket to
    // "In Progress" too via the "Start Progress" transition, mirroring the
    // manual workflow. Skip quietly if there's no such transition (e.g.
    // already In Progress); surface any other failure instead of swallowing it.
    let tid;
    try {
      tid = await getTransitionId(base, issueKey, 'In Progress');
    } catch (e) {
      tid = null;
    }
    if (tid) {
      await postTransition(base, issueKey, tid);
    }

    sendResponse({ success: true });
    // Only reload the active tab if it's actually showing the issue we just
    // assigned - avoids reloading an unrelated tab when called from the
    // Issues tab's unassigned list.
    if (tab && extractIssueKey(tab.url) === issueKey) {
      chrome.tabs.reload(tab.id);
    }
    // Refresh the Issues tab cache (and toolbar badge) in the background so
    // the assigned issue drops out of "Unassigned" without waiting for the
    // next 5-minute alarm.
    buildIssuesScreenData(true).catch(function (e) {
      console.error('[AssignToMe] cache refresh failed:', e);
    });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// Returns the itsm (INC number) and issue key for the current Jira tab.
// Checks the session cache first; falls back to a JIRA API call on a cache miss.
async function handleGetIssueInfo(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const issueKey = extractIssueKey(tab.url);
    if (!issueKey) {
      sendResponse({ success: false, error: 'Not a JIRA issue page' });
      return;
    }

    const cached = await getCachedIssueInfo(issueKey);
    if (cached) {
      sendResponse({ success: true, itsm: cached.itsm, op: cached.op, isRFC: !!cached.isRFC });
      return;
    }

    const base = 'https://issue.swisscom.ch/rest/api/2';
    const res = await fetch(`${base}/issue/${issueKey}?fields=customfield_10521,issuetype`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Could not fetch issue (HTTP ${res.status})`);
    const data = await res.json();
    const raw = data.fields && data.fields.customfield_10521;
    const itsm = raw ? String(raw).trim() : '';
    const isRFC = !!(data.fields && data.fields.issuetype && data.fields.issuetype.name === 'Request for Change');
    await cacheIssueInfo(issueKey, itsm, isRFC);
    sendResponse({ success: true, itsm, op: issueKey, isRFC });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}


// -- Shared SAP session helpers (used by handleLogTime and keepSapSessionAlive) --

const SAP_BASE = 'https://pmpgwd.apps.swisscom.com';
const SAP_CSRF_URL = `${SAP_BASE}/sap/opu/odata/sap/Z_ONETIME_SRV/?sap-client=100`;
const SAP_HEADERS = {
  'DataServiceVersion': '2.0',
  'MaxDataServiceVersion': '2.0',
  'X-Requested-With': 'XMLHttpRequest',
  'X-XHR-Logon': 'accept="iframe,strict-window,window"',
  'sap-contextid-accept': 'header'
};

const sapPad = n => String(n).padStart(2, '0');

// Builds the full Cookie header: prefixes the session cookie + adds companion
// cookies to avoid a Negotiate re-challenge.
function buildSapCookieHeader(sessionId) {
  const now = new Date();
  const dt = `${now.getFullYear()}-${sapPad(now.getMonth()+1)}-${sapPad(now.getDate())} ${sapPad(now.getHours())}:${sapPad(now.getMinutes())}:${sapPad(now.getSeconds())}`;
  const negoTs = dt.replace(/ /g, '%20').replace(/:/g, '%3a');
  return `SAP_SESSIONID_P3L_100=${sessionId}; SPNegoTokenRequested=${negoTs}; sap-usercontext=sap-client=100`;
}

async function installSapCookieRule(ruleId, cookieStr) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [{
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Cookie', operation: 'set', value: cookieStr }]
      },
      condition: { urlFilter: '||pmpgwd.apps.swisscom.com' }
    }]
  });
}

function removeSapCookieRule(ruleId) {
  return chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
}

// Pings the SAP CSRF endpoint using the last-known session cookie so the
// server-side session doesn't idle out between actual time-log submissions.
// No-ops when there's no stored session yet; failures (including an already-
// expired session) are logged only - handleLogTime will surface a real error
// the next time the user actually logs time.
const SAP_KEEPALIVE_DNR_RULE_ID = 43;
async function keepSapSessionAlive() {
  try {
    const stored = await chrome.storage.local.get('sapCookies');
    const sessionId = (stored.sapCookies || '').trim();
    if (!sessionId) return;

    const cookieStr = buildSapCookieHeader(sessionId);
    await installSapCookieRule(SAP_KEEPALIVE_DNR_RULE_ID, cookieStr);
    try {
      const res = await fetch(SAP_CSRF_URL, {
        credentials: 'omit',
        headers: { 'X-CSRF-Token': 'Fetch', ...SAP_HEADERS }
      });
      console.log('[SAP] keep-alive ping status:', res.status);
    } finally {
      await removeSapCookieRule(SAP_KEEPALIVE_DNR_RULE_ID);
    }
  } catch (e) {
    console.error('[SAP] keep-alive failed:', e);
  }
}

// Builds and POSTs a time entry to the SAP time tracker.
// Automatically retries with a 15-minute shift when SAP reports a slot conflict,
// skipping over the mandatory 12:00–13:00 lunch break if the shift lands there.
async function handleLogTime(payload, sendResponse) {
  try {
    const stored = await new Promise(resolve =>
      chrome.storage.local.get(['employeeNumber', 'timeProfiles'], resolve)
    );
    const employeeNumber = stored.employeeNumber || '';
    const profiles = stored.timeProfiles || [];

    if (!employeeNumber) {
      sendResponse({ success: false, error: 'Employee number not configured. Set it in Options.' });
      return;
    }
    const profile = profiles[payload.profileIndex];
    if (!profile) {
      sendResponse({ success: false, error: 'Profile not found. It may have been deleted.' });
      return;
    }

    const sessionId = (payload.sapCookies || '').trim();
    await new Promise(resolve => chrome.storage.local.set({ sapCookies: sessionId }, resolve));

    if (!sessionId) {
      sendResponse({ success: false, error: 'SAP Session ID is empty. Paste it in the Session ID field.' });
      return;
    }

    const [year, month, day] = payload.date.split('-').map(Number);
    let [startH, startM] = payload.startTime.split(':').map(Number);
    let [endH, endM] = payload.endTime.split(':').map(Number);

    const prefix = payload.itsm ? payload.itsm + ':' + payload.op : payload.op;
    const fullText = (profile.prependId === false || !prefix)
      ? (payload.comment || '')
      : (payload.comment ? prefix + ': ' + payload.comment : prefix);

    // SAP quirk: embed local h:m directly as UTC milliseconds for Start/EndDate.
    const pad = sapPad;
    function sapDate(y, mo, d, h, m) {
      return '/Date(' + Date.UTC(y, mo - 1, d, h, m, 0) + ')/';
    }
    function sapDuration(h, m) {
      return 'PT' + pad(h) + 'H' + pad(m) + 'M00S';
    }
    // start_date: real UTC timestamp of local midnight (used as day anchor).
    const startOfDayMs = new Date(year, month - 1, day, 0, 0, 0).getTime();

    const fullCookieStr = buildSapCookieHeader(sessionId);

    console.log('[SAP] session ID length:', sessionId.length, '| preview:', sessionId.substring(0, 30) + '…');

    const DNR_RULE_ID = 42;
    try {
      await installSapCookieRule(DNR_RULE_ID, fullCookieStr);
      console.log('[SAP] DNR rule installed');
    } catch (e) {
      console.error('[SAP] DNR rule setup failed:', e);
    }

    try {
      let csrfToken = '';
      try {
        console.log('[SAP] fetching CSRF token…');
        const csrfRes = await fetch(SAP_CSRF_URL,
          { credentials: 'omit', headers: { 'X-CSRF-Token': 'Fetch', ...SAP_HEADERS } }
        );
        console.log('[SAP] CSRF status:', csrfRes.status);
        if (csrfRes.status === 401) {
          sendResponse({ success: false, error: 'SAP session expired (401). Please paste a fresh Session ID.' });
          return;
        }
        csrfToken = csrfRes.headers.get('X-CSRF-Token') || '';
        console.log('[SAP] CSRF token:', csrfToken || '(none)');
      } catch (e) {
        console.error('[SAP] CSRF fetch error:', e);
      }

      const postHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'sap-cancel-on-close': 'false',
        ...SAP_HEADERS
      };
      if (csrfToken) postHeaders['x-csrf-token'] = csrfToken;

      // Retry loop: on a slot conflict, shift 15 minutes later (max 16 attempts = 4 hours).
      const MAX_RETRIES = 16;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const sapPayload = {
          Profile: 'SC01',
          Mode: '',
          EmployeeNumber: employeeNumber,
          StartDate: sapDate(year, month, day, startH, startM),
          EndDate: sapDate(year, month, day, endH, endM),
          StartTime: sapDuration(startH, startM),
          EndTime: sapDuration(endH, endM),
          DayFlag: 'Time',
          BreakStart: 'PT00H00M00S',
          BreakEnd: 'PT00H00M00S',
          TimeType: '',
          LstarKey: profile.lstarKey,
          LstarValue: '',
          TargetElementType: profile.psp ? (profile.targetElementType || 'KAUFTR') : '',
          TargetElementKey: profile.psp || '',
          TargetElementValue: '',
          SubElementKey: profile.position || '',
          SubElementValue: '',
          SubSubElementKey: '',
          SubSubElementValue: '',
          CalcMotiveKey: '',
          CalcMotiveValue: '',
          FinConf: false,
          TasktypeKey: '',
          TasktypeValue: '',
          text: fullText,
          start_date: '/Date(' + startOfDayMs + ')/',
          Fieldglass: ''
        };

        console.log(`[SAP] attempt ${attempt + 1}: posting ${pad(startH)}:${pad(startM)}–${pad(endH)}:${pad(endM)}`);
        const res = await fetch(
          `${SAP_BASE}/sap/opu/odata/sap/Z_ONETIME_SRV/TimeEntrySet?sap-client=100`,
          { method: 'POST', credentials: 'omit', headers: postHeaders, body: JSON.stringify(sapPayload) }
        );
        console.log('[SAP] POST status:', res.status);

        if (res.ok) {
          sendResponse({
            success: true,
            startTime: pad(startH) + ':' + pad(startM),
            endTime: pad(endH) + ':' + pad(endM)
          });
          return;
        }

        const body = await res.text();
        console.log('[SAP] POST error body:', body.substring(0, 500));
        let errMsg = `HTTP ${res.status}`;
        let isConflict = (res.status === 409);
        try {
          const errJson = JSON.parse(body);
          if (errJson.error && errJson.error.message && errJson.error.message.value) {
            errMsg = errJson.error.message.value;
            if (!isConflict) {
              isConflict = /conflict|overlap|already.exist|duplicate|colli/i.test(errMsg);
            }
          }
        } catch (e) { /* use status code */ }

        if (!isConflict || attempt === MAX_RETRIES) {
          throw new Error(errMsg);
        }

        // Slot is taken - shift both boundaries 15 minutes later.
        const newStartMin = startH * 60 + startM + 15;
        startH = Math.floor(newStartMin / 60) % 24;
        startM = newStartMin % 60;
        const newEndMin = endH * 60 + endM + 15;
        endH = Math.floor(newEndMin / 60) % 24;
        endM = newEndMin % 60;

        // If the shift lands inside the mandatory lunch break (12:00–13:00),
        // jump to 13:00 and shift the end by the same amount.
        if (startH === 12) {
          const lunchSkip = 60 - startM; // minutes until 13:00
          startH = 13;
          startM = 0;
          const skippedEndMin = endH * 60 + endM + lunchSkip;
          endH = Math.floor(skippedEndMin / 60) % 24;
          endM = skippedEndMin % 60;
        }

        if (endH >= 20) {
          throw new Error(`No free slot found before 20:00 - check your SAP entries manually. Last error: ${errMsg}`);
        }

        console.log(`[SAP] conflict - retrying at ${pad(startH)}:${pad(startM)}–${pad(endH)}:${pad(endM)}`);
      }
    } finally {
      removeSapCookieRule(DNR_RULE_ID);
      console.log('[SAP] DNR rule removed');
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// Fetches the SAP session cookie for the current browser first (covers the case where
// the user is already Kerberos-authenticated on the SAP page in this same Chrome profile),
// falling back to the Edge bridge/bookmarklet relay only if Chrome doesn't have it.
async function handleGetSapCookie(sendResponse) {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://pmpgwd.apps.swisscom.com',
      name: 'SAP_SESSIONID_P3L_100'
    });
    if (cookie && cookie.value) {
      console.log('[SAP] cookie found directly in Chrome, length:', cookie.value.length);
      sendResponse({ success: true, sessionId: cookie.value, source: 'chrome' });
      return;
    }
  } catch (e) {
    console.error('[SAP] chrome.cookies.get failed:', e);
  }

  try {
    const res = await fetch('http://127.0.0.1:27182/get');
    const data = await res.json();
    if (data.sessionId) {
      sendResponse({ success: true, sessionId: data.sessionId, source: 'bridge' });
    } else {
      sendResponse({ success: false, error: data.error || 'No cookie stored' });
    }
  } catch (e) {
    sendResponse({ success: false, error: 'Bridge not running. Start bridge/start.bat first.' });
  }
}

// Handles the sendMail message sent from popup.js when the user picks a template.
chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message.action === 'getEdgeSapCookie') {
    handleGetSapCookie(sendResponse);
    return true;
  }

  if (message.action === 'getIssueInfo') {
    handleGetIssueInfo(sendResponse);
    return true;
  }

  if (message.action === 'getIssuesScreenData') {
    handleGetIssuesScreenData(message.forceRefresh, sendResponse);
    return true;
  }

  if (message.action === 'logTime') {
    handleLogTime(message, sendResponse);
    return true;
  }

  if (message.action === 'addLabel') {
    handleAddLabel(message.label, sendResponse);
    return true; // keep channel open for async response
  }

  if (message.action === 'setCompleted') {
    handleSetCompleted(message.incResolution || '', sendResponse);
    return true; // keep channel open for async response
  }

  if (message.action === 'getAssignmentStatus') {
    handleGetAssignmentStatus(sendResponse);
    return true; // keep channel open for async response
  }

  if (message.action === 'assignToMe') {
    handleAssignToMe(sendResponse, message.issueKey || null);
    return true; // keep channel open for async response
  }

  if (message.action === 'copyId') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || tab.url.indexOf("https://issue.swisscom.ch") !== 0) {
        sendResponse({ success: false, error: 'Not a JIRA issue page' });
        return;
      }
      pendingCopyIdCallback = sendResponse;
      pendingCopyIdSuffix = message.suffix || '';
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content_script.js"]
      });
    });
    return true; // keep channel open for async response
  }

  if (message.action === 'sendMail') {
    pendingTemplateBody = message.templateBody;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (tab.url.indexOf("https://issue.swisscom.ch") !== 0) {
        // Not a JIRA page - open mail with just the URL, no template body.
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
