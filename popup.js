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

  // -- Add Label: load label templates, then show picker --

  addLabelBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    chrome.storage.local.get('labelTemplates', function (result) {
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
    chrome.storage.local.get('copyIdComments', function (result) {
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
    chrome.storage.local.get('incResolutionTemplates', function (result) {
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
    setCompletedStatus.textContent = 'Working\u2026';

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

  chrome.storage.local.get('mailTemplates', function (result) {
    var templates = result.mailTemplates || [];
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
  });

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
