//This file is changed when a commit alters the database's stucture in some way.
//Run it once to fix any errors that may occur on your server as a result of the change
//To use this, copy it to /routes and visit /migrate

var Users = require('../user/model').user;
var async = require('async');
var express = require('express');
var router = express.Router();
var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});

router.get('/migrate', function(req, res) {
    Users.find({}, function(err, users) {
        var log = '';
        var count = 1;
        async.each(users, function(user, next) {
            var numArr = [];
            for (var i = 0; i < user.stations.length; i++) numArr.push(i);
            async.each(numArr, function(i, cnt) {
                count++;
                if (user.stations[i].image.match(/^http:\/\/userserve-[a-z]{2}\.last\.fm/)) {
                    log += user.email + ': NO.' + count + ' ' + user.stations[i].prettyName + '\n';
                    var opts = {
                        handlers: {
                            success: function(lfmData) {
                                user.stations[i].image = lfmData.artist.image[3]['#text'] || '/img/noAlbum.png';
                                cnt(null);
                            },
                            error: function(lfmData) {
                                cnt(null);
                            }
                        }
                    };
                    opts.artist = user.stations[i].prettyName;
                    lastfm.request('artist.getInfo', opts);
                } else cnt(null);
            }, function() {
                user.markModified('stations');
                user.save(next);
            });
        }, function() {
            res.end(log + 'SUCCESS');
        });
    });
});

module.exports = router;