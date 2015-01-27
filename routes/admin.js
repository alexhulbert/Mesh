var express = require('express');
var router = express.Router();
var Model = require('../user/model');

router.get('/admin/key/:key/:uses?/:expires?', require('../user/isAuthenticated'), function(req, res) {
    if (req.user.elevated) {
        var betaKey = new Model.keys();
        betaKey.key      = req.params.key;
        betaKey.usesLeft = req.params.usesLeft || -1;
        betaKey.expires  = req.params.expires || null;
        betaKey.save(function(err) {
            //Cast string to inverted boolean, then to int, then back to string
            res.end(+!err+'');
        });
    } else res.end('0');
});

router.get('/admin/unkey/:key', require('../user/isAuthenticated'), function(req, res) {
    if (req.user.elevated) {
        Model.keys.remove({ key: req.params.key }, function(err, removed) {
            //Clamp removed to 0,1 and cast to string
            res.end(+!!removed+'');
        });
    }
});

router.get('/admin/elevate/:user/:direction?', require('../user/isAuthenticated'), function(req, res) {
    if (req.user.elevated && req.params.user != req.user.email) {
        Model.user.findOne({ email: req.params.user }, function(err, user) {
            if (user) {
                user.elevated = (req.params.direction != 'down');
                user.save(function() {
                    res.end('1');
                });
            } else res.end('0');
        });
    } else res.end('0');
});

router.get('/admin/remove/:user', require('../user/isAuthenticated'), function(req, res) {
    if (req.user.elevated && req.params.user != req.user.email) {
        Model.user.remove({ email: req.params.user.toLowerCase() }, function(err, removed) {
            res.end(+!!removed+'');
        });
    } else res.end('0');
});

module.exports = router;