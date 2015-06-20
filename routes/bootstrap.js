var express = require('express');
var router = express.Router();
var async = require('async');
var request = require('request');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});
var locks = GLOBAL.db.get('locks');

/*
function translate(req, res, next) {
    if (typeof req.params.redirect !== 'undefined' && req.params.redirect.slice(-5) == '.opml')
        req.query.key = req.params.redirect.slice(0, -5);
    next(null, req, res);
}
*/

router.get('/bootstrap/:q/:id?', /*translate,*/ require('../user/isAuthenticated'), function(req, res) {
    var q = req.params.q.toLowerCase();
    async.waterfall([
        function(next) {
            echo('tasteprofile/create').post({
                name: Date.now(),
                type: 'general'
            }, function(err, json) {
                var entry = json.response;
                delete entry["status"];
                entry.bootstrapped = false;
                entry.index = req.user.stations.length;
                entry.prettyName = req.params.q;
                req.user.stations.push(entry);
                req.user.save(function() {
                    next(null, entry.id);
                });
            });
        },
        function(id, next) {
            locks.findOne({
                name: 'genres'
            }, {}, function(err, resp) {
                if (err || !resp) {
                    GLOBAL.updateList('genres', [], function(list) {
                        next(null, id, list);
                    });
                } else next(null, id, resp.list);
            });
        },
        function(id, genres, next) {
            if (req.params.id) return next('ID', id, genres);
            var isGenre = false;
            for (var i in genres) {
                var genre = genres[i];
                if (q.replace(/[^a-zA-Z0-9]/g, '') == genre.replace(/[^a-zA-Z0-9]/g, '')) {
                    isGenre = true;
                    q = genre;
                    break;
                }
            }
            if (isGenre) {
                var resultIds = [];
                echo('genre/artists').get({
                    name: q
                }, function(err, subjson) {
                    for (var i in subjson.response.artists.splice(0,5)) {
                        resultIds.push(subjson.response.artists[i].id);
                    }
                    next(null, resultIds, id);
                });
            } else {
                echo('artist/search').get({
                    name: q,
                    results: 1
                }, function(err, subjson) {
                    if (typeof subjson.response.artists !== 'undefined' && subjson.response.artists.length > 0) {
                        next(null, [subjson.response.artists[0].id], id);
                    } else {
                        echo('tasteprofile/delete').post({ id: id }, function(err, subsubjson) {
                            req.user.stations.pop();
                            req.user.markModified('stations');
                            req.user.save(function() {
                                next("NOTFOUND");
                            });
                        });
                    }
                });
            }
        },
		function(ids, profId, next) {
		    var data = [];
		    for (var i in ids) {
		       data.push({
		           action: 'update',
		           item: {
		               artist_id: ids[i],
		               favorite: true
		           }
		       });
		    }
		    echo('tasteprofile/update').post({
		        id: profId,
		        data: JSON.stringify(data)
		    }, function(err, json) {
		       console.log("CREATED " + profId + "!");
		       req.user.lastStation = req.user.stations.length - 1;
		       req.user.bootstrapped = true;
		       req.user.save(function() {
		           next(null);
		       });
		    });
		},
		function(next) {
		    request({
                url: 'http://' + process.env.IP + ':' + process.env.PORT + '/stations',
                headers: {
                    Cookie: req.headers.cookie
                }
            }, next);
		}
    ], function(useId, id, genres) {
        if (useId == 'ID') async.waterfall([
            function(next) {
                switch(req.params.id.toLowerCase().slice(0, 2)) {
                    case 'ar':
                        next(null, [{
                            action: 'update',
                            item: {
                                artist_id: req.params.id,
                                favorite: true
                            }
                        }]);
                    break;
                    case 'so':
                        next(null, [{
                            action: 'update',
                            item: {
                                song_id: req.params.id,
                                favorite: true
                            }
                        }]);
                    break;
                    case 'gn':
                        var genre = parseInt(req.params.id.slice(2));
                        if (!(genre < genres.length)) return next(null, null); 
                        //ECHO:
                        echo('genre/artists').get({
                            name: genres[genre]
                        }, function(err, subjson) {
                            var data = [];
                            if (!subjson.response.artists) return next(null, data);
                            for (var i in subjson.response.artists.splice(0, 5)) {
                                data.push({
                                    action: 'update',
                                    item: {
                                        artist_id: subjson.response.artists[i].id,
                                        favorite: true
                                    }
                                });
                            }
                            next(null, data);
                        });
                    break;
                    default:
                        next(null, null);
                    break;
                }
            },
            function(result, next) {
                if (result === null) {
                    echo('tasteprofile/delete').post({ id: id }, function(err, subsubjson) {
                        req.user.stations.pop();
                        req.user.markModified('stations');
                        req.user.save(function() {
                            res.status(400).end(req.user.stations.length - 1 + "");
                        });
                    });
                } else {
                    echo('tasteprofile/update').post({
                        id: id,
                        data: JSON.stringify(result)
                    }, function(err, json) {
                        req.user.lastStation = req.user.stations.length - 1;
                        req.user.bootstrapped = true;
                        req.user.save(function() {
                            res.status(200).end(req.user.stations.length - 1 + "");
                        });
                    });
                }
            }
        ]);
        else res.status(200 * (1 + (useId == "NOTFOUND"))).end(req.user.stations.length - 1 + "");
    });
});

module.exports = router;