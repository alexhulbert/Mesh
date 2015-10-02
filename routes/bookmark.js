var express = require('express');
var router = express.Router();

router.get('/:funct(bookmark|unbookmark|bookmarks)/:song?', require('../user/isAuthenticated'), function(req, res) {
    var updateAnyway = false;
    if (typeof req.user.bookmarks === 'undefined') {
        updateAnyway = true;
        req.user.bookmarks = "";
    }
    if (req.params.funct.slice(-1) == 's') {
        var bookmarks = [];
        for (var b = 0; b < req.user.bookmarks.length; b += 16) {
            bookmarks.push('SO' + req.user.bookmarks.slice(b, b + 16));
        }
        if (updateAnyway) {
            return req.user.save(function() {
                res.end(JSON.stringify(bookmarks));
            });
        } else return res.end(JSON.stringify(bookmarks));
    } else if (!req.params.song) return res.end('0');
    var song = req.params.song.slice(2, 18);
    if (req.params.funct.indexOf('un') !== 0) {
        req.user.bookmarks += song;
    } else {
        var copy = "";
        for (var b = 0; b < req.user.bookmarks.length; b += 16) {
            var bookmarked = req.user.bookmarks.slice(b, b + 16);
            if (bookmarked != song) copy += bookmarked;
        }
        req.user.bookmarks = copy;
    }
    req.user.save(function() {
        res.end('');
    });
});

module.exports = router;