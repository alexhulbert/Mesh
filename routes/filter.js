var express = require('express');
var router = express.Router();
var whitelist = /^(?:(?:min|max|target)_[a-z]+?|(?:more|less)_like_this|adventurousness|variety|description|style|song_type|mood)$/i;
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

router.get('/set/:sid/:key/:value?', require('../user/isAuthenticated'), function(req, res) {
    var finish = function() {
        req.user.markModified('stations');
        req.user.save(function(){
            res.end('Filters Updated!');
        });
    };
    
    //TODO: Change all to >=
    if (parseInt(req.params.sid) >= req.user.stations.length)
        return res.status(400).end('Station index out of range.');
    if (typeof req.params.key === 'undefined')
        return res.status(400).end('Please specify a property to change');
    if (req.params.key.matches(whitelist)) {
        req.user.stations[req.params.sid].filters[req.params.key] = req.params.value;
        if (req.params.sid == req.user.lastStation) {
            var data = {
                session_id: req.user.stations[req.params.sid].playlist
            };
            data[req.params.key] = req.params.value;
            echo('playlist/dynamic/steer').get(data, finish);
        } else finish();
    } else {
        return res.status(400).end('Invalid filter.');
    }
});

module.exports = router;