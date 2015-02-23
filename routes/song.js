var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request').defaults({ encoding: null });
var LastFmNode = require('lastfm').LastFmNode;
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});
var max = 64; //TODO: ADD TO OPTION SECTION

function translate(req, res, next) {
    if (typeof req.params.fileName !== 'undefined' && req.params.fileName.slice(-1 * (req.params.type.length + 1)) == '.' + req.params.type)
        req.query.key = req.params.fileName.slice(0, -1 * (req.params.type.length + 1));
    next(null, req, res);
}

//Overhead doubles as Squeezebox cache negator
router.get('/grab/:type/:sid/:overhead?/:fileName?', translate, require('../user/isAuthenticated'), function(req, res) {
    var workaround =
        ~(req.params.overhead || '').indexOf('legacy') ||
        ~(req.params.fileName || '').indexOf('legacy') || 
        ~['pls', 'asx'].indexOf(req.params.type)
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
        if (req.params.sid >= req.user.stations.length)
            return res.status(400).end('Station index out of range.');
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
            if (typeof json.response.songs === 'undefined' || json.response.songs.length < 1) {
                console.log(json.response);
                res.end();
                next("ERR");
            } else {
                var jrs = json.response.songs[req.params.overhead];
                var jrl = json.response.lookahead[0];
                //TODO: Implement Skip Stuff
                if (!req.user.stations[req.params.sid])
                    req.user.stations[req.params.sid] = [];
                req.user.stations[req.params.sid].recentlyPlayed =
                    jrs.id.slice(2) +
                    req.user.stations[req.params.sid].recentlyPlayed.slice(0, (max-1)*16)
                ;
                req.user.markModified('stations');
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
                if (data[0].len) playlist += 'Length1=' + data[0].len + '\n';
                playlist += 'File2=' + process.env.URL + '/grab/pls/' + req.params.sid + '/' + (parseInt(req.params.overhead) + 1) + '/' + req.query.key + '.pls\n';
                playlist += 'Title2=' + data[1].artistName + ' - ' + data[1].songName + '\n';
                //if (data[1].len) playlist += 'Length2=' + data[1].len + '\n';
                playlist += 'NumberOfEntries=2\nVersion=2';
                res.end(playlist);
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
            lastfm.request('track.getInfo', {
                artist: artist,
                track: song,
                handlers: {
                    success: function(dta) {
                        if (typeof dta.track.album === 'undefined') {
                            next(null, false, null, la);
                            d.albumName = null;
                        } else {
                            var str = dta.track.album.image[dta.track.album.image.length - 1]['#text'];
                            d.albumName = dta.track.album.title;
                            if (str.indexOf('http://cdn.last.fm/flatness/catalogue/noimage') === 0) {
                                next(null, false, null, la);
                            } else {
                                request.get(str, function(err, response, body) {
                                    if (!err && response.statusCode == 200) {
                                        var dataStr = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
                                        next(null, true, dataStr, la);
                                    } else next(null, false, null, la);
                                });
                            }
                        }
                    },
                    error: function(err) {
                        next(null, false, null, la);
                    }
                }
            });
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