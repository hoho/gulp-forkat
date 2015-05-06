var through = require('through2');
var forkat = require('../');
var should = require('should');
var File = require('gulp-util').File;
var Buffer = require('buffer').Buffer;
var fs = require('fs');
require('mocha');


describe('gulp-forkat', function() {
    describe('forkat()', function() {
        var forkat1 = forkat();
        var ret = [];

        testForkat(
            forkat1,
            [
                [
                    {match: 'test/file2.css'},
                    function(src) {
                        ret.push('run1');
                        return src;
                    }
                ],
                [
                    {each: true, match: ['**/file3.txt', '**/file2.txt', '**/file1.txt']},
                    function(src) {
                        ret.push('run2');
                        return src;
                    }
                ],
                [
                    'test/file3.css',
                    function(src) {
                        ret.push('run3');
                        return src;
                    }
                ]
            ],
            [
                'test/file1.txt',
                'test/file2.txt',
                'test/file3.txt',
                'test/file1.css',
                'test/file2.css',
                'test/file3.css'
            ],
            [
                'task4',
                'run1',
                'run2',
                'run2',
                'run2',
                'run3',
                'test/file2.css: /* file2.css */\n',
                'test/file3.txt: file3.txt\n',
                'test/file2.txt: file2.txt\n',
                'test/file1.txt: file1.txt\n',
                'test/file3.css: /* file3.css */\n',
                'task3',
                'test/file2.css: /* file2.css */\n',
                'test/file3.txt: file3.txt\n',
                'test/file2.txt: file2.txt\n',
                'test/file1.txt: file1.txt\n',
                'test/file3.css: /* file3.css */\n',
                'task2',
                'run2',
                'run3',
                'test/file2.css: /* file2.css */\n',
                'test/file3.txt: file3.txt\n',
                'test/file2.txt: ololo',
                'test/file1.txt: file1.txt\n',
                'test/file3.css: ololo',
                'task1',
                'test/file2.css: /* file2.css */\n',
                'test/file3.txt: file3.txt\n',
                'test/file2.txt: ololo',
                'test/file1.txt: file1.txt\n',
                'test/file3.css: ololo'
            ]

        );


        function testForkat(forkat, forkats, files, expected) {
            it('should forkat', function(done) {
                var tasks = 4;

                task();

                function task() {
                    ret.push('task' + tasks);

                    var stream = through.obj(function(file, _, cb) {
                        this.push(file);
                        cb();
                    });

                    var cur = stream;

                    forkats.forEach(function(f) {
                        cur = cur.pipe(forkat(f[0], f[1]));
                    });

                    cur = cur.pipe(forkat.merge());

                    cur.on('data', function(file) {
                        ret.push(file.path + ': ' + file.contents.toString());
                    });
                    cur.on('end', function() {
                        if (--tasks > 0) {
                            task();
                        } else {
                            should.deepEqual(ret, expected);
                            done();
                        }
                    });

                    files.forEach(function(filename, index) {
                        stream.push(new File({
                            path: filename,
                            contents: tasks < 3 && (index === 1 || index === 5) ? new Buffer('ololo') : fs.readFileSync(filename)
                        }));
                    });

                    stream.end();
                }
            });
        }
    });
});
