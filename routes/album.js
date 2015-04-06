var express = require('express');
var router = express.Router();
var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
    api_key:  process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET,
    useragent: 'Mesh'
});

router.get('/album/:id_artist/:album?', require('../user/isAuthenticated'), function(req, res) {
    var requestParams = {
        handlers: {
            success: function(data) {
                var albumSongs = [];
                var tracks = data.album.tracks.track;
                for (var t in tracks) {
                    var track = tracks[t];
                    albumSongs.push({
                        artistName: track.artist.name,
                        songName:   track.name
                    });
                }
                res.end(JSON.stringify(albumSongs));
            },
            error: function(err) {
               res.end('[]');
            }
        }
    };
    if (req.params.album) {
        requestParams.artist = req.params.id_artist.replace(/\n/g, '/');
        requestParams.album  = req.params.album.replace(/\n/g, '/');
    } else {
        requestParams.mbid = req.params.id_artist;
    }
    lastfm.request('album.getInfo', requestParams);
});

module.exports = router;