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

  // -- Set Completed: fetch resolutions from JIRA, then show picker --

  setCompletedBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    setCompletedBtn.disabled = true;
    setCompletedStatus.style.color = '#555';
    setCompletedStatus.textContent = 'Loading resolutions\u2026';

    chrome.runtime.sendMessage({ action: 'getResolutions' }, function (response) {
      setCompletedBtn.disabled = false;
      setCompletedStatus.textContent = '';

      if (!response || !response.success) {
        setCompletedStatus.style.color = 'red';
        setCompletedStatus.textContent = (response && response.error) ? response.error : 'Could not load resolutions';
        return;
      }

      // Rebuild list keeping "No resolution" as the first item
      while (resolutionList.children.length > 1) {
        resolutionList.removeChild(resolutionList.lastChild);
      }
      response.resolutions.forEach(function (resolution) {
        var li = document.createElement('li');
        li.className = 'template-item';
        li.innerHTML = '<div class="template-name">' + escapeHtml(resolution.name) + '</div>';
        li.addEventListener('click', function () {
          triggerSetCompleted(resolution.name);
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

  function triggerSetCompleted(resolutionName) {
    viewResolution.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedBtn.disabled = true;
    setCompletedStatus.style.color = '#555';
    setCompletedStatus.textContent = 'Working\u2026';

    chrome.runtime.sendMessage({ action: 'setCompleted', resolutionName: resolutionName }, function (response) {
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
