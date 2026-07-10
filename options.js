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
  renderIncResolutionTemplates();
  renderLabelTemplates();
  renderCopyIdComments();
  renderEmployeeNumber();
  renderDefaultStartTime();
  renderTimeProfiles();
  renderTimeCommentTemplates();
  renderJiraIssuesBoard();

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

  renderTemplates();
}

// ---- Template management ----

function loadTemplates(callback) {
  chrome.storage.local.get('mailTemplates', function (result) {
    callback(result.mailTemplates || []);
  });
}

function saveTemplates(templates) {
  chrome.storage.local.set({ 'mailTemplates': templates });
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function renderTemplates() {
  loadTemplates(function (templates) {
    var container = document.getElementById('template-list');
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No templates yet.</p>';
      return;
    }

    templates.forEach(function (template, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(template.name) + '</div>' +
          '<div class="template-entry-preview">' +
            escapeHtml(template.body.substring(0, 100)) +
            (template.body.length > 100 ? '...' : '') +
          '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteTemplate(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddForm() {
  document.getElementById('form-edit-id').value = '';
  document.getElementById('form-name').value = '';
  document.getElementById('form-body').value = '';
  document.getElementById('template-form').style.display = 'block';
  document.getElementById('form-name').focus();
}

function openEditForm(index) {
  loadTemplates(function (templates) {
    var t = templates[index];
    document.getElementById('form-edit-id').value = String(index);
    document.getElementById('form-name').value = t.name;
    document.getElementById('form-body').value = t.body;
    document.getElementById('template-form').style.display = 'block';
    document.getElementById('form-name').focus();
  });
}

function saveForm() {
  var name = document.getElementById('form-name').value.trim();
  var body = document.getElementById('form-body').value;
  var editId = document.getElementById('form-edit-id').value;

  if (!name) {
    alert('Please enter a template name.');
    return;
  }

  loadTemplates(function (templates) {
    if (editId === '') {
      templates.push({ id: String(Date.now()), name: name, body: body });
    } else {
      var idx = parseInt(editId);
      templates[idx] = { id: templates[idx].id, name: name, body: body };
    }
    saveTemplates(templates);
    document.getElementById('template-form').style.display = 'none';
    renderTemplates();
  });
}

function cancelForm() {
  document.getElementById('template-form').style.display = 'none';
}

function deleteTemplate(index) {
  loadTemplates(function (templates) {
    templates.splice(index, 1);
    saveTemplates(templates);
    renderTemplates();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  main();
  document.querySelector('#default').addEventListener('click', toggle);
  document.querySelector('#gmail').addEventListener('click', toggle);
  document.getElementById('add-template-btn').addEventListener('click', openAddForm);
  document.getElementById('form-save-btn').addEventListener('click', saveForm);
  document.getElementById('form-cancel-btn').addEventListener('click', cancelForm);
  document.getElementById('add-inc-resolution-btn').addEventListener('click', openAddIncResolutionForm);
  document.getElementById('inc-resolution-save-btn').addEventListener('click', saveIncResolutionForm);
  document.getElementById('inc-resolution-cancel-btn').addEventListener('click', cancelIncResolutionForm);
  document.getElementById('add-label-template-btn').addEventListener('click', openAddLabelTemplateForm);
  document.getElementById('label-template-save-btn').addEventListener('click', saveLabelTemplateForm);
  document.getElementById('label-template-cancel-btn').addEventListener('click', cancelLabelTemplateForm);
  document.getElementById('add-copy-id-comment-btn').addEventListener('click', openAddCopyIdCommentForm);
  document.getElementById('copy-id-comment-save-btn').addEventListener('click', saveCopyIdCommentForm);
  document.getElementById('copy-id-comment-cancel-btn').addEventListener('click', cancelCopyIdCommentForm);
  document.getElementById('save-employee-number-btn').addEventListener('click', saveEmployeeNumber);
  document.getElementById('save-default-start-time-btn').addEventListener('click', saveDefaultStartTime);
  document.getElementById('add-time-profile-btn').addEventListener('click', openAddTimeProfileForm);
  document.getElementById('time-profile-save-btn').addEventListener('click', saveTimeProfileForm);
  document.getElementById('time-profile-cancel-btn').addEventListener('click', cancelTimeProfileForm);
  document.getElementById('add-time-comment-btn').addEventListener('click', openAddTimeCommentForm);
  document.getElementById('time-comment-save-btn').addEventListener('click', saveTimeCommentForm);
  document.getElementById('time-comment-cancel-btn').addEventListener('click', cancelTimeCommentForm);
  document.getElementById('save-jira-issues-board-btn').addEventListener('click', saveJiraIssuesBoard);
});

// ---- INC Resolution template management ----

function loadIncResolutionTemplates(callback) {
  chrome.storage.local.get('incResolutionTemplates', function (result) {
    callback(result.incResolutionTemplates || []);
  });
}

function saveIncResolutionTemplates(templates) {
  chrome.storage.local.set({ 'incResolutionTemplates': templates });
}

function renderIncResolutionTemplates() {
  loadIncResolutionTemplates(function (templates) {
    var container = document.getElementById('inc-resolution-list');
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No templates yet.</p>';
      return;
    }

    templates.forEach(function (template, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(template.name) + '</div>' +
          '<div class="template-entry-preview">' +
            escapeHtml(template.body.substring(0, 100)) +
            (template.body.length > 100 ? '...' : '') +
          '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditIncResolutionForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteIncResolutionTemplate(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddIncResolutionForm() {
  document.getElementById('inc-resolution-edit-id').value = '';
  document.getElementById('inc-resolution-name').value = '';
  document.getElementById('inc-resolution-body').value = '';
  document.getElementById('inc-resolution-form').style.display = 'block';
  document.getElementById('inc-resolution-name').focus();
}

function openEditIncResolutionForm(index) {
  loadIncResolutionTemplates(function (templates) {
    var t = templates[index];
    document.getElementById('inc-resolution-edit-id').value = String(index);
    document.getElementById('inc-resolution-name').value = t.name;
    document.getElementById('inc-resolution-body').value = t.body;
    document.getElementById('inc-resolution-form').style.display = 'block';
    document.getElementById('inc-resolution-name').focus();
  });
}

function saveIncResolutionForm() {
  var name = document.getElementById('inc-resolution-name').value.trim();
  var body = document.getElementById('inc-resolution-body').value;
  var editId = document.getElementById('inc-resolution-edit-id').value;

  if (!name) {
    alert('Please enter a template name.');
    return;
  }

  loadIncResolutionTemplates(function (templates) {
    if (editId === '') {
      templates.push({ id: String(Date.now()), name: name, body: body });
    } else {
      var idx = parseInt(editId);
      templates[idx] = { id: templates[idx].id, name: name, body: body };
    }
    saveIncResolutionTemplates(templates);
    document.getElementById('inc-resolution-form').style.display = 'none';
    renderIncResolutionTemplates();
  });
}

function cancelIncResolutionForm() {
  document.getElementById('inc-resolution-form').style.display = 'none';
}

function deleteIncResolutionTemplate(index) {
  loadIncResolutionTemplates(function (templates) {
    templates.splice(index, 1);
    saveIncResolutionTemplates(templates);
    renderIncResolutionTemplates();
  });
}

// ---- Label Templates management ----

function loadLabelTemplates(callback) {
  chrome.storage.local.get('labelTemplates', function (result) {
    callback(result.labelTemplates || []);
  });
}

function saveLabelTemplates(templates) {
  chrome.storage.local.set({ 'labelTemplates': templates });
}

function renderLabelTemplates() {
  loadLabelTemplates(function (templates) {
    var container = document.getElementById('label-template-list');
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No templates yet.</p>';
      return;
    }

    templates.forEach(function (template, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(template.name) + '</div>' +
          '<div class="template-entry-preview">' + escapeHtml(template.body) + '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditLabelTemplateForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteLabelTemplate(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddLabelTemplateForm() {
  document.getElementById('label-template-edit-id').value = '';
  document.getElementById('label-template-name').value = '';
  document.getElementById('label-template-body').value = '';
  document.getElementById('label-template-form').style.display = 'block';
  document.getElementById('label-template-name').focus();
}

function openEditLabelTemplateForm(index) {
  loadLabelTemplates(function (templates) {
    var t = templates[index];
    document.getElementById('label-template-edit-id').value = String(index);
    document.getElementById('label-template-name').value = t.name;
    document.getElementById('label-template-body').value = t.body;
    document.getElementById('label-template-form').style.display = 'block';
    document.getElementById('label-template-name').focus();
  });
}

function saveLabelTemplateForm() {
  var name = document.getElementById('label-template-name').value.trim();
  var body = document.getElementById('label-template-body').value.trim();
  var editId = document.getElementById('label-template-edit-id').value;

  if (!name) {
    alert('Please enter a template name.');
    return;
  }
  if (!body) {
    alert('Please enter a label text.');
    return;
  }

  loadLabelTemplates(function (templates) {
    if (editId === '') {
      templates.push({ id: String(Date.now()), name: name, body: body });
    } else {
      var idx = parseInt(editId);
      templates[idx] = { id: templates[idx].id, name: name, body: body };
    }
    saveLabelTemplates(templates);
    document.getElementById('label-template-form').style.display = 'none';
    renderLabelTemplates();
  });
}

function cancelLabelTemplateForm() {
  document.getElementById('label-template-form').style.display = 'none';
}

function deleteLabelTemplate(index) {
  loadLabelTemplates(function (templates) {
    templates.splice(index, 1);
    saveLabelTemplates(templates);
    renderLabelTemplates();
  });
}

// ---- Copy ID Comments management ----

function loadCopyIdComments(callback) {
  chrome.storage.local.get('copyIdComments', function (result) {
    callback(result.copyIdComments || []);
  });
}

function saveCopyIdComments(comments) {
  chrome.storage.local.set({ 'copyIdComments': comments });
}

function renderCopyIdComments() {
  loadCopyIdComments(function (comments) {
    var container = document.getElementById('copy-id-comment-list');
    container.innerHTML = '';

    if (comments.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No comments yet.</p>';
      return;
    }

    comments.forEach(function (comment, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(comment.name) + '</div>' +
          '<div class="template-entry-preview">' +
            escapeHtml(comment.body.substring(0, 100)) +
            (comment.body.length > 100 ? '...' : '') +
          '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditCopyIdCommentForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteCopyIdComment(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddCopyIdCommentForm() {
  document.getElementById('copy-id-comment-edit-id').value = '';
  document.getElementById('copy-id-comment-name').value = '';
  document.getElementById('copy-id-comment-body').value = '';
  document.getElementById('copy-id-comment-form').style.display = 'block';
  document.getElementById('copy-id-comment-name').focus();
}

function openEditCopyIdCommentForm(index) {
  loadCopyIdComments(function (comments) {
    var c = comments[index];
    document.getElementById('copy-id-comment-edit-id').value = String(index);
    document.getElementById('copy-id-comment-name').value = c.name;
    document.getElementById('copy-id-comment-body').value = c.body;
    document.getElementById('copy-id-comment-form').style.display = 'block';
    document.getElementById('copy-id-comment-name').focus();
  });
}

function saveCopyIdCommentForm() {
  var name = document.getElementById('copy-id-comment-name').value.trim();
  var body = document.getElementById('copy-id-comment-body').value;
  var editId = document.getElementById('copy-id-comment-edit-id').value;

  if (!name) {
    alert('Please enter a comment name.');
    return;
  }

  loadCopyIdComments(function (comments) {
    if (editId === '') {
      comments.push({ id: String(Date.now()), name: name, body: body });
    } else {
      var idx = parseInt(editId);
      comments[idx] = { id: comments[idx].id, name: name, body: body };
    }
    saveCopyIdComments(comments);
    document.getElementById('copy-id-comment-form').style.display = 'none';
    renderCopyIdComments();
  });
}

function cancelCopyIdCommentForm() {
  document.getElementById('copy-id-comment-form').style.display = 'none';
}

function deleteCopyIdComment(index) {
  loadCopyIdComments(function (comments) {
    comments.splice(index, 1);
    saveCopyIdComments(comments);
    renderCopyIdComments();
  });
}

// ---- Employee Number ----

function renderEmployeeNumber() {
  chrome.storage.local.get('employeeNumber', function (result) {
    document.getElementById('employee-number').value = result.employeeNumber || '';
  });
}

function saveEmployeeNumber() {
  var num = document.getElementById('employee-number').value.trim();
  chrome.storage.local.set({ employeeNumber: num }, function () {
    var status = document.getElementById('employee-number-status');
    status.style.color = 'green';
    status.textContent = 'Saved.';
    setTimeout(function () { status.textContent = ''; }, 2000);
  });
}

// ---- Default Start Time ----

function renderDefaultStartTime() {
  chrome.storage.local.get('defaultStartTime', function (result) {
    document.getElementById('default-start-time').value = result.defaultStartTime || '08:30';
  });
}

function saveDefaultStartTime() {
  var val = document.getElementById('default-start-time').value;
  if (!val) val = '08:30';
  chrome.storage.local.set({ defaultStartTime: val }, function () {
    var status = document.getElementById('default-start-time-status');
    status.style.color = 'green';
    status.textContent = 'Saved.';
    setTimeout(function () { status.textContent = ''; }, 2000);
  });
}

// ---- Jira Issues Board ----

var JIRA_BOARD_DEFAULTS = {
  jiraRapidViewId: '2801',
  jiraQuickFilterUnassigned: '14060',
  jiraQuickFilterAssignedToMe: '14047',
  jiraQuickFilterAssignedToMeRecent: '14048'
};

function renderJiraIssuesBoard() {
  chrome.storage.local.get(Object.keys(JIRA_BOARD_DEFAULTS), function (result) {
    document.getElementById('jira-rapidview-id').value = result.jiraRapidViewId || JIRA_BOARD_DEFAULTS.jiraRapidViewId;
    document.getElementById('jira-qf-unassigned').value = result.jiraQuickFilterUnassigned || JIRA_BOARD_DEFAULTS.jiraQuickFilterUnassigned;
    document.getElementById('jira-qf-assigned-to-me').value = result.jiraQuickFilterAssignedToMe || JIRA_BOARD_DEFAULTS.jiraQuickFilterAssignedToMe;
    document.getElementById('jira-qf-assigned-to-me-recent').value = result.jiraQuickFilterAssignedToMeRecent || JIRA_BOARD_DEFAULTS.jiraQuickFilterAssignedToMeRecent;
  });
}

function saveJiraIssuesBoard() {
  var payload = {
    jiraRapidViewId: document.getElementById('jira-rapidview-id').value.trim() || JIRA_BOARD_DEFAULTS.jiraRapidViewId,
    jiraQuickFilterUnassigned: document.getElementById('jira-qf-unassigned').value.trim() || JIRA_BOARD_DEFAULTS.jiraQuickFilterUnassigned,
    jiraQuickFilterAssignedToMe: document.getElementById('jira-qf-assigned-to-me').value.trim() || JIRA_BOARD_DEFAULTS.jiraQuickFilterAssignedToMe,
    jiraQuickFilterAssignedToMeRecent: document.getElementById('jira-qf-assigned-to-me-recent').value.trim() || JIRA_BOARD_DEFAULTS.jiraQuickFilterAssignedToMeRecent
  };
  chrome.storage.local.set(payload, function () {
    var status = document.getElementById('jira-issues-board-status');
    status.style.color = 'green';
    status.textContent = 'Saved.';
    setTimeout(function () { status.textContent = ''; }, 2000);
  });
}

// ---- Time Entry Profiles ----

function loadTimeProfiles(callback) {
  chrome.storage.local.get('timeProfiles', function (result) {
    callback(result.timeProfiles || []);
  });
}

function saveTimeProfiles(profiles) {
  chrome.storage.local.set({ timeProfiles: profiles });
}

function renderTimeProfiles() {
  loadTimeProfiles(function (profiles) {
    var container = document.getElementById('time-profile-list');
    container.innerHTML = '';

    if (profiles.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No profiles yet.</p>';
      return;
    }

    profiles.forEach(function (p, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="template-entry-preview">' +
            escapeHtml('Type: ' + p.lstarKey + (p.psp ? ' | ' + (p.targetElementType || 'KAUFTR') + ': ' + p.psp : '') + (p.position ? ' | Pos: ' + p.position : '') + (p.jiraProjects && p.jiraProjects.length ? ' | Projects: ' + p.jiraProjects.join(', ') : '') + (p.profileType === 'rfc' ? ' | RFC' : '') + (p.prependId === false ? ' | No ID prefix' : '')) +
          '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditTimeProfileForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteTimeProfile(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddTimeProfileForm() {
  document.getElementById('time-profile-edit-id').value = '';
  document.getElementById('time-profile-name').value = '';
  document.getElementById('time-profile-lstar').value = '';
  document.getElementById('time-profile-element-type').value = 'KAUFTR';
  document.getElementById('time-profile-psp').value = '';
  document.getElementById('time-profile-position').value = '';
  document.getElementById('time-profile-jira-projects').value = '';
  document.getElementById('time-profile-type').value = 'incident';
  document.getElementById('time-profile-prepend-id').checked = true;
  document.getElementById('time-profile-form').style.display = 'block';
  document.getElementById('time-profile-name').focus();
}

function openEditTimeProfileForm(index) {
  loadTimeProfiles(function (profiles) {
    var p = profiles[index];
    document.getElementById('time-profile-edit-id').value = String(index);
    document.getElementById('time-profile-name').value = p.name;
    document.getElementById('time-profile-lstar').value = p.lstarKey;
    document.getElementById('time-profile-element-type').value = p.targetElementType || '';
    document.getElementById('time-profile-psp').value = p.psp || '';
    document.getElementById('time-profile-position').value = p.position || '';
    document.getElementById('time-profile-jira-projects').value = (p.jiraProjects || []).join(', ');
    document.getElementById('time-profile-type').value = p.profileType || 'incident';
    document.getElementById('time-profile-prepend-id').checked = p.prependId !== false;
    document.getElementById('time-profile-form').style.display = 'block';
    document.getElementById('time-profile-name').focus();
  });
}

function saveTimeProfileForm() {
  var name = document.getElementById('time-profile-name').value.trim();
  var lstarKey = document.getElementById('time-profile-lstar').value.trim();
  var targetElementType = document.getElementById('time-profile-element-type').value;
  var psp = document.getElementById('time-profile-psp').value.trim();
  var position = document.getElementById('time-profile-position').value.trim();
  var jiraProjects = document.getElementById('time-profile-jira-projects').value
    .split(',').map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean);
  var profileType = document.getElementById('time-profile-type').value;
  var prependId = document.getElementById('time-profile-prepend-id').checked;
  var editId = document.getElementById('time-profile-edit-id').value;

  if (!name) { alert('Please enter a profile name.'); return; }
  if (!lstarKey) { alert('Please enter the Type de prestation code.'); return; }

  loadTimeProfiles(function (profiles) {
    var entry = { id: String(Date.now()), name: name, lstarKey: lstarKey, targetElementType: targetElementType, psp: psp, position: position, jiraProjects: jiraProjects, profileType: profileType, prependId: prependId };
    if (editId === '') {
      profiles.push(entry);
    } else {
      var idx = parseInt(editId);
      entry.id = profiles[idx].id;
      profiles[idx] = entry;
    }
    saveTimeProfiles(profiles);
    document.getElementById('time-profile-form').style.display = 'none';
    renderTimeProfiles();
  });
}

function cancelTimeProfileForm() {
  document.getElementById('time-profile-form').style.display = 'none';
}

function deleteTimeProfile(index) {
  loadTimeProfiles(function (profiles) {
    profiles.splice(index, 1);
    saveTimeProfiles(profiles);
    renderTimeProfiles();
  });
}

// ---- Time Comment Templates ----

function loadTimeCommentTemplates(callback) {
  chrome.storage.local.get('timeCommentTemplates', function (result) {
    callback(result.timeCommentTemplates || []);
  });
}

function saveTimeCommentTemplates(templates) {
  chrome.storage.local.set({ timeCommentTemplates: templates });
}

function renderTimeCommentTemplates() {
  loadTimeCommentTemplates(function (templates) {
    var container = document.getElementById('time-comment-list');
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = '<p class="no-templates-msg">No templates yet.</p>';
      return;
    }

    templates.forEach(function (t, index) {
      var entry = document.createElement('div');
      entry.className = 'template-entry';
      entry.innerHTML =
        '<div class="template-entry-info">' +
          '<div class="template-entry-name">' + escapeHtml(t.name) + '</div>' +
          '<div class="template-entry-preview">' +
            escapeHtml(t.body.substring(0, 100)) + (t.body.length > 100 ? '...' : '') +
          '</div>' +
        '</div>' +
        '<div class="template-entry-actions">' +
          '<button class="btn btn-sm" data-index="' + index + '" data-action="edit">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-index="' + index + '" data-action="delete">Delete</button>' +
        '</div>';
      container.appendChild(entry);
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditTimeCommentForm(parseInt(btn.dataset.index));
      });
    });

    container.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteTimeComment(parseInt(btn.dataset.index));
      });
    });
  });
}

function openAddTimeCommentForm() {
  document.getElementById('time-comment-edit-id').value = '';
  document.getElementById('time-comment-name').value = '';
  document.getElementById('time-comment-body').value = '';
  document.getElementById('time-comment-form').style.display = 'block';
  document.getElementById('time-comment-name').focus();
}

function openEditTimeCommentForm(index) {
  loadTimeCommentTemplates(function (templates) {
    var t = templates[index];
    document.getElementById('time-comment-edit-id').value = String(index);
    document.getElementById('time-comment-name').value = t.name;
    document.getElementById('time-comment-body').value = t.body;
    document.getElementById('time-comment-form').style.display = 'block';
    document.getElementById('time-comment-name').focus();
  });
}

function saveTimeCommentForm() {
  var name = document.getElementById('time-comment-name').value.trim();
  var body = document.getElementById('time-comment-body').value.trim();
  var editId = document.getElementById('time-comment-edit-id').value;

  if (!name) { alert('Please enter a template name.'); return; }
  if (!body) { alert('Please enter the comment text.'); return; }

  loadTimeCommentTemplates(function (templates) {
    if (editId === '') {
      templates.push({ id: String(Date.now()), name: name, body: body });
    } else {
      var idx = parseInt(editId);
      templates[idx] = { id: templates[idx].id, name: name, body: body };
    }
    saveTimeCommentTemplates(templates);
    document.getElementById('time-comment-form').style.display = 'none';
    renderTimeCommentTemplates();
  });
}

function cancelTimeCommentForm() {
  document.getElementById('time-comment-form').style.display = 'none';
}

function deleteTimeComment(index) {
  loadTimeCommentTemplates(function (templates) {
    templates.splice(index, 1);
    saveTimeCommentTemplates(templates);
    renderTimeCommentTemplates();
  });
}
