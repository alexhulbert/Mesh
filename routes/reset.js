var express = require('express');
var router = express.Router();
var async = require('async');
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

router.get('/clear/:part?', require('../user/isAuthenticated'), function(req, res) {
    var body = function(list, cb) {
        async.each(list, function(catalog, cb) {
           echo('tasteprofile/delete').post({
               id: catalog.id
           }, function(err, subjson) {
               cb();
           });
        }, function(er, subjson) {
            if (!!cb) cb(); else res.end('CLEARED!');
        });
        req.user.stations = [];
        req.user.bootstrapped = false;
        req.user.markModified('stations');
        req.user.save();
    };
    if (req.params.part == "all") {
        echo('tasteprofile/list').get({}, function(err, json) {
            body(json.response.catalogs, function() {
                require('../user/model').user.remove(function(err) {
                    res.end('CLEARED');
                });
            });
        });
    } else {
        body(req.user.stations);
    }
});

module.exports = router;