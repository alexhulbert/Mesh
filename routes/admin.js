var express = require('express');
var router = express.Router();
var Model = require('../user/model');

var requireAdmin = function(req, res, next) {
    if (req.user.elevated) next(); else res.end('0');
};

router.get('/admin/key/:key/:uses?/:expires?', require('../user/isAuthenticated'), requireAdmin, function(req, res) {
    Model.keys.findOne({ key: req.params.key }, function(err, key) {
        if (key) {
            key.usesLeft = req.params.uses || key.usesLeft;
            key.expires  = req.params.expires || null;
            betaKey.save(function(err) {
                //Cast string to inverted boolean, then to int, then back to string
                res.end(+!err+'');
            });
        } else {
            var betaKey = new Model.keys();
            betaKey.key      = req.params.key;
            betaKey.usesLeft = req.params.uses || -1;
            betaKey.expires  = req.params.expires || null;
            betaKey.save(function(err) {
                //Cast string to inverted boolean, then to int, then back to string
                res.end(+!err+'');
            });
        }
    })
});

router.get('/admin/unkey/:key', require('../user/isAuthenticated'), requireAdmin, function(req, res) {
    Model.keys.remove({ key: req.params.key }, function(err, removed) {
        //Clamp removed to 0,1 and cast to string
        res.end(+!!removed+'');
    });
});

router.get('/admin/verify/:user', require('../user/isAuthenticated'), requireAdmin, function(req, res) {
    Model.user.findOne({ email: req.params.user.toLowerCase() }, function(err, user) {
        if (user) {
            user.activated = true;
            user.verifyToken = "";
            user.save(function() {
                res.end('1');
            });
        } else res.end('0');
    });
});

router.get('/admin/elevate/:user/:direction?', require('../user/isAuthenticated'), requireAdmin, function(req, res) {
    var user = req.params.user.toLowerCase();
    if (user != req.user.email) {
        Model.user.findOne({ email: user }, function(err, user) {
            if (user) {
                user.elevated = (req.params.direction != 'down');
                user.save(function() {
                    res.end('1');
                });
            } else res.end('0');
        });
    } else res.end('0');
});

router.get('/admin/remove/:user', require('../user/isAuthenticated'), requireAdmin, function(req, res) {
    var user = req.params.user.toLowerCase();
    if (user != req.user.email) {
        Model.user.remove({ email: user }, function(err, removed) {
            res.end(+!!removed+'');
        });
    } else res.end('0');
});

module.exports = router;