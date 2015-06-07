var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request');
var moment = require('moment');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

var stationLoad = function(req, res) {
    if (req.params.sid == req.user.lastStation) {
        var lastUpdated = req.user.stations[req.params.sid].lastUpdated; 
        if (lastUpdated && moment().diff(moment(lastUpdated, 'x'), 'hours') < 23) {
            return res.end(req.user.stations[req.params.sid].playlist);
        }
    }
    async.waterfall([
        function(next) {
            var station = req.user.stations[req.user.lastStation];
            if (typeof station.playlist !== 'undefined') {
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
            echo('playlist/dynamic/create').get({
                seed_catalog: req.user.stations[req.params.sid].id,
                type: 'catalog-radio',
                session_catalog: req.user.stations[req.params.sid].id,
                distribution: 'wandering',
                adventurousness: 0.5,
                limited_interactivity: true
            }, function(err, json) {
                req.user.stations[req.params.sid].playlist = json.response.session_id;
                req.user.markModified('stations');
                req.user.save(function() {
                    next(null, json.response.session_id);
                });
            });
        },
        function(sessid, next) {
            var filters = GLOBAL.parseFilters(req.user.stations[req.params.sid].filters);
            filters.session_id = sessid;
            echo('playlist/dynamic/steer').get(filters, function(err, json) {
                var recentlyPlayed = [];
                if (req.user.stations[req.params.sid].recentlyPlayed) {
                    for (var i = 0; i < req.user.stations[req.params.sid].recentlyPlayed.length; i += 16) {
                        recentlyPlayed.push(req.user.stations[req.params.sid].recentlyPlayed.slice(i, i+16));
                    }
                }
                if (req.user.recent) {
                    for (var i = 0; i < req.user.recent.length; i+= 16) {
                        var recentSong = req.user.recent.slice(i, i+16);
                        if (~recentlyPlayed.indexOf(recentSong))
                            recentlyPlayed.splice(recentlyPlayed.indexOf(recentSong), 1);
                        recentlyPlayed.push(recentSong);
                    }
                }
                if (recentlyPlayed.length) recentlyPlayed.splice(0, 0, '');
                
                var reqStr = 'http://developer.echonest.com/api/v4/playlist/dynamic/feedback?update_catalog=false&api_key='
                           + process.env.ECHONEST_KEY + '&session_id=' + sessid
                           + recentlyPlayed.join('&invalidate_song=SO')
                ;
                request(reqStr, function(err, resp, body) {
                    res.end(sessid);
                });
            });
        }
    ]);
};

var stationUnload = function(req, res, doDelete) {
    echo('playlist/dynamic/delete').get({
        session_id: req.user.stations[req.params.sid].playlist
    }, function(err, json) {
        if (doDelete) {
            var fid = req.user.stations[req.params.sid].id;
            if (req.params.sid == req.user.stations.length - 1) {
                req.user.stations.pop();
                if (req.user.lastStation == req.params.sid) {
                    req.user.lastStation--;
                }
            } else {
                req.user.stations.splice(req.params.sid, 1);
                for (var i in req.user.stations) {
                    var fdsi = req.user.stations[i];
                    if (req.user.lastStation == fdsi.index) {
                        req.user.lastStation = i;
                    }
                    fdsi.index = i;
                }
            }
            req.user.markModified('stations');
            req.user.save(function() {
                echo('tasteprofile/delete').post({
                   id: fid
                }, function(err, subjson) {
                   res.end(req.user.lastStation);
                });
            });
        } else {
            req.user.stations[req.params.sid].lastUpdated = "";
            req.user.save(function() {
                res.end();
            })
        }
    });
};

var stationDelete = function(req, res) {
    stationUnload(req, res, true);
};

var stationInfo = function(req, res) {
    echo('tasteprofile/read').get({
        id: req.user.stations[req.params.sid]
    }, function(err, json) {
        res.end(JSON.stringify(json));
    });
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
        //case 'info': stationInfo(req, res); break;
        default:
            res.end(req.params.sid);
        break;
    }
});

module.exports = router;