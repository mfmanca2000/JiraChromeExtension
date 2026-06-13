document.addEventListener('DOMContentLoaded', function () {
  var viewMail = document.getElementById('view-mail');
  var viewResolution = document.getElementById('view-resolution');
  var templateList = document.getElementById('template-list');
  var noTemplateItem = document.getElementById('no-template');
  var optionsLink = document.getElementById('options-link');
  var setCompletedBtn = document.getElementById('set-completed-btn');
  var resolutionList = document.getElementById('resolution-list');
  var noResolutionItem = document.getElementById('no-resolution');
  var backBtn = document.getElementById('back-btn');
  var setCompletedStatus = document.getElementById('set-completed-status');
  var addLabelBtn = document.getElementById('add-label-btn');
  var viewLabel = document.getElementById('view-label');
  var labelList = document.getElementById('label-list');
  var backLabelBtn = document.getElementById('back-label-btn');
  var copyIdBtn = document.getElementById('copy-id-btn');
  var viewCopyId = document.getElementById('view-copy-id');
  var copyIdCommentList = document.getElementById('copy-id-comment-list');
  var noCopyIdCommentItem = document.getElementById('no-copy-id-comment');
  var backCopyIdBtn = document.getElementById('back-copy-id-btn');

  var logTimeBtn = document.getElementById('log-time-btn');
  var viewTimeEntry = document.getElementById('view-time-entry');
  var backTimeEntryBtn = document.getElementById('back-time-entry-btn');
  var submitTimeEntryBtn = document.getElementById('submit-time-entry-btn');
  var teDateInput = document.getElementById('te-date');
  var teStartInput = document.getElementById('te-start');
  var teEndInput = document.getElementById('te-end');
  var teProfileSelect = document.getElementById('te-profile');
  var teCommentTextarea = document.getElementById('te-comment');
  var teTemplatesDiv = document.getElementById('te-templates');
  var tePrefixDiv = document.getElementById('te-prefix');
  var teStatusDiv = document.getElementById('te-status');
  var teSapCookieInput = document.getElementById('te-sap-cookie');
  var teFetchCookieBtn = document.getElementById('te-fetch-cookie-btn');

  // Batch-load all storage keys at once so subsequent click handlers respond
  // without an additional async round-trip to chrome.storage.
  var storageCache = null;
  chrome.storage.local.get(
    ['mailTemplates', 'labelTemplates', 'copyIdComments', 'incResolutionTemplates',
     'timeProfiles', 'timeCommentTemplates', 'employeeNumber', 'sapCookies',
     'lastEndTime', 'lastEndDate'],
    function (result) {
      storageCache = result;
      populateMailTemplates(result.mailTemplates || []);
    }
  );

  // -- Add Label: load label templates, then show picker --

  addLabelBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    withStorage(function (result) {
      var templates = result.labelTemplates || [];

      labelList.innerHTML = '';
      if (templates.length === 0) {
        var li = document.createElement('li');
        li.className = 'template-item no-template-item';
        li.innerHTML = '<div class="template-name">No label templates</div>' +
          '<div class="template-preview">Add templates in options</div>';
        labelList.appendChild(li);
      } else {
        templates.forEach(function (template) {
          var li = document.createElement('li');
          li.className = 'template-item';
          li.innerHTML =
            '<div class="template-name">' + escapeHtml(template.name) + '</div>' +
            '<div class="template-preview">' + escapeHtml(template.body) + '</div>';
          li.addEventListener('click', function () {
            triggerAddLabel(template.body);
          });
          labelList.appendChild(li);
        });
      }

      viewMail.style.display = 'none';
      viewLabel.style.display = 'block';
    });
  });

  backLabelBtn.addEventListener('click', function () {
    viewLabel.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedStatus.textContent = '';
  });

  function triggerAddLabel(label) {
    viewLabel.style.display = 'none';
    viewMail.style.display = 'block';
    addLabelBtn.disabled = true;
    setCompletedStatus.style.color = '#555';
    setCompletedStatus.textContent = 'Working…';

    chrome.runtime.sendMessage({ action: 'addLabel', label: label }, function (response) {
      if (response && response.success) {
        setCompletedStatus.style.color = 'green';
        setCompletedStatus.textContent = 'Label added!';
        setTimeout(function () { window.close(); }, 1000);
      } else {
        setCompletedStatus.style.color = 'red';
        setCompletedStatus.textContent = (response && response.error) ? response.error : 'Unknown error';
        addLabelBtn.disabled = false;
      }
    });
  }

  // -- Copy ID: load comment templates, then show picker --

  copyIdBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    withStorage(function (result) {
      var comments = result.copyIdComments || [];

      while (copyIdCommentList.children.length > 1) {
        copyIdCommentList.removeChild(copyIdCommentList.lastChild);
      }
      comments.forEach(function (comment) {
        var li = document.createElement('li');
        li.className = 'template-item';
        li.innerHTML =
          '<div class="template-name">' + escapeHtml(comment.name) + '</div>' +
          '<div class="template-preview">' +
            escapeHtml(comment.body.substring(0, 70)) +
            (comment.body.length > 70 ? '...' : '') +
          '</div>';
        li.addEventListener('click', function () {
          triggerCopyId(comment.body);
        });
        copyIdCommentList.appendChild(li);
      });

      viewMail.style.display = 'none';
      viewCopyId.style.display = 'block';
    });
  });

  noCopyIdCommentItem.addEventListener('click', function () {
    triggerCopyId('');
  });

  backCopyIdBtn.addEventListener('click', function () {
    viewCopyId.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedStatus.textContent = '';
  });

  function triggerCopyId(suffix) {
    viewCopyId.style.display = 'none';
    viewMail.style.display = 'block';
    copyIdBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'copyId', suffix: suffix }, function (response) {
      if (response && response.success) {
        setCompletedStatus.style.color = 'green';
        setCompletedStatus.textContent = 'ID copied!';
        setTimeout(function () { window.close(); }, 800);
      } else {
        setCompletedStatus.style.color = 'red';
        setCompletedStatus.textContent = (response && response.error) ? response.error : 'Copy failed';
        copyIdBtn.disabled = false;
      }
    });
  }

  // -- Set Completed: load INC Resolution templates, then show picker --

  setCompletedBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    withStorage(function (result) {
      var templates = result.incResolutionTemplates || [];

      // Rebuild list keeping "No INC Resolution" as the first item
      while (resolutionList.children.length > 1) {
        resolutionList.removeChild(resolutionList.lastChild);
      }
      templates.forEach(function (template) {
        var li = document.createElement('li');
        li.className = 'template-item';
        li.innerHTML =
          '<div class="template-name">' + escapeHtml(template.name) + '</div>' +
          '<div class="template-preview">' +
            escapeHtml(template.body.substring(0, 70)) +
            (template.body.length > 70 ? '...' : '') +
          '</div>';
        li.addEventListener('click', function () {
          triggerSetCompleted(template.body);
        });
        resolutionList.appendChild(li);
      });

      viewMail.style.display = 'none';
      viewResolution.style.display = 'block';
    });
  });

  noResolutionItem.addEventListener('click', function () {
    triggerSetCompleted('');
  });

  backBtn.addEventListener('click', function () {
    viewResolution.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedStatus.textContent = '';
  });

  function triggerSetCompleted(incResolution) {
    viewResolution.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedBtn.disabled = true;
    setCompletedStatus.style.color = '#555';
    setCompletedStatus.textContent = 'Working…';

    chrome.runtime.sendMessage({ action: 'setCompleted', incResolution: incResolution }, function (response) {
      if (response && response.success) {
        setCompletedStatus.style.color = 'green';
        setCompletedStatus.textContent = 'Status updated successfully!';
        setTimeout(function () { window.close(); }, 1000);
      } else {
        setCompletedStatus.style.color = 'red';
        setCompletedStatus.textContent = (response && response.error) ? response.error : 'Unknown error';
        setCompletedBtn.disabled = false;
      }
    });
  }

  // -- Mail template flow --

  optionsLink.addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  noTemplateItem.addEventListener('click', function () {
    sendMailWithTemplate(null);
  });

  // -- Log Time --

  teFetchCookieBtn.addEventListener('click', function() {
    teFetchCookieBtn.disabled = true;
    teFetchCookieBtn.textContent = '…';
    teStatusDiv.textContent = '';
    chrome.runtime.sendMessage({ action: 'getEdgeSapCookie' }, function(response) {
      teFetchCookieBtn.disabled = false;
      teFetchCookieBtn.textContent = '↻';
      if (response && response.success) {
        teSapCookieInput.value = response.sessionId;
        teStatusDiv.style.color = 'green';
        teStatusDiv.textContent = 'Session ID fetched from Edge!';
        setTimeout(function() { teStatusDiv.textContent = ''; }, 2000);
      } else {
        teStatusDiv.style.color = 'red';
        teStatusDiv.textContent = (response && response.error) || 'Could not fetch from Edge';
      }
    });
  });

  var currentIssueInfo = null;

  function applyDuration(minutes) {
    if (!teStartInput.value) return;
    var parts = teStartInput.value.split(':');
    var totalMin = parseInt(parts[0]) * 60 + parseInt(parts[1]) + minutes;
    var h = Math.floor(totalMin / 60) % 24;
    var m = totalMin % 60;
    teEndInput.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function clearDurChips() {
    document.querySelectorAll('.te-dur-chip').forEach(function(c) { c.classList.remove('active'); });
  }

  document.getElementById('te-durations').querySelectorAll('.te-dur-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      clearDurChips();
      chip.classList.add('active');
      applyDuration(parseInt(chip.dataset.min));
    });
  });

  teStartInput.addEventListener('change', clearDurChips);
  teEndInput.addEventListener('change', clearDurChips);

  logTimeBtn.addEventListener('click', function() {
    setCompletedStatus.textContent = '';
    currentIssueInfo = null;
    teStatusDiv.textContent = '';
    submitTimeEntryBtn.disabled = false;

    var today = new Date();
    teDateInput.value = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    teCommentTextarea.value = '';
    clearDurChips();
    var oneH = document.querySelector('.te-dur-chip[data-min="60"]');
    if (oneH) oneH.classList.add('active');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      var currentUrl = (tabs && tabs[0]) ? tabs[0].url : '';
      var issueKeyMatch = currentUrl.match(/\/browse\/([A-Z]+-\d+)/i);
      var currentPrefix = issueKeyMatch ? issueKeyMatch[1].replace(/-\d+$/, '') : null;

    withStorage(function(result) {
      var nextStart = calcNextStartTime(result.lastEndTime, result.lastEndDate);
      teStartInput.value = nextStart;
      teEndInput.value = addMinutesToTime(nextStart, 60);

      var profiles = result.timeProfiles || [];
      var templates = result.timeCommentTemplates || [];
      var empNum = result.employeeNumber || '';
      teSapCookieInput.value = result.sapCookies || '';

      // Auto-fetch a fresh cookie from the bridge on every open.
      chrome.runtime.sendMessage({ action: 'getEdgeSapCookie' }, function(response) {
        if (response && response.success) {
          teSapCookieInput.value = response.sessionId;
          teStatusDiv.style.color = 'green';
          teStatusDiv.textContent = 'Session ID auto-fetched from Edge';
          setTimeout(function() { teStatusDiv.textContent = ''; }, 2000);
        } else {
          teStatusDiv.style.color = '#e65100';
          teStatusDiv.textContent = 'Bridge not running - start bridge/start.bat in Edge first';
        }
      });

      teProfileSelect.innerHTML = '';
      if (profiles.length === 0) {
        var opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No profiles - configure in options';
        opt.disabled = true;
        opt.selected = true;
        teProfileSelect.appendChild(opt);
      } else {
        var matching = [];
        var others = [];
        profiles.forEach(function(p, i) {
          if (currentPrefix && (p.jiraProjects || []).indexOf(currentPrefix) !== -1) {
            matching.push({p: p, i: i});
          } else {
            others.push({p: p, i: i});
          }
        });
        matching.concat(others).forEach(function(item) {
          var opt = document.createElement('option');
          opt.value = String(item.i);
          opt.textContent = item.p.name;
          teProfileSelect.appendChild(opt);
        });
      }

      teTemplatesDiv.innerHTML = '';
      templates.forEach(function(t) {
        var chip = document.createElement('button');
        chip.className = 'te-chip';
        chip.textContent = t.name;
        chip.title = t.body;
        chip.addEventListener('click', function() {
          document.querySelectorAll('#te-templates .te-chip').forEach(function(c) { c.classList.remove('active'); });
          chip.classList.add('active');
          teCommentTextarea.value = t.body;
        });
        teTemplatesDiv.appendChild(chip);
      });

      tePrefixDiv.style.color = '#333';
      if (!empNum) {
        tePrefixDiv.textContent = '⚠ Employee number not set - configure in options';
        tePrefixDiv.style.color = '#c62828';
      } else {
        tePrefixDiv.textContent = 'Loading issue info…';
        chrome.runtime.sendMessage({action: 'getIssueInfo'}, function(response) {
          if (response && response.success) {
            currentIssueInfo = {itsm: response.itsm, op: response.op};
            tePrefixDiv.textContent = (response.itsm ? response.itsm + ':' : '') + response.op + ': …';
          } else {
            tePrefixDiv.textContent = (response && response.error) || 'Could not load issue info';
            tePrefixDiv.style.color = '#c62828';
          }
        });
      }

      viewMail.style.display = 'none';
      viewTimeEntry.style.display = 'block';
    });
    });
  });

  backTimeEntryBtn.addEventListener('click', function() {
    viewTimeEntry.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedStatus.textContent = '';
  });

  submitTimeEntryBtn.addEventListener('click', function() {
    var date = teDateInput.value;
    var startTime = teStartInput.value;
    var endTime = teEndInput.value;
    var profileIndex = teProfileSelect.value;
    var comment = teCommentTextarea.value.trim();

    teStatusDiv.style.color = 'red';
    if (!date) { teStatusDiv.textContent = 'Please select a date.'; return; }
    if (!startTime) { teStatusDiv.textContent = 'Please enter a start time.'; return; }
    if (!/^[0-9]{2}:[0-9]{2}$/.test(startTime)) { teStatusDiv.textContent = 'Start time must be HH:MM (e.g. 09:00).'; return; }
    if (!endTime) { teStatusDiv.textContent = 'Please enter an end time.'; return; }
    if (!/^[0-9]{2}:[0-9]{2}$/.test(endTime)) { teStatusDiv.textContent = 'End time must be HH:MM (e.g. 10:00).'; return; }
    if (profileIndex === '') { teStatusDiv.textContent = 'Please select a profile.'; return; }
    if (!currentIssueInfo) { teStatusDiv.textContent = 'Issue info not loaded. Is this a Jira page?'; return; }

    submitTimeEntryBtn.disabled = true;
    teStatusDiv.style.color = '#555';
    teStatusDiv.textContent = 'Submitting…';

    chrome.runtime.sendMessage({
      action: 'logTime',
      date: date,
      startTime: startTime,
      endTime: endTime,
      profileIndex: parseInt(profileIndex),
      comment: comment,
      itsm: currentIssueInfo.itsm,
      op: currentIssueInfo.op,
      sapCookies: teSapCookieInput.value.trim()
    }, function(response) {
      if (response && response.success) {
        var usedStart = response.startTime || startTime;
        var usedEnd = response.endTime || endTime;
        chrome.storage.local.set({ lastEndTime: usedEnd, lastEndDate: date });
        viewTimeEntry.style.display = 'none';
        viewMail.style.display = 'block';
        setCompletedStatus.style.color = 'green';
        setCompletedStatus.textContent = usedStart !== startTime
          ? 'Submitted at ' + usedStart + '–' + usedEnd + ' (slot shifted)'
          : 'Time entry submitted!';
        setTimeout(function() { window.close(); }, 1500);
      } else {
        teStatusDiv.style.color = 'red';
        teStatusDiv.textContent = (response && response.error) || 'Unknown error';
        submitTimeEntryBtn.disabled = false;
      }
    });
  });

  // Returns the suggested start time for today's next log entry.
  // Falls back to 08:30 when there's no saved entry for today.
  // Adds a mandatory 1-hour lunch break when the last entry ended between 12:00 and 13:00.
  function calcNextStartTime(lastEndTime, lastEndDate) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    if (!lastEndTime || lastEndDate !== todayStr) {
      return '08:30';
    }
    var parts = lastEndTime.split(':');
    var h = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    if (h >= 12 && h < 13) {
      h += 1; // enforce 1-hour lunch break
    }
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function addMinutesToTime(timeStr, minutes) {
    var parts = timeStr.split(':');
    var totalMin = parseInt(parts[0]) * 60 + parseInt(parts[1]) + minutes;
    return String(Math.floor(totalMin / 60) % 24).padStart(2, '0') + ':' +
           String(totalMin % 60).padStart(2, '0');
  }

  function populateMailTemplates(templates) {
    templates.forEach(function (template) {
      var li = document.createElement('li');
      li.className = 'template-item';
      li.innerHTML =
        '<div class="template-name">' + escapeHtml(template.name) + '</div>' +
        '<div class="template-preview">' +
          escapeHtml(template.body.substring(0, 70)) +
          (template.body.length > 70 ? '...' : '') +
        '</div>';
      li.addEventListener('click', function () {
        sendMailWithTemplate(template.body);
      });
      templateList.appendChild(li);
    });
  }

  // Returns the cached storage result synchronously if available, otherwise
  // reads all keys from storage and caches them before calling fn.
  function withStorage(fn) {
    if (storageCache) {
      fn(storageCache);
    } else {
      chrome.storage.local.get(
        ['mailTemplates', 'labelTemplates', 'copyIdComments', 'incResolutionTemplates',
         'timeProfiles', 'timeCommentTemplates', 'employeeNumber', 'sapCookies',
         'lastEndTime', 'lastEndDate'],
        function (result) {
          storageCache = result;
          fn(result);
        }
      );
    }
  }

  function sendMailWithTemplate(body) {
    chrome.runtime.sendMessage({ action: 'sendMail', templateBody: body });
    window.close();
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
});
