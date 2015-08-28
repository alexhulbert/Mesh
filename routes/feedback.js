var express = require('express');
var router = express.Router();
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

router.get('/feedback/:sid/:funct/:song?/:rating?', require('../user/isAuthenticated'), function(req, res) {
    var song = (typeof req.params.song === 'undefined') ? 'last' : req.params.song;
    if (req.params.funct.slice(0, 2) == 'un') {
        var data = {};
        switch(req.params.funct.slice(2)) {
            case 'favorite':
                data.artist_id = song;
                data.favorite = false;
            break;
            case 'like':
                data.song_id = song;
                data.favorite = false;
            break;
            case 'dislike':
                data.song_id = song;
                data.banned = false;
            break;
        }
        echo('tasteprofile/update').post({
            id: req.user.stations[req.params.sid].id,
            data: JSON.stringify([{
                action: 'update',
                item: data
            }])
        }, function(err, json) {
            res.end(+err+"");
        });
    } else {
        var data = {
            session_id: req.user.stations[req.params.sid].playlist,
            update_catalog: true
        };
        switch(req.params.funct) {
            case 'favorite': //artist
                data.favorite_artist = song;
            break;
            case 'like':
                data.favorite_song = song;
            break;
            case 'dislike':
                data.ban_song = song;
            break;
            case 'rate':
                if (
                    req.params.rating > 10 ||
                    req.params.rating < 0  ||
                    isNaN(req.params.rating)
                ) return req.end('0');
                data.rate_song = song + '^' + req.params.rating;
            break;
        }
        echo('playlist/dynamic/feedback').get(data, function(err, json) {
            res.end(+err+"");
        });
    }
});

module.exports = router;