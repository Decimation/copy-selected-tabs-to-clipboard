/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from './common.js';
import * as Constants from './constants.js';

export const ALL_URLS        = { origins: ['<all_urls>'] };
export const CLIPBOARD_WRITE = { permissions: ['clipboardWrite'], origins: ['<all_urls>'] };

export function clearRequest() {
  configs.requestingPermissions = null;
}

export function isGranted(permissions) {
  try {
    return browser.permissions.contains(permissions);
  }
  catch(_e) {
    return Promise.reject(new Error('unsupported permission'));
  }
}

export function bindToCheckbox(permissions, checkbox, options = {}) {
  isGranted(permissions)
    .then(granted => {
      checkbox.checked = granted;
    })
    .catch(_error => {
      checkbox.setAttribute('readonly', true);
      checkbox.setAttribute('disabled', true);
      const label = checkbox.closest('label') || document.querySelector(`label[for=${checkbox.id}]`);
      if (label)
        label.setAttribute('disabled', true);
    });

  checkbox.addEventListener('change', _event => {
    checkbox.requestPermissions()
  });

  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message ||
        !message.type ||
        message.type != Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED ||
        JSON.stringify(message.permissions) != JSON.stringify(permissions))
      return;
    if (options.onChanged)
      options.onChanged(true);
    checkbox.checked = true;
  });

  /*
    // These events are not available yet on Firefox...
    browser.permissions.onAdded.addListener(addedPermissions => {
      if (addedPermissions.permissions.indexOf('...') > -1)
        checkbox.checked = true;
    });
    browser.permissions.onRemoved.addListener(removedPermissions => {
      if (removedPermissions.permissions.indexOf('...') > -1)
        checkbox.checked = false;
    });
    */

  checkbox.requestPermissions = async () => {
    try {
      if (!checkbox.checked) {
        await browser.permissions.remove(permissions);
        if (options.onChanged)
          options.onChanged(false);
        return;
      }

      checkbox.checked = false;
      if (configs.requestingPermissionsNatively)
        return;

      const granted = await browser.permissions.request(permissions);
      if (granted === undefined)
        granted = await isGranted(permissions);
      else if (!granted)
        return;

      if (granted) {
        checkbox.checked = true;
        if (options.onChanged)
          options.onChanged(true);
        return;
      }
    }
    catch(error) {
      console.log(error);
    }
    checkbox.checked = false;
  };
}

export function requestPostProcess() {
  if (!configs.requestingPermissions)
    return false;

  const permissions = configs.requestingPermissions;
  configs.requestingPermissions = null;
  configs.requestingPermissionsNatively = permissions;

  browser.browserAction.setBadgeText({ text: '' });
  browser.permissions.request(permissions)
    .then(granted => {
      log('permission requested: ', permissions, granted);
      if (granted)
        browser.runtime.sendMessage({
          type:        Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED,
          permissions: permissions
        });
    })
    .finally(() => {
      configs.requestingPermissionsNatively = null;
    });
  return true;
}

export function isPermittedTab(tab) {
  if (tab.discarded)
    return false;
  return /^about:blank($|\?|#)/.test(tab.url) ||
         !/^(about|resource|chrome|file|view-source):/.test(tab.url);
}
