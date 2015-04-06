var express = require('express');
var router = express.Router();
var async = require('async');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});
var moment = require('moment');
var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});
var locks = GLOBAL.db.get('locks');
var freq = 60;

GLOBAL.updateGenres = function(genres, next) {
    echo('genre/list').get({
        results: 2000
    }, function(err, json) {
        var list = [];
        for (var i in json.response.genres) {
            list.push(json.response.genres[i].name);
        }
        if (!err) {
            locks.findAndModify({
                query: {
                    name: 'genres'
                },
                upsert: true,
                update: {
                    $set: {
                        timestamp: moment().format('MM-DD-YYYY'),
                        list: list
                    }
                }
            });
            next(list);
        } else next(genres);
    });
};

router.get('/search/:query/:noGenres?', require('../user/isAuthenticated'), function(req, res) {
    var query = req.params.query.replace(/\n/g, '/');
    var data = [];
    async.waterfall([
        function(next) { //Query genres
            if (req.params.noGenres) return next(null, []);
            locks.findOne({
                name: 'genres'
            }, {}, next);
        },
        function(genres, next) { //Update Genre list
            var emptyGenre = typeof genres === 'undefined' || genres === null;
            if (emptyGenre || moment(genres.timestamp, 'MM-DD-YYYY').diff(moment(), 'days') < (1 - freq)) {
                GLOBAL.updateGenres(emptyGenre ? [] : genres, function(list) {
                    next(null, list);
                });
            } else {
                next(null, genres.list);
            }
        },
        function(genres, next) { //Process Genres/Albums
            if (req.params.noGenres) {
                lastfm.request('album.search', {
                    album: query,
                    limit: 10,
                    handlers: {
                        success: function(dta) {
                            var results = dta.results.albummatches.album;
                            for (var r in results) {
                                var album = results[r];
                                var img = album.image[album.image.length - 1]['#text'];
                                if (img.indexOf('http://cdn.last.fm/flatness/catalogue/noimage') === 0)
                                    img = '/img/noAlbum.png';
                                var albumObj = {
                                    type: 'album',
                                    name: album.name,
                                    artist: album.artist,
                                    img: img
                                };
                                if (album.mbid) albumObj.id = album.mbid;
                                data.push(albumObj);
                            }
                            next(null);
                        },
                        error: function(err) {
                            next(null);
                        }
                    }
                });
            } else {
                for (var i in genres) {
                    var genre = genres[i];
                    if (query.toLowerCase().replace(/[^a-zA-Z0-9]/g, '') == genre.replace(/[^a-zA-Z0-9]/g, '')) {
                        data.push({
                            type: 'genre',
                            name: genre,
                            id: "GN" + i,
                            img: '/img/noAlbum.png' //TODO: Fix?
                        });
                        break;
                    }
                }
                next(null);
            }
        },
        function(next) { //Get Artists
            echo('artist/search').get({
                results: 5,
                name: query,
                fuzzy_match: true,
                //sort: 'familiarity-desc',
                bucket: 'images'
            }, next);
        },
        function(json, nothing, next) { //Process Artists
            for (var i in json.response.artists) {
                var jra = json.response.artists[i];
                var img = '/img/noAlbum.png';
                for (var j in jra.images) {
                    if (jra.images[j].url.indexOf('http://cdn.last.fm/flatness/catalogue/noimage') == -1) {
                        img = jra.images[j].url;
                        break;
                    }
                }
                data.push({
                    type: 'artist',
                    name: jra.name,
                    id: jra.id,
                    img: img
                });
            }
            next(null);
        },
        function(next) { //Get songs
            echo('song/search').get({
                results: 20,
                title: query,
                sort: 'song_hotttnesss-desc',
                bucket: 'audio_summary'
            }, next);
        },
        function(json, nothing, next) { //Process Songs
            var tempData = [];
            var played = [];
            for (var i in json.response.songs) {
                var jrs = json.response.songs[i];
                if (played.indexOf(jrs.artist_name + ':' + jrs.title) == -1) {
                    tempData.push({
                        type: 'song',
                        id: jrs.id,
                        artist: jrs.artist_name,
                        song: jrs.title,
                        album: '(No Album)'
                    });
                    played.push(jrs.artist_name + ':' + jrs.title);
                }
            }
            async.concat(tempData, function(song, cb) {
                var duplicate = JSON.parse(JSON.stringify(song)); //Async.each acts sketchy sometimes. Better safe than sorry.
                duplicate.img = "/img/noAlbum.png";
                lastfm.request('track.getInfo', {
                    artist: song.artist,
                    track: song.song,
                    handlers: {
                        success: function(dta) {
                            if (typeof dta.track.album !== 'undefined') {
                                duplicate.album = dta.track.album.title;
                                var str = dta.track.album.image[dta.track.album.image.length - 1]['#text'];
                                if (str.indexOf('http://cdn.last.fm/flatness/catalogue/noimage') !== 0)
                                    duplicate.img = str;
                            }
                            cb(null, duplicate);
                        },
                        error: function(err) {
                            cb(null, duplicate);
                        }
                    }
                });
            }, next);
        },
        function(searchResults, next) {
            res.json(data.concat(searchResults));
            next(null);
        }
    ], function(err) {
        if (err) {
            console.log(err);
            res.json(data);
        }
    });
});

module.exports = router;