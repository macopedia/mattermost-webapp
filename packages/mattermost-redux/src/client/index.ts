// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4 as Client4Class, DEFAULT_LIMIT_AFTER, DEFAULT_LIMIT_BEFORE} from '@mattermost/client/index';

const Client4 = new Client4Class();

export {
    Client4,
    DEFAULT_LIMIT_AFTER,
    DEFAULT_LIMIT_BEFORE,
};
