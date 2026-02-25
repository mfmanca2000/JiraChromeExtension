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
});
