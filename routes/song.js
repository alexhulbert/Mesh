var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request').defaults({ encoding: null });
var moment = require('moment');
var LastFmNode = require('lastfm').LastFmNode;
var echo = require('../echo.js');
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});
var noop = function(){};
var sevenDigital = require('7digital-api').configure({
    consumerkey: process.env.SDIGITAL_KEY,
    consumersecret: process.env.SDIGITAL_SECRET,
    defaultParams: { country: 'us' },
    logger: {
        silly: noop,
        verbose: noop,
        info: noop,
        http: noop,
        warn: noop,
        error: function() {
            console.log.apply(console, arguments);
        }
    }
});

var globalMax = 125;

function translate(req, res, next) {
    if (typeof req.params.fileName !== 'undefined' && req.params.fileName.slice(-1 * (req.params.type.length + 1)) == '.' + req.params.type)
        req.query.key = req.params.fileName.slice(0, -1 * (req.params.type.length + 1));
    next(null, req, res);
}

//Overhead doubles as Squeezebox cache negator
router.get('/grab/:type/:sid/:overhead?/:fileName?', translate, require('../user/isAuthenticated'), function(req, res) {
    res.setHeader('Cache-Control', 'no-cache';)
    var workaround =
        ~(req.params.overhead || '').indexOf('legacy') ||
        ~(req.params.fileName || '').indexOf('legacy') || 
        ~['pls', 'asx', 'm3u'].indexOf(req.params.type)
    ;
    var data;
    var end = false; 
    var profSong = function(next) {
        data = [{}];
        echo('song/profile').get({
            id: req.params.sid
        }, function(err, json) {
            if (typeof json.response.songs === 'undefined' || json.response.songs.length === 0) return next('NORESULTS');
            var song = json.response.songs[0];
            end = true;
            next(null, song.artist_name, song.title, 0);
        });
    };
    
    var profStat = function(next) {
        var stationId = req.user.stations[req.params.sid].playlist;
        if (typeof stationId === 'undefined') {
            //TODO: Fix stationId definition control. This error may not need coverage
        }
        
        data = [{}, {}];
        req.params.overhead = (req.params.type != 'pls') && Math.min(Math.max(parseInt(req.params.overhead), 0), 25) || 0;
        echo('playlist/dynamic/next').get({
            session_id: stationId,
            results: 1 + req.params.overhead,
            lookahead: 1
        }, function(err, json) {
            if (typeof json.response.songs === 'undefined' || json.response.songs.length < 1
             || typeof json.response.lookahead === 'undefined' || json.response.lookahead.length < 1) {
                console.log(JSON.stringify(json.response));
                //TODO: LET USER KNOW NO MORE SONGS
                res.end();
                next("ERR");
            } else {
                var jrs = json.response.songs[req.params.overhead];
                var jrl = json.response.lookahead[0];
                if (!req.user.recent)
                    req.user.recent = [];
                req.user.stations[req.params.sid].lastUpdated = moment().format('x');
                req.user.recent =
                    jrs.id.slice(2) +
                    req.user.recent.slice(0, (globalMax-1)*16)
                ;
                req.user.markModified('stations');
                req.user.markModified('recent');
                req.user.save(function() {
                    data[0].id = jrs.id;
                    data[1].id = jrl.id;
                    next(null, jrs.artist_name, jrs.title, 0);
                    next(null, jrl.artist_name, jrl.title, 1);
                });
            }
        });
    };
    
    var finish = function() {
        switch(req.params.type) {
            case 'pls':
                var playlist = '[playlist]\n';
                playlist += 'File1=' + process.env.URL + '/stream/' + encodeURIComponent(data[0].artistName) + '/' + encodeURIComponent(data[0].songName) + '/legacy.mp3' + '\n';
                playlist += 'Title1=' + data[0].artistName + ' - ' + data[0].songName + '\n';
                if (data[0].len) playlist += 'Length1=' + Math.floor(data[0].len) + '\n';
                playlist += 'File2=' + process.env.URL + '/grab/pls/' + req.params.sid + '/' + (parseInt(req.params.overhead) + 1) + '/' + req.query.key + '.pls\n';
                playlist += 'Title2=' + data[1].artistName + ' - ' + data[1].songName + '\n';
                //if (data[1].len) playlist += 'Length2=' + data[1].len + '\n';
                playlist += 'Length2=-1NumberOfEntries=2\nVersion=2';
                res.end(playlist);
            break;
            case 'm3u':
                res.setHeader('Content-Type', 'application/x-mpegurl');
                res.end(
                    '#EXTM3U' + 
                    '\n#EXTINF:' +
                    Math.floor(data[0].len) +
                    ',' + data[0].artistName + ' - ' + data[0].songName + 
                    '\n' + process.env.URL + '/stream/' +
                    encodeURIComponent(data[0].artistName) + '/' +
                    encodeURIComponent(data[0].songName) + '/legacy.mp3' + 
                    '\n#EXTINF:-1,' +
                    data[1].artistName + ' - ' + data[1].songName +
                    '\n' + process.env.URL + '/grab/m3u/' +
                    req.params.sid + '/' + (parseInt(req.params.overhead) + 1) +
                    '/' + req.query.key + '.m3u'
                );
            break;
            case 'asx':
                res.render('playlist', {
                    songName: data[0].songName,
                    artistName: data[0].artistName,
                    songLength: Math.floor(data[0].len / 60) + ':' + (data[0].len % 60),
                    nextSongName: data[1].songName,
                    nextArtistName: data[1].artistName,
                    id: req.params.sid,
                    nextSong: data[1],
                    url: process.env.URL,
                    key: req.query.key
                });
            break;
            default:
                res.end(JSON.stringify(data));
            break;
        }
    };
    
    async.waterfall([
        function(next) {
            if (req.params.type != 'song' && req.user.lastStation != req.params.sid) {
                request({
                    url: 'http://' + process.env.IP + ':' + process.env.PORT + '/station/load/' + req.params.sid,
                    headers: {
                        Cookie: req.headers.cookie
                    }
                }, function(err, resp, body) {
                    next(null);
                });
            } else next(null);
        },
        (req.params.type == 'song') ? profSong : profStat,
        //Get Song Album Art
        function(artist, song, la, next) {
            var d = data[la];
            d.songName = song;
            d.artistName = artist;
            var albumCached = false;
            for (var i in req.user.albums) {
                if (req.user.albums[i].artistSong == artist + ':' + song) {
                    albumCached = req.user.albums[i];
                    break;
                }
            }
            if (albumCached) {
                d.albumName = albumCached.name;
                return next(null, true, albumCached.coverArt, la);
            }
            lastfm.request('track.getInfo', {
                artist: artist,
                track: song,
                handlers: {
                    success: function(dta) {
                        d.duration = dta.track.duration;
                        if (typeof dta.track.album === 'undefined') {
                            next(null, false, null, la);
                            d.albumName = null;
                        } else {
                            var str = dta.track.album.image[dta.track.album.image.length - 1]['#text'];
                            d.albumName = dta.track.album.title;
                            if (str.indexOf('http://cdn.last.fm/flatness/catalogue/noimage') === 0) {
                                next(null, false, null, la);
                            } else {
                                next(null, true, str, la);
                            }
                        }
                    },
                    error: function(err) {
                        next(null, false, null, la);
                    }
                }
            });
        },
        //Try getting Album Art From 7Digital
        function(hasAlbumArt, url, la, next) {
            var d = data[la];
            if (!hasAlbumArt) {
                var sd = new sevenDigital.Tracks();
                sd.search({
                    q: d.artistName + ' ' + d.songName
                }, function(err, albumData) {
                    if (
                        albumData.status == 'ok' &&
                        albumData.searchResults.searchResult.length
                    ) {
                        var track = albumData.searchResults.searchResult[0].track;
                        var img = track.image || track.release.image || '';
                        img = img.replace(/_[0-9]+?\.([a-z]{3})$/, '_350.$1');
                        d.albumName = track.release.title || d.albumName;
                        if (img) {
                            console.log('7Digital Album Found');
                            next(null, true, img, la);
                        }
                    } else {
                        console.log('7Digital Album Not Found');
                        next(null, false, null, la);
                    }
                });
            } else next(null, hasAlbumArt, url, la);
        },
        //Convert Album URL to bytes and add to cache
        function(hasAlbumArt, url, la, next) {
            var toBytes = function() {
                request.get(url, function(err, response, body) {
                    if (!err && response.statusCode == 200) {
                        var dataStr = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
                        next(null, true, dataStr, la);
                    } else next(null, false, null, la);
                });
            };
            var d = data[la];
            if (hasAlbumArt) {
                var albumCached = false;
                for (var i in req.user.albums) {
                    if (req.user.albums[i].artistSong == d.artistName + ':' + d.songName) {
                        albumCached = true;
                        break;
                    }
                }
                if (!albumCached) {
                    req.user.albums.unshift({
                        artistSong: d.artistName + ':' + d.songName,
                        coverArt: url,
                        name: d.albumName
                    });
                    req.user.albums.splice(5);
                    req.user.markModified('albums');
                    req.user.save(function() {
                        toBytes();
                    });
                } else toBytes();
            } else next(null, false, null, la);
        },
        //Get Song Metadata
        function(hasAlbumArt, url, la, next) {
            var d = data[la];
            d.albumUrl = url || '/img/noAlbum.png';
            if (la) {
                if (!end) {
                    end = true;
                } else {
                    next("READY");
                    finish();
                }
                return;
            } else if (workaround) {
                GLOBAL.stream({
                    params: {
                        artist: d.artistName,
                        song: d.songName,
                        dowhat: 'metadata'
                    }
                }, {
                    end: function(body) {
                        d.len = parseFloat(body);
                        if (!end) end = true;
                        else finish();
                    } 
                }, function() {});
            } else {
                if (!end) end = true;
                else finish();
            }
        }
    ]);
});
module.exports = router;