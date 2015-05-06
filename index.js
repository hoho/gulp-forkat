/*!
 * gulp-forkat, https://github.com/hoho/gulp-forkat
 * (c) Marat Abdullin, MIT license
 */

'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = gutil.File;
var Buffer = require('buffer').Buffer;
var fs = require('fs');
var path = require('path');
var minimatch = require('minimatch');
var deepEqual = require('assert').deepEqual;


function createFile(path, content) {
    return new File({
        path: path,
        contents: new Buffer(content)
    });
}


module.exports = function() {
    var index = 0;
    var curSrc = [];
    var curStreams = [];
    var prevStreams = [];
    var cache = [];
    var merged;

    return function forkat(settings, callback) {
        if (typeof settings === 'string') {
            settings = {match: [settings]};
        } else if (settings instanceof Array) {
            settings = {match: settings};
        } else if (typeof settings !== 'object') {
            throw new PluginError('gulp-forkat', 'Incorrect settings');
        }

        if (typeof settings.match === 'string') {
            settings.match = [settings.match];
        } else if (settings.match && !(settings.match instanceof Array)) {
            throw new PluginError('gulp-forkat', 'Incorrect match');
        }

        forkat.merge = function() {
            if (merged) {
                throw new PluginError('gulp-forkat', 'Duplicate merge');
            }

            return (merged = through.obj(function(file, _, cb) {
                // Just skip the input stream. The result will be made from
                // cache in the end callback below.
                cb();
            }));
        };

        return (function(i) {
            var ret = through.obj(function(file, _, cb) {
                // Proxy all the files.
                this.push(file);

                var cur = curSrc[i];
                if (!cur) {
                    cur = curSrc[i] = [];
                }

                cur.push({
                    path: file.path,
                    contents: file.contents.toString()
                });

                cb();
            });

            ret.on('end', function() {
                if (!merged) {
                    throw new PluginError('gulp-forkat', 'No merge called');
                }

                var src = curSrc[i] || [];
                var filteredMap = {};
                var filtered;

                if (!settings.match || !settings.match.length) {
                    filtered = src;
                } else {
                    filtered = [];
                    settings.match.forEach(function(pattern) {
                        src.forEach(function(file) {
                            if (!(file.path in filteredMap)) {
                                if (minimatch(file.path, pattern)) {
                                    filteredMap[file.path] = true;
                                    filtered.push(file);
                                }
                            }
                        });
                    });
                }

                var cur = [];
                var prev = prevStreams[i] || [];

                if (settings.each) {
                    // Make a substream for each file.
                    cur = filtered.map(function(file) { return [file]; });
                } else {
                    cur.push(filtered);
                }

                curStreams[i] = cur;

                var oldCached = cache[i] || {};
                var oldCachedMap = oldCached.map || {};
                var cached = cache[i] = {streams: [], map: {}};

                cur.forEach(function(files, index) {
                    var same;
                    var first;
                    var key;

                    if (settings.each) {
                        first = files[0];
                        key = first.path;

                        if (key in oldCachedMap) {
                            var tmp = oldCachedMap[key];
                            same = tmp.contents === first.contents;

                            if (same) {
                                cached.streams.push(tmp.cached);
                                cached.map[key] = tmp;
                            }
                        } else {
                            same = false;
                        }
                    } else {
                        try {
                            deepEqual(files, prev[index]);
                            cached = cache[i] = oldCached;
                            same = true;
                        } catch(e) {
                            same = false;
                        }
                    }

                    if (!same) {
                        var cachedResult = [];
                        cached.streams.push(cachedResult);

                        if (settings.each) {
                            cached.map[key] = {
                                contents: first.contents,
                                cached: cachedResult
                            };
                        }

                        var src = through.obj(function(file, _, cb) {
                            this.push(file);
                            cb();
                        });

                        var ret = callback(src);

                        if (!ret || (typeof ret.on !== 'function')) {
                            throw new PluginError('gulp-forkat', 'Callback should return a file stream');
                        }

                        ret.on('data', function(file) {
                            cachedResult.push({
                                path: file.path,
                                contents: file.contents.toString()
                            });
                        });

                        files.forEach(function(file) {
                            src.push(createFile(file.path, file.contents));
                        });

                        src.end();
                    }
                });

                if (i === index - 1) {
                    while (cache.length > index) {
                        // Cleanup the cache in case the new one is shorter.
                        cache.pop();
                    }

                    cache.forEach(function(cached) {
                        ((cached || {}).streams || []).forEach(function(files) {
                            (files || []).forEach(function(file) {
                                merged.push(createFile(file.path, file.contents));
                            });
                        });
                    });

                    index = 0;
                    curSrc = [];
                    prevStreams = curStreams;
                    curStreams = [];
                    merged = undefined;
                }
            });

            return ret;
        })(index++);

    };
};
