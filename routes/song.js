var express = require('express');
var router = express.Router();
var huey = require('huey');
var async = require('async');
var color = require('onecolor');
var request = require('request').defaults({ encoding: null });
var LastFmNode = require('lastfm').LastFmNode;
var Please = require('pleasejs');
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
    var data;
    var end = false;
    var profSong = function(next) {
        data = [{
            color: []
        }];
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
        
        data = [{
            color: []
        }, {}];
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
                req.user.stations[req.params.sid].recentlyPlayed.push(jrs.id);
                if (req.user.stations[req.params.sid].length > max) {
                    req.user.stations[req.params.sid].recentlyPlayed.shift();
                }
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
                playlist += 'File1=' + process.env.URL + '/stream/' + encodeURIComponent(data[0].artistName) + '/' + encodeURIComponent(data[0].songName) + '/fixed.mp3' + '\n';
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
                if (typeof JSON.parse(JSON.stringify(data))[0].len === 'undefined') {
                    "debug!";
                }
                res.end(JSON.stringify(data));
            break;
        }
    }
    
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
        //Get Song Color
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
            }
            if (hasAlbumArt && url !== null) {
                request.get(url, function(err, rs, buffer) {
                    huey(buffer, function(error, rgb, image) {
                        if (typeof rgb !== 'undefined' && rgb !== null) {
                            next(null, rgb, la);
                        } else {
                            next(null, color(Please.make_color({ seed: d.id })[0]).toJSON().slice(1, 4).map(function(val, i, arr) { return val*255; }), la);
                        }
                    });
                });
            } else {
                next(null, color(Please.make_color({ seed: d.id })[0]).toJSON().slice(1, 4).map(function(val, i, arr) { return val*255; }), la);
            }
        },
        function(raw, la, next) {
            var d = data[la];
            d.dark = Math.sqrt(0.241 * Math.pow(raw[0], 2) + 0.691 * Math.pow(raw[1], 2) + 0.068 * Math.pow(raw[2], 2)) < 127; //Color Threshold
            var clr = color(raw.concat(255)).hsl().toJSON().slice(1, 4);
            d.color.push(clr[0]*360);
            d.color.push(clr[1]*100 + '%');
            d.color.push(clr[2]*100);
            next(null, la);
        },
        function(la, next) {
            var d = data[la];
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
        }
    ]);
});

module.exports = router;