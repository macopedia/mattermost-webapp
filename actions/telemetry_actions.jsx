// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import store from 'stores/redux_store.jsx';

import {isDevMode} from 'utils/utils';

const SUPPORTS_CLEAR_MARKS = isSupported([performance.clearMarks]);
const SUPPORTS_MARK = isSupported([performance.mark]);
const SUPPORTS_MEASURE_METHODS = isSupported([
    performance.measure,
    performance.getEntries,
    performance.getEntriesByName,
    performance.clearMeasures,
]);

export function isTelemetryEnabled(state) {
    const config = getConfig(state);
    return config.DiagnosticsEnabled === 'true';
}

export function shouldTrackPerformance(state = store.getState()) {
    return isDevMode(state) || isTelemetryEnabled(state);
}

export function trackEvent(category, event, props) {
    Client4.trackEvent(category, event, props);
    if (isDevMode() && category === 'performance' && props) {
        // eslint-disable-next-line no-console
        console.log(event + ' - ' + Object.entries(props).map(([key, value]) => `${key}: ${value}`).join(', '));
    }
}

export function pageVisited(category, name) {
    Client4.pageVisited(category, name);
}

/**
 * Takes an array of string names of performance markers and invokes
 * performance.clearMarkers on each.
 * @param   {array} names of markers to clear
 *
 */
export function clearMarks(names) {
    if (!shouldTrackPerformance() || !SUPPORTS_CLEAR_MARKS) {
        return;
    }
    names.forEach((name) => performance.clearMarks(name));
}

export function mark(name) {
    if (!shouldTrackPerformance() || !SUPPORTS_MARK) {
        return;
    }
    performance.mark(name);
}

/**
 * Takes the names of two markers and invokes performance.measure on
 * them. The measured duration (ms) and the string name of the measure is
 * are returned.
 *
 * @param   {string} name1 the first marker
 * @param   {string} name2 the second marker
 *
 * @returns {[number, string]} Either the measured duration (ms) and the string name
 * of the measure are returned or -1 and and empty string is returned if
 * in dev. mode or one of the marker can't be found.
 *
 */
export function measure(name1, name2) {
    if (!shouldTrackPerformance() || !SUPPORTS_MEASURE_METHODS) {
        return [-1, ''];
    }

    // Check for existence of entry name to avoid DOMException
    const performanceEntries = performance.getEntries();
    if (![name1, name2].every((name) => performanceEntries.find((item) => item.name === name))) {
        return [-1, ''];
    }

    const displayPrefix = '🐐 Mattermost: ';
    const measurementName = `${displayPrefix}${name1} - ${name2}`;
    performance.measure(measurementName, name1, name2);
    const lastDuration = mostRecentDurationByEntryName(measurementName);

    // Clean up the measures we created
    performance.clearMeasures(measurementName);
    return [lastDuration, measurementName];
}

export function trackLoadTime() {
    if (!isSupported([performance.timing.loadEventEnd, performance.timing.navigationStart])) {
        return;
    }

    // Must be wrapped in setTimeout because loadEventEnd property is 0
    // until onload is complete, also time added because analytics
    // code isn't loaded until a subsequent window event has fired.
    const tenSeconds = 10000;
    setTimeout(() => {
        const {loadEventEnd, navigationStart} = window.performance.timing;
        const pageLoadTime = loadEventEnd - navigationStart;
        trackEvent('performance', 'page_load', {duration: pageLoadTime});
    }, tenSeconds);
}

function mostRecentDurationByEntryName(entryName) {
    const entriesWithName = performance.getEntriesByName(entryName);
    return entriesWithName.map((item) => item.duration)[entriesWithName.length - 1];
}

function isSupported(checks) {
    for (let i = 0, len = checks.length; i < len; i++) {
        const item = checks[i];
        if (typeof item === 'undefined') {
            return false;
        }
    }
    return true;
}

export function trackPluginInitialization(plugins) {
    if (!shouldTrackPerformance()) {
        return;
    }

    const resourceEntries = performance.getEntriesByType('resource');

    let startTime = Infinity;
    let endTime = 0;
    let totalDuration = 0;
    let totalSize = 0;

    for (const plugin of plugins) {
        const filename = plugin.webapp.bundle_path.substring(plugin.webapp.bundle_path.lastIndexOf('/'));
        const resource = resourceEntries.find((r) => r.name.endsWith(filename));

        if (!resource) {
            // This should never happen, but handle it just in case
            continue;
        }

        startTime = Math.min(resource.startTime, startTime);
        endTime = Math.max(resource.startTime + resource.duration, endTime);
        totalDuration += resource.duration;
        totalSize += resource.encodedBodySize;
    }

    trackEvent('performance', 'plugins_load', {
        count: plugins.length,
        duration: endTime - startTime,
        totalDuration,
        totalSize,
    });
}
