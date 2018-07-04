/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Selection from './selection.js';
import * as DragSelection from './drag-selection.js';

import EventListenerManager from '../extlib/EventListenerManager.js';

export const onUpdated = new EventListenerManager();

const kCOMMAND_PULL = 'multipletab:shared-state:pull';
const kCOMMAND_PUSH = 'multipletab:shared-state:push';

export function initAsMaster() {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message || !message.type)
      return;

    switch (message.type) {
      case kCOMMAND_PULL:
        return Promise.resolve(serialize());
    }
  });
}

export async function initAsSlave() {
  const state = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL
  });
  apply(state);
}

function reservePush() {
  if (reservePush.reserved)
    clearTimeout(reservePush.reserved);
  reservePush.reserved = setTimeout(() => {
    push();
  }, 150);
}

export async function push(extraInfo = {}) {
  if (reservePush.reserved) {
    clearTimeout(reservePush.reserved);
    delete reservePush.reserved;
  }
  await browser.runtime.sendMessage({
    type:  kCOMMAND_PUSH,
    state: serialize(),
    extraInfo
  });
}

function serialize() {
  return {
    selection: Selection.serialize(),
    dragSelection: DragSelection.serialize()
  };
}

function apply(selections, extraInfo = {}) {
  Selection.apply(selections.selection);
  DragSelection.apply(selections.dragSelection);
  onUpdated.dispatch(extraInfo);
}


browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case kCOMMAND_PUSH:
      apply(message.state, message.extraInfo);
      break;

    default:
      break;
  }
});

Selection.onChange.addListener((_tabs, _selected, _options = {}) => {
  reservePush();
});
