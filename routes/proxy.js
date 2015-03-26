var express = require('express');
var router = express.Router();
var request = require('request').defaults({ encoding: null });

router.get('/proxy/:type/:id/:ext', require('../user/isAuthenticated'), function(req, res) {
    var realUrl;
    var ext = req.params.ext.replace(/[^a-z]+/g, '').slice(0, 3) || 'jpg';
    var url = req.params.id.replace(/[^\.0-9A-Za-z]+/g, '');
    if (req.params.type == 'FM') {
        url = url.replace(/[^0-9]+/g, '');
        if (url) realUrl = 'http://userserve-ak.last.fm/serve/300x300/' + url + '.' + ext;
    } else {
        if (url) realUrl = 'http://images.amazon.com/images/P/' + url + '.' + ext;
    }
    if (realUrl) {
        request.get(realUrl, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                var dataStr = "data:";
                dataStr += response.headers["content-type"];
                dataStr += ";base64," + new Buffer(body).toString('base64');
                res.end(dataStr);
            } else res.end('/img/noAlbum.png');
        });
    } else res.end('/img/noAlbum.png');
});

module.exports = router;