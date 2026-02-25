document.addEventListener('DOMContentLoaded', function () {
  var templateList = document.getElementById('template-list');
  var noTemplateItem = document.getElementById('no-template');
  var optionsLink = document.getElementById('options-link');
  var setCompletedBtn = document.getElementById('set-completed-btn');
  var setCompletedStatus = document.getElementById('set-completed-status');

  setCompletedBtn.addEventListener('click', function () {
    setCompletedBtn.disabled = true;
    setCompletedBtn.textContent = 'Working\u2026';
    chrome.runtime.sendMessage({ action: 'setCompleted' }, function (response) {
      if (response && response.success) {
        setCompletedStatus.style.color = 'green';
        setCompletedStatus.textContent = 'Status updated successfully!';
        setTimeout(function () { window.close(); }, 1000);
      } else {
        setCompletedStatus.style.color = 'red';
        setCompletedStatus.textContent = (response && response.error) ? response.error : 'Unknown error';
        setCompletedBtn.textContent = 'Set Completed \u203a';
        setCompletedBtn.disabled = false;
      }
    });
  });

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
