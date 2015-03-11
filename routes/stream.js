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
    var song   = req.params.song  .replace('\n', '/');
    var artist = req.params.artist.replace('\n', '/');
    var query = util.format('%s - %s', artist, song);
    youtube.search.list({
        part: 'id,snippet',
        q: query,
        maxResults: 10,
        key: process.env.YOUTUBE_KEY,
        type: 'video'
        //videoEmbeddable: true,
        //videoSyndicated: true
    }, function(err, json) {
        var grooveshark = function() {
            if (req.params.dowhat == 'metadata') {
                gs.Tinysong.getSongInfo(song, artist, function(err, songInfo) {
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
                gs.Tinysong.getSongInfo(song, artist, function(err, songInfo) {
                    if (songInfo !== null) {
                        gs.Grooveshark.getStreamingUrl(songInfo.SongID, function(err, streamUrl) {
                            request(streamUrl)
                            .on('response', function(resp) {
                                res.setHeader('content-length', resp.request.response.headers['content-length']);
                            })
                            .pipe(res);
                        });
                    } else {
                        console.log('!> Song not found! (' + artist + ':' + song + ')');
                        res.end(''); //TODO: Tidy this up. Code coverage lacking
                    }
                });
            }
        };
        
        var blacklist = ['remake', 'cover', 'full album'];
        var minBitrte = 0;
        if (!json) {
            console.log(err);
            return grooveshark();
        }
        var videos = [];
        for (var item in json.items) {
            var video = json.items[item].snippet.title.toLowerCase();
            var searchStr = query.toLowerCase();
            var matches = true;
            for (var black in blacklist) {
                if (~searchStr.indexOf(black) || ~video.indexOf(black)) {
                    matches = false;
                    break;
                }
            }
            if (matches) videos.push(json.items[item].id.videoId);
        }
        
        async.eachSeries(videos, function(id, videoValid) {
            ytdl.getInfo('http://www.youtube.com/watch?v=' + id, { downloadURL: true }, function(err, info) {
                var findMax = {
                    bitrate: 0,
                    id: -1
                };
                if (typeof info === 'undefined') return videoValid(null);
                for (var i = (info.formats.length - 1); i >= 0; i--) {
                    var format = info.formats[i];
                    if (
                        format.type.indexOf('audio') === 0 &&
                        format.audioBitrate > findMax.bitrate
                    ) {
                        findMax.bitrate = format.audioBitrate;
                        findMax.id = i;
                    }
                }
                if (findMax.id == -1 || findMax.bitrate < minBitrte)
                    return videoValid(null); 

                var workaround = 
                    ~(req.params.dowhat || '').indexOf('legacy') ||
                    ~(req.params.legacy || '').indexOf('legacy')
                ;
                if ((!workaround && req.params.dowhat != 'download') || req.params.dowhat == 'metadata') {
                    if (req.params.dowhat == 'metadata') {
                        proc.exec(path.join(process.env.FFMPEG_DIR, 'ffprobe') + ' -i "' + info.formats[findMax.id].url + '" -show_format', function(err, stdout) {
                            res.end(stdout.replace(/[\s\S]*duration=([0-9\.]+)\n[\s\S]+/, '$1'));
                            videoValid(true);
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
                        return videoValid(true);
                    }
                } else {
                    res.setHeader('Accept-Ranges', 'bytes');
                    res.setHeader('Content-Type', req.params.dowhat == 'download' ? 'application/octet-stream' : 'audio/mpeg');
                    
                    var cmdOpts = ['-i', 'pipe:0', '-acodec', 'libmp3lame'];
                    if (req.params.dowhat == 'download') {
                        res.setHeader('Content-disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(artist) + '%20-%20' + encodeURIComponent(song) + '.mp3');
                        cmdOpts.push(
                            '-id3v2_version', '3',
                            '-metadata', 'title='  + bashEscape(song),
                            '-metadata', 'artist=' + bashEscape(artist)
                        );
                    }
                    cmdOpts.push('-f', 'mp3', '-');
                    var ffmpeg_child = proc.spawn(path.join(process.env.FFMPEG_DIR, 'ffmpeg'), cmdOpts);
                    ffmpeg_child.stdout.pipe(res);
                    
                    var ytdlStream = ytdl.downloadFromInfo(info, {
                        quality: 'highest'
                    });
                    ytdlStream.on('error', function() { res.end(''); });
                    ytdlStream.pipe(ffmpeg_child.stdin);
                    return videoValid(true);
                }
            });
        }, function(videoExists) {
            if (!videoExists) return grooveshark();
        });
    });
};

router.get('/stream/:artist/:song/:dowhat?/:legacy?', GLOBAL.stream);


module.exports = router;
