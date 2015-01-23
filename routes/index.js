var express = require('express');
var router = express.Router();
var util = require('util');
var exec = require('child_process').exec;
var fs = require('fs');
var async = require('async');
var moment = require('moment');
var x = 14;
var y = 7;
const freq = 20; //How often to update top albums

var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});

router.get('/', function(req, res)  {
    res.render('index', {
        title: 'Discover Music'
    });
    
    var db = req.db;
    var locks = db.get('locks');
    
    async.waterfall([
        function(next) {
            locks.findOne({
                name: 'background'
            }, {}, next);
        },
        function(result, next) {
            if (!result.locked && moment(result.timestamp, 'MM-DD-YYYY').diff(moment(), 'days') < (1 - freq)) {
                console.log('Updating Album Montage...');
                locks.findAndModify({
                    query: {
                        name: 'background'
                    },
                    update: {
                        $set: { locked: true }
                    }
                });
                
                lastfm.request('chart.getTopArtists', {
                    limit: x*y,
                    handlers: {
                        success: function(data) {
                            next(null, data);
                        }
                    }
                });
            } else {
                next(true);
            }
        },
        function(data, next) { 
            var albums = [];
            async.each(data.artists.artist, function(artist, callback) {
                lastfm.request('artist.getTopAlbums', {
                    artist: artist.name,
                    handlers: {
                        success: function(newData) {
                            for (var i in newData.topalbums.album) {
                                var album = newData.topalbums.album[i];
                                var notFound = true;
                                if (typeof album.image !== 'undefined') {
                                    albums.push(album.image[album.image.length - 1]['#text']);
                                    notFound = false;
                                    break;
                                }
                            }
                            /*if (notFound) {
                                //albums.push('NULL:');
                                //TODO: Add fallback service?
                            }*/
                            callback();
                        }
                    }
                });
            }, function(err) {
                for (var i = 0; i < Math.min(0, x*y - albums.length); i++) {
                    albums.push(albums[i]);
                }
                next(null, albums);
            });
        },
        function(albums, next) {
            exec(util.format('gm montage -background black -geometry 225x225^+3+3 -tile %sx%s %s ./public/img/bkg_tmp.png', x, y, albums.join(' ')), function(stdout) {
                next(null, stdout);
            });
        },
        function(stdout, next) {
            fs.unlink('./public/img/bkg.png', function(er) {
                fs.rename('./public/img/bkg_tmp.png', './public/img/bkg.png', function(er) {
                    next(null, stdout);
                });
            });
        },
        function(stdout, next) {
            console.log('Current Albums Updated! [' + stdout + ']');
            locks.findAndModify({
                query: {
                     name: 'background'
                },
                update: {
                    $set: {
                        locked: false,
                        timestamp: moment().format('MM-DD-YYYY')
                    }
                }
            });
        }
    ], function(er) {
        if (er) {
            console.log("Skipping Album Update...");
        }
    });
    
});
module.exports = router;