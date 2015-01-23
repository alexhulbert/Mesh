var express = require('express');
var router = express.Router();
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

router.get('/feedback/:sid/:funct/:song?/:rating?', require('../user/isAuthenticated'), function(req, res) {
    var sid = req.params.sid;
    if (sid >= req.user.stations.length) return res.status(400).end('Station index out of range.');
    var song =   (typeof req.params.song === 'undefined') ? 'last' : req.params.song;
    var data = {
        session_id: req.user.stations[sid].playlist,
        update_catalog: true
    };
    switch(req.params.funct) {
        case 'like':
            data.favorite_song = song;
        break;
        case 'dislike':
            data.ban_song = song;
        break;
        case 'rate':
            data.rate_song = song + '^' + req.params.rating;
        break; 
    }
    echo('playlist/dynamic/feedback').get(data, function(err, json) {
        res.end('');
    });
});

module.exports = router;