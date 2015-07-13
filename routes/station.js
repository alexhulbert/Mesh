var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request');
var moment = require('moment');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});
var topPlayedMax = 64;

var stationLoad = function(req, res) {
    var curStation = req.user.stations[req.params.sid];
    if (typeof curStation.id === 'undefined') return stationDelete(req, res);
    if (
        req.params.sid == req.user.lastStation &&
        typeof curStation.playlist !== 'undefined'
    ) {
        var lastUpdated = curStation.lastUpdated; 
        if (lastUpdated && moment().diff(moment(lastUpdated, 'x'), 'hours') < 23) {
            if (curStation.feedback) {
                return res.end(JSON.stringify({
                    session: curStation.playlist,
                    ratings: curStation.feedback.ratings || [],
                    likes: curStation.feedback.likes || [],
                    dislikes: curStation.feedback.dislikes || []
                }));
            } else {
                return res.end(JSON.stringify({
                    session: curStation.playlist,
                    ratings: [],
                    likes: [],
                    dislikes: []
                }));
            }
        }
    }
    for (var i = 0; i < req.user.stations.length; i++) {
        var stat = req.user.stations[i];
        if (stat.index == curStation.index) continue;
        stat.feedback = {
            likes: [],
            dislikes: [],
            ratings: [],
            active: false
        };
    }
    async.waterfall([
        function(next) {
            var station = req.user.stations[req.user.lastStation];
            if (station && typeof station.playlist !== 'undefined') {
                echo('playlist/dynamic/delete').get({
                    session_id: station.playlist
                }, function(err, json) {
                    req.user.stations[station.index].playlist = undefined;
                    next(null);
                });
            } else {
                next(null);
            }
        },
        function(next) {
            req.user.lastStation = req.params.sid;
            var playlistParams = {
                seed_catalog: curStation.id,
                type: 'catalog-radio',
                session_catalog: curStation.id,
                distribution: 'wandering',
                adventurousness: 0.5,
                limited_interactivity: true
            };
            var remainingParams = {};
            var filters = GLOBAL.parseFilters(curStation.filters);
            for (var i in filters) {
                if (!i.match(/mood|style|description/)) {
                    playlistParams[i] = filters[i];
                } else {
                    remainingParams[i] = filters[i];
                }
            }
            echo('playlist/dynamic/create').get(playlistParams, function(err, json) {
                curStation.playlist = json.response.session_id;
                req.user.markModified('stations');
                req.user.save(function() {
                    next(null, json.response.session_id, filters);
                });
            });
        },
        function(sessid, filters, next) {
            if (Object.getOwnPropertyNames(filters).length !== 0) {
                filters.session_id = sessid;
                echo('playlist/dynamic/steer').get(filters, function(err, json) {
                    next(null, sessid);
                });
            } else next(null, sessid);
        },
        function(sessid, next) {
            if (!req.user.mostPlayed) req.user.mostPlayed = {};
            echo('tasteprofile/read').get({
                results: 1000,
                id: curStation.id
            }, function(err, json) {
                var history = json.response.catalog.items.sort(function(a, b) {
                    var diff = a.indirect_play_count - b.indirect_play_count;
                    if (diff > 0) return -1;
                    if (diff < 0) return +1;
                    return 0;
                }).filter(function(a) {
                    return typeof a.indirect_play_count === 'number';
                });
                for (var i in history.slice(0, 10)) {
                    var item = history[i];
                    if (typeof req.user.mostPlayed[item.song_id] === 'undefined') {
                        req.user.mostPlayed[item.song_id] = {};
                    }
                    req.user.mostPlayed[item.song_id][req.params.sid] = item.indirect_play_count;
                }
                for (var i in history.slice(11)) {
                    var item = history[i];
                    if (typeof req.user.mostPlayed[item.song_id] !== 'undefined') {
                        req.user.mostPlayed[item.song_id][req.params.sid] = item.indirect_play_count;
                    }
                }
                
                var mostPlayedList = [];
                for (var i in req.user.mostPlayed) {
                    var sng = req.user.mostPlayed[i];
                    var total = 0;
                    for (var j in sng) total += sng[j];
                    mostPlayedList.push({
                        id: i,
                        count: total
                    });
                }
                var sorted = mostPlayedList.sort(function(a, b) {
                    var diff = a.count - b.count;
                    if (diff > 0) return -1;
                    if (diff < 0) return +1;
                    return 0;
                }).slice(topPlayedMax);
                for (var id in sorted) delete req.user.mostPlayed[sorted[id].id];
                req.user.markModified('mostPlayed');
                
                var recentlyPlayed = [];
                var mostRecent = json.response.catalog.items.sort(function(a, b) {
                    var diff = new Date(a.last_modified) - new Date(b.last_modified);
                    if (diff > 0) return +1;
                    if (diff < 0) return -1;
                    return 0;
                });
                for (var i in mostRecent) recentlyPlayed.push(mostRecent[i].song_id);
                
                var feedbackData = {
                    likes: [],
                    dislikes: [],
                    ratings: [],
                    active: true
                };
                for (var i in history) {
                    var playedSong = history[i];
                    if (playedSong.song_id) {
                        var songItem = {
                            id: playedSong.song_id,
                            name: playedSong.artist_name + ' - ' + playedSong.song_name,
                        };
                        if (playedSong.banned)   feedbackData.dislikes.push(songItem);
                        if (playedSong.favorite) feedbackData.likes.push(songItem);
                    }
                    //TODO: Ratings
                }
                
                req.user.markModified('stations');
                curStation.feedback = feedbackData;
                req.user.save(function() {
                    next(null, recentlyPlayed, sessid, feedbackData);
                });
            });
        },
        function(recentlyPlayed, sessid, feedbackData, next) {
            if (req.user.recent) {
                for (var i = 0; i < req.user.recent.length; i+= 16) {
                    var recentSong = 'SO' + req.user.recent.slice(i, i+16);
                    if (~recentlyPlayed.indexOf(recentSong))
                        recentlyPlayed.splice(recentlyPlayed.indexOf(recentSong), 1);
                    recentlyPlayed.push(recentSong);
                }
            }
            for (var song in req.user.mostPlayed) {
                if (~recentlyPlayed.indexOf(song))
                    recentlyPlayed.splice(recentlyPlayed.indexOf(song), 1);
                recentlyPlayed.push(song);
            }
            if (recentlyPlayed.length) {
                recentlyPlayed.splice(0, recentlyPlayed.length - 135); //TODO: Tweak This!
                recentlyPlayed.splice(0, 0, '');
            }
            
            var reqStr = 'http://developer.echonest.com/api/v4/playlist/dynamic/feedback?update_catalog=false&api_key='
                       + process.env.ECHONEST_KEY + '&session_id=' + sessid
                       + recentlyPlayed.join('&invalidate_song=')
            ;
            request(reqStr, function(err, resp, body) {
                res.end(JSON.stringify({
                    session: sessid,
                    likes: feedbackData.likes,
                    dislikes: feedbackData.dislikes,
                    ratings: feedbackData.ratings
                }));
            });
        }
    ]);
};

