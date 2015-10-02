var express = require('express');
var router = express.Router();
var echo = require('../echo.js');


router.get('/station/info', require('../user/isAuthenticated'), function(req, res) {
    
});

module.exports = router;