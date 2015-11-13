var curView = "";
var handler = function() {
    $('.fancyInput :input').focus();
};
var fi;
var co;

function albumToUrl(url, cb) {
    if (url == '/img/noAlbum.png') return cb(url);
    var toAlbumId = [
        [/^.*amazon\.com\/images\/P\/(.+?)\.([a-z]{3})$/, 'AM/$1/$2'],
        [/https?:\/\/(userserve|img[0-9])-[a-z]{2}.la?st.fm\/(?:serve|i\/u)\/[0-9x]+\/([0-9a-f]+)\.([a-z]{3})/, 'FM/$2/$3/$1'],
        //TODO: Can also be userserve->img# & serve -> i/u & last -> lst
        [/^([A,F]M\/)|(userserve|img[0-9])$|(\/[a-z]{3})|[^\.0-9A-Za-z]+/g, '$2$3$1']
    ];
    for (var i in toAlbumId)
        url = url.replace(toAlbumId[i][0], toAlbumId[i][1]);
    $.ajax(base + '/proxy/' + url).done(cb);
}

function clrSearch() {
    fancyInput.removeChars(fi.siblings('div'), [0]);
    fi.val('');
    $('#searchView').removeClass('choose done');
    $('.card:not(.arrow)').remove();
    $('#up,#down').fadeOut();
    co.css('margin-top', '-1em');
    handler();
}

function resizeText() {
    var e = $(this);
    var visibleText = e.siblings('div');
    var maxSize = $(window).height() * 0.2;
    var ratio = $(window).width() / (visibleText.width() || 1);
    var oldSize = parseInt(e.css('font-size'), 10);
    var fontSize = Math.min(maxSize, Math.floor(oldSize*ratio));
    e.css('font-size', fontSize);
    visibleText.css({
        'font-size': fontSize,
        'line-height': 2*maxSize - fontSize + 'px'
    });
}

function initSearch() {
    fi = $('#answer :input');
    co = $('#container');
    fi.fancyInput();
    $('#searchView input')
        .on('keyup.resize keydown.resize', resizeText)
        .triggerHandler('keyup.resize')
    ;
    $('#searchView .minus').click(hideSearch);
    $('#cancel').click(clrSearch);
}

function hideSearch() {
    clrSearch();
    var sa = $('#searchView');
    sa.removeClass('visible');
    setTimeout(function() {
        sa.css('display', 'none');
    }, 350);
    $('.fancyInput :input')
        .unbind('blur', handler)
        .blur()
    ;
}

function showSearch(view) {
    curView = view;
    var prompt;
    switch (view) {
        case 'firstStation':
            prompt = 'Enter a song, artist, or genre you enjoy to begin using Mesh';
        break;
        case 'bootstrap':
            prompt = 'Enter a song, artist, or genre to make a new station';
        break;
        case 'song':
            prompt = 'Enter a song or album and listen to it now';
        break;
        default:
            prompt = 'What music would you like to hear?';
        break;
    }
    $('#prompt').text(prompt.toUpperCase());
    $('#bubble').attr('style', '');
    $.sidr('close', 'stat');
    $('.minus').css({
        display: (curView == 'firstStation') ? 'none' : 'block'
    });
    $('#searchView').css('display', 'block');
    setTimeout(function() {
        $('#searchView')
            .removeClass('done')
            .addClass('visible')
            .find(':input').val('')
        ;
    }, 50);
    handler();
    $('.fancyInput :input').bind('blur', handler);
}

function addStat() {
    var query = $('#answer :input').val();
    var bootstrapMode = curView != 'song';
    //TODO: Show Loading sign
    $('.ggenre.galbum').attr('title', bootstrapMode ? 'Genres' : 'Albums')
    absorb(base + '/search/' + encodeForURI(query) + (bootstrapMode ? '' : '/noGenre'), function(result) {
        //jshint multistr:true
        var elem = $('\
            <div class="card" onclick="selectSong(this);">\
                <div class="image"></div>\
                <span class="type"></span>\
                <span class="name"></span>\
            </div>\
        ').attr({
            'data-img': result.img,
            'data-id': result.id,
            'data-query': query,
            'data-album': result.album
        });
        elem.find('.type').text(result.type);
        elem.find('.image').attr('style', 'background-image: url(' + result.img + ')');
        switch(result.type) {
            case 'song':
                elem.find('.name').html(result.song + '<br>' + result.artist);
            break;
            case 'album':
                elem.find('.name').html(result.artist + '<br>' + result.name);
            break;
            default:
                elem.find('.name').text(result.name);
            break;
        }
        elem.appendTo('#container > .g' + result.type);
    }, function() {
        co.slimScroll({
            size: '1em',
            position: 'right',
            width: '100%',
            height: '55vh',
            alwaysVisible: true,
            railVisible: true,
            railOpacity: 0.3,
            disableFadeOut: true,
            railBorderRadius: '0',
            borderRadius: '0'
        });
        //TODO: Hide Loading Sign
    });
    $('#searchView').addClass('choose');
}

