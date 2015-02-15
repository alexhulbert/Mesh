var express = require('express');
var router = express.Router();
var util = require('util');
var youtube = require('googleapis').youtube('v3');
var ytdl = require('ytdl-core');
var proc = require('child_process');
var gs = require('grooveshark-streaming');
var request = require('request');
var async = require('async');
var path = require('path');

var safePattern = /^[a-z0-9_\/\-.,?:@#%^+=\[\]{}|&()<>; *']*$/i;
function bashEscape(arg) {
  if (safePattern.test(arg)) return arg;
  return arg.replace(/'+/g, function (val) {
    if (val.length < 3) return val.replace(/'/g, "\\'");
    return '"' + val + '"';
  });
}

GLOBAL.stream = function(req, res) {
    async.waterfall([
        function(next) {
            var query = util.format('%s - %s', req.params.artist, req.params.song); //TODO: Make this better :P
            youtube.search.list({
                part: 'id,snippet',
                q: query,
                maxResults: 10,
                key: process.env.YOUTUBE_KEY,
                type: 'video'
                //videoEmbeddable: true,
                //videoSyndicated: true
            }, function(err, json) {
                next(null, json, err);
            });
        },
        function(json, err, next) {
            var vidId = "";
            var reg = /cover|full album|remake/gi; //I should probably tweak this
            if (typeof json === 'undefined') {
                console.log(err);
                next("grooveshark");
                return;
            }
            for (var item in json.items) {
               if (!json.items[item].snippet.title.match(reg)) {
                   vidId = json.items[item].id.videoId;
                   break;
               }
            }
            
            if (vidId === "") {
                next("grooveshark");
                return;
            }
            
            ytdl.getInfo('http://www.youtube.com/watch?v=' + vidId, { downloadURL: true }, function(err, info) {
                var findMax = {
                    bitrate: 0,
                    useAudio: false,
                    id: 0
                };
                if (typeof info === 'undefined') {
                    return next("grooveshark");
                    //TODO: Fix this?
                } 
                for (var i = (info.formats.length - 1); i >= 0; i--) {
                    var format = info.formats[i];
                    if (format.type.indexOf('audio') === 0) {
                        if (format.audioBitrate > findMax.bitrate) {
                            findMax.bitrate = format.audioBitrate;
                            findMax.id = i;
                            findMax.useAudio = true;
                        }
                    } else {
                        if (format.audioBitrate > findMax.bitrate && format.audioBitrate !== null) {
                            findMax.bitrate = format.audioBitrate;
                            findMax.id = i;
                            findMax.useAudio = false;
                        }
                    }
                }
                if ((findMax.useAudio && req.params.dowhat != 'download') || req.params.dowhat == 'metadata') {
                    if (req.params.dowhat == 'metadata') {
                        proc.exec(path.join(process.env.FFMPEG_DIR, 'ffprobe') + ' -i "' + info.formats[findMax.id].url + '" -show_format', function(err, stdout) {
                            res.end(stdout.replace(/[\s\S]*duration=([0-9\.]+)\n[\s\S]+/, '$1'));
                        });
                    } else {
                        var data = info.formats[findMax.id];
                        var ytReq = request(data.url);
                        ytReq.pipe(res);
                        res.setHeader('Accept-Ranges', 'bytes');
                        res.setHeader('Content-Length', data.clen);
                        res.setHeader('Content-Range', util.format('bytes 0-%d/%d', data.clen - 1, data.clen));
                        res.oldWriteHead = res.writeHead;
                        res.writeHead = function(statusCode, reasonPhrase, headers) {
                            res.setHeader('Content-Type', req.params.dowhat == 'download' ? 'application/octet-stream' : data.type);
                            res.removeHeader('x-content-type-options');
                            res.removeHeader('cache-control');
                            res.removeHeader('alternate-protocol');
                            res.removeHeader('server');
                            res.oldWriteHead(statusCode, reasonPhrase, headers);
                        };
                    }
                } else {
                    res.setHeader('Accept-Ranges', 'bytes');
                    res.setHeader('Content-Type', req.params.dowhat == 'download' ? 'application/octet-stream' : 'audio/mpeg');
                    var cmdOpts = ['-i', 'pipe:0', '-acodec', 'libmp3lame'];
                    if (req.params.dowhat == 'download') {
                        res.setHeader('Content-disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(req.params.artist) + '%20-%20' + encodeURIComponent(req.params.song) + '.mp3');
                        cmdOpts.push(
                            '-id3v2_version', '3',
                            '-metadata', 'title='  + bashEscape(req.params.song),
                            '-metadata', 'artist=' + bashEscape(req.params.artist)
                        );
                    }
                    cmdOpts.push('-f', 'mp3', '-');
                    var ffmpeg_child = proc.spawn(path.join(process.env.FFMPEG_DIR, 'ffmpeg'), cmdOpts);
                    ffmpeg_child.stdout.pipe(res);
                    var ytdlStream = ytdl.downloadFromInfo(info, {
                        //filter: function(format) { return info.formats[findMax.id] === format; }
                        quality: 'highest'
                    })
                    ytdlStream.on('error', function() {
                        res.end(''); //Does this fix the 403 issue?
                    });
                    ytdlStream.pipe(ffmpeg_child.stdin);
                }
            });
        }
    ], function(err){ 
        if (err == "grooveshark") {
            if (req.params.dowhat == 'metadata') {
                gs.Tinysong.getSongInfo(req.params.song, req.params.artist, function(err, songInfo) {
                    if (songInfo !== null) {
                        gs.Grooveshark.getStreamingUrl(songInfo.SongID, function(err, streamUrl) {
                            proc.exec('ffprobe -i "' + streamUrl + '" -show_format', function(err, stdout) {
                                res.end(stdout.replace(/[\s\S]*duration=([0-9\.]+)\n[\s\S]+/, '$1'));
                            });
                        });
                    } else {
                        console.log('!> Metadata for non-existing song');
                        res.end("0");
                    }
                });
            } else {
                gs.Tinysong.getSongInfo(req.params.song, req.params.artist, function(err, songInfo) {
                    if (songInfo !== null) {
                        gs.Grooveshark.getStreamingUrl(songInfo.SongID, function(err, streamUrl) {
                            request(streamUrl)
                            .on('response', function(resp) {
                                res.setHeader('content-length', resp.request.response.headers['content-length']);
                            })
                            .pipe(res);
                        });
                    } else {
                        console.log('!> Song not found! (' + req.params.artist + ':' + req.params.song + ')');
                        res.end(''); //TODO: Tidy this up. Code coverage lacking
                    }
                });
            }
        }
    });
};

router.get('/stream/:artist/:song/:dowhat?/:fixed?', GLOBAL.stream);


module.exports = router;