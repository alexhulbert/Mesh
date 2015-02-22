//This file is changed when a commit alters the database's stucture in some way.
//Run it once to fix any errors that may occur on your server as a result of the change
//To use this, copy it to /routes and visit /migrate

var Users = require('../user/model').user;
var async = require('async');
var express = require('express');
var router = express.Router();

router.get('/migrate', function(req, res) {
    Users.find({}, function(err, users) {
        var log = '';
        async.each(users, function(user, next) {
            for (var s in user.stations) {
                var songs = user.stations[s].recentlyPlayed;
                if (typeof songs === 'undefined' || !~songs.indexOf(',')) continue;
                songs = songs.split(',');
                var out = '';
                for (var i in songs) {
                    out += songs[i].slice(2);
                }
                log += user.email + ': ' + songs.toString() + ' => ' + out + '\n';
                user.stations[s].recentlyPlayed = out;
            }
            user.save(next);
        }, function() {
            res.end(log + 'SUCCESS');
        });
    });
});

module.exports = router;