function selectSong(self) {
    $('#searchView').removeClass('choose').addClass('done');
    var target = $(self);
    var query = target.data('query');
    if (target.find('.type').text() == 'song')
        query = $.parseHTML(target.find('.name').html().split('<br>')[1])[0].textContent;
    var funct = (curView != 'song' ? bootstrapSearch : playSearch);
    funct(target, query);
}

function playSearch(target, query) {
    var id = target.data('id');
    switch(target.find('.type').text()) {
        case 'song': 
            var songArtist = target.find('.name').html().split('<br>');
            albumToUrl(target.find('.image').attr('style').slice(22, -1), function(dataStr) {
                colorGen([{
                    id:         target.data('id'),
                    songName:   songArtist[0],
                    artistName: songArtist[1],
                    albumName:  target.data('album'),
                    albumUrl:   dataStr,
                    len: len && parseFloat(len),
                    needsMD: options.audioWorkaround
                }], function(searchRes) {
                    playSong(searchRes, 'next');
                });
            });
        break;
        case 'album':
            var albumArtist = target.find('.name').html().split('<br>');
            albumToUrl(target.find('.image').attr('style').slice(22, -1), function(dataStr) {
                colorGen([{
                    songName:   albumArtist[1],
                    artistName: albumArtist[0],
                    albumUrl:   dataStr
                }], function(searchRes) {
                    var baseData = {
                        albumUrl: searchRes.albumUrl,
                        color: searchRes.color,
                        albumName: albumArtist[1],
                    };
                    var songsInAlbum = [];
                    var procNextSong = function(songs) {
                        if (!songs.length) return playSong(songsInAlbum, 'next');
                        var songInAlbum = songs[0];
                        var realSong = $.extend({}, baseData, songInAlbum);
                        if (options.audioWorkaround) {
                            $.ajax(
                                base + '/stream/' +
                                encodeForURI(songInAlbum.artistName) + '/' +
                                encodeForURI(songInAlbum.songName) + '/metadata'
                            ).done(function(len) {
                                realSong.len = parseFloat(len);
                                if (realSong.len) songsInAlbum.push(realSong);
                                procNextSong(songs.slice(1));
                            });
                        } else {
                            songsInAlbum.push(realSong);
                            procNextSong(songs.slice(1));
                        }
                    }
                    var albumId;
                    if (id)
                        albumId = id;
                    else
                        albumId = encodeForURI(albumArtist[0]) + '/' + encodeForURI(albumArtist[1]);
                    $.ajax({
                        url: base + '/album/' + albumId,
                        dataType: 'json'
                    }).done(procNextSong);
                });
            });
        break;
        default:
            alert('Feature Not Yet Implemented. Please listen to a song instead.');
        break;
    }
    hideSearch();
}

function bootstrapSearch(target, query) {
    var id = target.data('id');
    var nsImg = target.data('img') || 'img/noAlbum.png';
    $.ajax('/bootstrap/' + query + '/' + id).done(function(data) {
        $.ajax('/stations/' + data).done(function(subdata) {
            var newStation = JSON.parse(subdata);
            $('#bubble').css('background-image', 'url("' + nsImg + '")');
            $('<img/>').attr('src', nsImg).load(function() {
                var newStat = appendStation(newStation);
                if (curView == 'firstStation') {
                    $('#loading').in(350);
                    setTimeout(function() {
                        hideSearch();
                    }, 350);
                    return initWithStation(data);
                } else $.sidr('open', 'stat');
                var bubble = $('#bubble').css({
                    opacity: 1,
                    position: 'fixed'
                });
                sFreeze = true;
                setTimeout(function() {
                    hideSearch();
                    bubble.animate($.extend(newStat.offset(), {
                        margin: 0,
                        width:  '7.875em',
                        height: '7.875em'
                    }), 1000, 'swing', function() {
                        initWithStation(data);
                        sFreeze = false;
                        bubble
                            .addClass('noTransition')
                            .css('opacity', 0)
                        ;
                        setTimeout(function() {
                            //jshint -W030
                            bubble[0].offsetHeight; //Trigger Transition
                            //jshint +W030
                            bubble.css({
                                position: 'absolute',
                                top: '',
                                left: '',
                                width:  '8.5em',
                                height: '8.5em'
                            });
                            bubble.removeClass('noTransition');
                        }, 1);
                    });
                }, 500);
            });
        });
    });
}
