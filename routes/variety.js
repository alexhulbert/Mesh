var express = require('express');
var router = express.Router();
var echo = require('../echo.js');

router.get('/variety/:dowhat/:sid/:id', require('../user/isAuthenticated'), function(req, res) {
    var curStation = req.user.stations[req.params.sid];
    var id = req.params.id;
    
    var variety = function() {
        var errEnd = function(message) {
            req.user.markModified('stations');
            req.user.save(function() {
                res.end('ERR: Invalid Seed');
            });
        };
        var toAdd = false;
        var seedArr = curStation.seeds.match(/.{1,18}/g);
        if (!id.match(/^(AR|SO)[A-Z0-9]{16}$/)) return errEnd('ERR: Invalid Seed');
        if (req.params.dowhat == 'add') {
            toAdd = true;
            if (~seedArr.indexOf(id)) return errEnd('ERR: Already Exists');
        } else if (req.params.dowhat == 'remove') {
            if (curStation.seeds.length < 2) return errEnd('ERR: Only One Seed');
            if (~!seedArr.indexOf(id)) return errEnd('ERR: Seed not found');
        } else if (req.params.dowhat == 'list') {
            return res.end(JSON.stringify(seedArr));
        } else return errEnd('ERR: Invalid action');
        echo('tasteprofile/favorite').get({
            id: curStation.id,
            item: id,
            favorite: toAdd
        }, function(err, json) {
            if (err) return errEnd('ERR: ' + err);
            if (toAdd) {
                curStation.seeds += id;
            } else {
                var pos = seedArr.indexOf(id)*18;
                curStation.seeds = curStation.seeds.slice(pos, pos + 18);
            }
            req.user.markModified('stations');
            req.user.save(function() {
                res.end(curStation.seeds);
            });
        });
    };
    
    if (!curStation.seeds) {
        echo('tasteprofile/read').get({
            id: curStation.id,
            results: 1000
        }, function(err, json) {
            if (err) return res.end('ERR: ' + err);
            var items = json.response.catalog.items;
            var artistStation = false;
            curStation.seeds = "";
            for (var i = 0; i < items.length; i++) {
                var item = json.response.catalog.items[i];
                if (!item.favorite) continue;
                if (item.song_id) {
                    if (!artistStation)
                        curStation.seeds += item.song_id;
                    break;
                } else {
                    curStation.seeds += item.artist_id;
                    artistStation = true;
                }
            }
            variety();
        })
    } else variety();
});

module.exports = router;