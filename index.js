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


function createFile(path, content) {
    return new File({
        path: path,
        contents: new Buffer(content)
    });
}


module.exports = function() {
    var index = 0;
    var curSrc = [];
    var prevSrc = [];
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

                var cur = curSrc[i] || [];
                var prev = prevSrc[i] || [];
                var same = cur.length === prev.length;

                if (same) {
                    for (var j = 0; j < cur.length; j++) {
                        if (cur[j].path !== prev[j].path ||
                            cur[j].contents !== prev[j].contents)
                        {
                            same = false;
                            break;
                        }
                    }
                }

                if (!same) {
                    var filteredMap = {};
                    var filtered;
                    var cached = cache[i] = [];
                    var substreams = [];

                    if (!settings.match || !settings.match.length) {
                        filtered = cur;
                    } else {
                        filtered = [];
                        settings.match.forEach(function(pattern) {
                            cur.forEach(function(file) {
                                if (!(file.path in filteredMap)) {
                                    if (minimatch(file.path, pattern)) {
                                        filteredMap[file.path] = true;
                                        filtered.push(file);
                                    }
                                }
                            });
                        });
                    }

                    if (settings.each) {
                        // Make a substream for each file.
                        filtered.forEach(function(file) {
                            substreams.push([file]);
                        });
                    } else {
                        substreams.push(filtered);
                    }

                    substreams.forEach(function(src) {
                        var cachedSubstream = [];
                        cached.push(cachedSubstream);

                        var substream = through.obj(function(file, _, cb) {
                            this.push(file);
                            cb();
                        });

                        var ret = callback(substream);

                        if (!ret || (typeof ret.on !== 'function')) {
                            throw new PluginError('gulp-forkat', 'Callback should return a file stream');
                        }

                        ret.on('data', function(file) {
                            cachedSubstream.push({
                                path: file.path,
                                contents: file.contents.toString()
                            });
                        });

                        src.forEach(function(file) {
                            substream.push(createFile(file.path, file.contents));
                        });

                        substream.end();
                    });
                }

                if (i === curSrc.length - 1) {
                    while (cache.length > curSrc.length) {
                        // Cleanup the cache in case the new one is shorter.
                        cache.pop();
                    }

                    cache.forEach(function(substreams) {
                        (substreams || []).forEach(function(substream) {
                            (substream || []).forEach(function(file) {
                                merged.push(createFile(file.path, file.contents));
                            });
                        });
                    });

                    index = 0;
                    prevSrc = curSrc;
                    curSrc = [];
                    merged = undefined;
                }
            });

            return ret;
        })(index++);

    };

/*


    var oldFiles = [],
        newFiles = [];

    if (typeof files === 'object') {
        for (var file in files) {
            if (files.hasOwnProperty(file)) {
                newFiles.push(createFile(file, files[file]));
            }
        }
        before = content;
    } else if (typeof files === 'string') {
        switch (typeof content) {
            case 'string':
                newFiles.push(createFile(files, content));
                break;

            default:
                throw new PluginError('gulp-add', 'Unknown argument type');
        }
    } else {
        throw new PluginError('gulp-add', 'Unknown argument type');
    }

    if ((before !== undefined) && (typeof before !== 'boolean')) {
        throw new PluginError('gulp-add', '`before` argument should be boolean');
    }

    function bufferContents(file) {
        if (file.isNull()) { return; }
        if (file.isStream()) { return this.emit('error', new PluginError('gulp-add',  'Streaming not supported')); }

        oldFiles.push(file);
    }

    function endStream() {
        try {
            var i;

            if (before) {
                // Insert new files before old ones.
                i = oldFiles;
                oldFiles = newFiles;
                newFiles = i;
            }

            for (i = 0; i < oldFiles.length; i++) {
                this.emit('data', oldFiles[i]);
            }

            for (i = 0; i < newFiles.length; i++) {
                this.emit('data', newFiles[i]);
            }
        } catch(e) {
            return this.emit('error', new PluginError('gulp-add', e.message));
        }

        this.emit('end');
    }

    return through(bufferContents, endStream);*/
};