var stationUnload = function(req, res, doDelete) {
    var curStation = req.user.stations[req.params.sid];
    echo('playlist/dynamic/delete').get({
        session_id: curStation.playlist
    }, function(err, json) {
        if (doDelete) {
            var fid = curStation.id;
            req.user.stations.splice(req.params.sid, 1);
            for (var i = 0; i < req.user.stations.length; i++)
                req.user.stations[i].index = i;
            if (
                (req.user.lastStation !== 0 ||
                parseInt(req.params.sid) !== 0) &&
                req.user.lastStation >= parseInt(req.params.sid)
            ) req.user.lastStation--;
            req.user.markModified('stations');
            req.user.save(function() {
                echo('tasteprofile/delete').post({
                   id: fid
                }, function(err, subjson) {
                   res.end(req.user.lastStation);
                });
            });
        } else {
            curStation.lastUpdated = "";
            req.user.save(function() {
                res.end();
            });
        }
    });
};

var stationDelete = function(req, res) {
    stationUnload(req, res, true);
};

router.get('/station/:action/:sid', require('../user/isAuthenticated'), function(req, res) {
    switch(req.params.action) {
        case 'load':
            stationLoad(req, res);
        break;
        case 'delete':
            if (parseInt(req.params.sid) === 0 && req.user.stations.length ===  1) {
                res.end(req.params.sid);
                break;
            }
            stationDelete(req, res);
        break;
        case 'unload':
            stationUnload(req, res);
        break;
        default:
            res.end(req.params.sid);
        break;
    }
});

module.exports = router;