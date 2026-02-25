document.addEventListener('DOMContentLoaded', function () {
  var viewMail = document.getElementById('view-mail');
  var viewComment = document.getElementById('view-comment');
  var templateList = document.getElementById('template-list');
  var noTemplateItem = document.getElementById('no-template');
  var optionsLink = document.getElementById('options-link');
  var setCompletedBtn = document.getElementById('set-completed-btn');
  var commentTemplateList = document.getElementById('comment-template-list');
  var noCommentItem = document.getElementById('no-comment');
  var backBtn = document.getElementById('back-btn');
  var setCompletedStatus = document.getElementById('set-completed-status');

  // -- Set Completed: open comment template picker --

  setCompletedBtn.addEventListener('click', function () {
    setCompletedStatus.textContent = '';
    chrome.storage.local.get('completionTemplates', function (result) {
      var templates = result.completionTemplates || [];

      // Rebuild list keeping "No comment" as the first item
      while (commentTemplateList.children.length > 1) {
        commentTemplateList.removeChild(commentTemplateList.lastChild);
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
        commentTemplateList.appendChild(li);
      });

      viewMail.style.display = 'none';
      viewComment.style.display = 'block';
    });
  });

  noCommentItem.addEventListener('click', function () {
    triggerSetCompleted('');
  });

  backBtn.addEventListener('click', function () {
    viewComment.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedStatus.textContent = '';
  });

  function triggerSetCompleted(commentBody) {
    viewComment.style.display = 'none';
    viewMail.style.display = 'block';
    setCompletedBtn.disabled = true;
    setCompletedStatus.style.color = '#555';
    setCompletedStatus.textContent = 'Working\u2026';

    chrome.runtime.sendMessage({ action: 'setCompleted', commentBody: commentBody }, function (response) {
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
