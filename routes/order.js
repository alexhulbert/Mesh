var express = require('express');
var router = express.Router();

router.get('/reorder/:old/:new', require('../user/isAuthenticated'), function(req, res) {
    var oldS = parseInt(req.params['old']);
    var newS = parseInt(req.params['new']);
    if (oldS > req.user.stations.length || newS > req.user.stations || newS == oldS || isNaN(newS + oldS)) return res.end('0');
    var o = req.user.order;
    o.splice(newS, 0, o.splice(oldS, 1)[0]);
    req.user.save(function() {
        res.end(o);
    });
});

module.exports = router;