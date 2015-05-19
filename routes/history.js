var express = require('express');
var router = express.Router();
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});


router.get('/station/info', require('../user/isAuthenticated'), function(req, res) {
    
});

module.exports = router;