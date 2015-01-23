var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

function merge(obj1, obj2) {
    for (var attrname in obj2) { obj1[attrname] = obj2[attrname]; }
    return obj1;
}

router.get('/station/:action/:sid', require('../user/isAuthenticated'), function(req, res) {
    if (req.user.stations.length < (parseInt(req.params.sid) + 1))
        return res.status(400).end('Station index out of range.');
    var doDelete = false;
    switch(req.params.action) {
        case 'load':
            async.waterfall([
                function(next) {
                    var station = req.user.stations[req.user.lastStation];
                    if (typeof station.playlist !== undefined) {
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
                    req.user.order.push(req.user.order.splice(req.params.sid, 1)[0]);
                    echo('playlist/dynamic/create').get(merge(req.user.stations[req.user.lastStation].filters, {
                        seed_catalog: req.user.stations[req.params.sid].id,
                        type: 'catalog-radio',
                        session_catalog: req.user.stations[req.params.sid].id,
                        distribution: 'wandering',
                        adventurousness: 0.5,
                        limited_interactivity: true
                    }), function(err, json) {
                        req.user.stations[req.params.sid].playlist = json.response.session_id;
                        req.user.markModified('stations');
                        req.user.save(function() {
                            next(null, json.response.session_id);
                        });
                    });
                },
                function(sessid, next) {
                    var reqStr = 'http://developer.echonest.com/api/v4/playlist/dynamic/feedback?update_catalog=false&api_key='
                               + process.env.ECHONEST_KEY + '&session_id=' + sessid
                               + [''].concat(req.user.stations[req.params.sid].recentlyPlayed).join('&invalidate_song=')
                    ;
                    request(reqStr, function(err, resp, body) {
                        res.end(sessid);
                    });
                }
            ]);
        break;
        case 'delete':
            if (parseInt(req.params.sid) === 0 && req.user.stations.length === 1) {
                res.end(req.params.sid);
                break;
            }
            doDelete = true;
        case 'unload':
            echo('playlist/dynamic/delete').get({
                session_id: req.user.stations[req.params.sid].playlist
            }, function(err, json) {
                if (doDelete) {
                    var fid = req.user.stations[req.params.sid].id;
                    req.user.order.splice(req.user.order.indexOf(req.params.sid), 1);
                    for (var i in req.user.order) {
                        if (req.user.order[i] > parseInt(req.params.sid)) req.user.order[i]--;
                    }
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
                    res.end();
                }
            });
        break;
    }
});

module.exports = router;