var color = [0, "0%", 0]; //Changes according to album
var isRunning = false;
var musicPlayer = [{}, {}];
var bkg;
var light = true;
var curStation = null;
var inQueue = false;
var sidebar = 0;
var curSong = 0;
var songs = [];
var body;
var intervalDown, intervalUp;
var mx, my;
var maxHeight = 0;
var onUp = false, onDown = false;
var mIndex = 0;
var progBar;
var nextData;
var pb = true;
var con;
var sFreeze = false;
var theme;
var px = parseFloat(getComputedStyle(document.documentElement).fontSize);
var base = location.href.slice(0, -5);
var globalOverhead = 0;
var audioWorkaround = !!navigator.userAgent.match(/(iPhone)|(AppleCore)|(iTunes)|(undefined)|(chrome)/gi);
var colorThief = new ColorThief();
var locked = false;
var likeStatus = {
    NEUTRAL: 0,
    LIKE: 1,
    DISLIKE: 2
};
var likeBtn, dislikeBtn, unlikeBtn, undislikeBtn;

var showLike = [
    function(song, cb) { //NEUTRAL
        unlikeBtn.fadeTo(400, 0, function() {
            unlikeBtn.addClass('hidden');
        });
        likeBtn.removeClass('hidden').fadeTo(400, 1, function() {
            if (song) {
                song.likeStatus = likeStatus.NEUTRAL;
                if (cb) locked = false; else unlock();
            }
            if (cb) cb();
        });
        dislikeBtn.removeClass('hidden').fadeTo(400, 1);
        undislikeBtn.fadeTo(400, 0, function() {
            undislikeBtn.addClass('hidden');
        });
    },
    function(song, cb) { //LIKE
        likeBtn.fadeTo(400, 0, function() {
            likeBtn.addClass('hidden');
        });
        unlikeBtn.removeClass('hidden').fadeTo(400, 1, function() {
            if (song) {
                song.likeStatus = likeStatus.LIKE;
                if (cb) locked = false; else unlock();
            }
            if (cb) cb();
        });
        dislikeBtn.removeClass('hidden').fadeTo(400, 1);
        undislikeBtn.fadeTo(400, 0, function() {
            undislikeBtn.addClass('hidden');
        });
    },
    function(song, cb) { //DISLIKE
        unlikeBtn.fadeTo(400, 0, function() {
            unlikeBtn.addClass('hidden');
        });
        likeBtn.removeClass('hidden').fadeTo(400, 1, function() {
            if (song) {
                song.likeStatus = likeStatus.DISLIKE;
                if (cb) locked = false; else unlock();
            }
            if (cb) cb();
        });
        undislikeBtn.removeClass('hidden').fadeTo(400, 1);
        dislikeBtn.fadeTo(400, 0, function() {
            dislikeBtn.addClass('hidden');
        });
    }
];

//Used for mobile debugging
//var report = window.onerror;
//window.onerror = function() {alert(Array.prototype.slice.call(arguments).join('\n'));};

var onNoSong = $.throttle(20000, false, function(e) {
    if (e.path[0].error.code == 4) {
        console.log("ERROR LOADING SONG!", e);
        var badSong = $('.song.current');
        mesh(songs.length, 3, function() {
            curSong--;
            songs.splice(-2, 1);
            badSong.remove();
        });
    }
});

function encodeForURI(input) {
    return encodeURIComponent(input)
        .replace( /\(/g, "%28")
        .replace( /\)/g, "%29")
        .replace(/%20/g, "%0A")
    ;
}

//This is probably a really bad idea
function devTest(str) {
    var parts = str.split(':');
    if (parts.length != 3) return;
    $('.' + parts[0].replace(/[^a-zA-Z]*/g, '')).css(parts[1], parts[2]);
}

function lock() {
    locked = true;
}

function unlock() {
    locked = false;
}

function colorGen(data, cb) {
    var unColored = data[0];
    unColored.station = curStation;
    if (unColored.albumUrl && unColored.albumUrl != '/img/noAlbum.png') {
        var img = new Image();
        img.onload = function() {
            var rgb = colorThief.getColor(img);
            var primary = tinycolor({
                r: rgb[0],
                g: rgb[1],
                b: rgb[2]
            });
            unColored.dark = primary.isDark();
            var hsvComps = primary.toHsl();
            unColored.color = [];
            unColored.color.push(hsvComps.h);
            unColored.color.push(hsvComps.s * 100 + '%');
            unColored.color.push(hsvComps.l * 100);
            cb(unColored, data[1]);
        };
        img.src = unColored.albumUrl;
    } else {
        var randColor = tinycolor(Please.make_color({ seed: unColored.id })[0]);
        var clr = randColor.toHsl();
        unColored.color = [];
        unColored.color.push(clr.h);
        unColored.color.push(clr.s * 100 + '%');
        unColored.color.push(clr.l * 100);
        cb(unColored, data[1]);
    }
}

function chooseTheme(themeName, callback) {
    $.getScript(base + '/js/themes/' + themeName + '.js', function() {
        theme.init();
        callback();
    });
}

function refreshStations() {
    con.sortable('destroy');
    con.sortable({
        items: '.station:not(.add)'
    });
    con.sortable().bind('sortupdate', function(e, ui) {
        var item = $(ui.item);
        var oldS = item.data('orderIndex');
        var newS = 7 - item.index();
        if (oldS != newS) {
            $.ajax('/order/' + oldS + '/' + newS);
            item.data('orderIndex', newS);
        }
    });
}

function login(cb, tries) {
    if (typeof tries === 'undefined') tries = 1;
    $.ajax(base + '/user/authenticated').done(function(loggedIn) {
        if (loggedIn != "true") {
            var creds = {
                email: localStorage.email || prompt("Email"),
                password: localStorage.password || prompt("Password")
            };

            $.post(base + '/user/login', creds).done(function(resp) {
                if (resp.redirect.slice(-4) == 'home') {
                    localStorage.email = creds.email;
                    localStorage.password = creds.password;
                    cb(resp.slice(7));
                } else {
                    if (tries <= 3) {
                        alert("Incorrect Credentials.");
                        login(cb, tries + 1);
                    } else {
                        //ERROR: Get an account!
                    }
                }
            });
        } else {
            cb();
        }
    });
}

function music() {
    return musicPlayer[mIndex];
}

if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };
}

function loadStation(sid, callback) {
    var doDefault = (typeof callback === 'undefined');

    if (doDefault) {
        $('.station').removeClass('current');
        $('.station[data-id=' + sid + ']')
            .detach()
            .insertAfter('#stat .container > .station:first-child')
            .addClass('current')
        ;
    }

    $.ajax(base + '/station/load/' + sid).done(function(data) {
        curStation = sid;
        if (doDefault) {
            isRunning = true;
            next(false);
            play();
        } else {
            callback();
        }
        unlock();
    });
}

function back() {
    mesh(curSong - 1, 3);
}

function next() {
    mesh(curSong + 1, 3);
}

function playSong(id) {
    $.ajax(base + '/grab/song/' + id + (audioWorkaround ? '/legacy' : '')).done(function(data) {
       colorGen(JSON.parse(data), function(first, second) {
           nextData = first;
           load(first);
           mesh(songs.length, 2, $.noop);
       });
   });
}

function mesh(ind, part, callback) {
    if (!part) part = 3;
    lock();
    var cb = function() {
        unlock();
        if (callback) callback();
    };
    if (typeof ind === 'undefined') ind = songs.length;
    if (ind >= songs.length) {
        if (inQueue) {
            part = 2;
            inQueue = false;
        }
        if (part & 1) {
            newSong(function(data) {
                nextData = data;
                load(data);
                if (part & 2) {
                    mesh(ind, 2, cb);
                } else cb();
            });
        } else if (part & 2) {
            songs.push(nextData);
            curSong = ind;
            updateHistory('add', songs.length - 1);
            updateUI(nextData);
            playQueue();
            cb();
        }
    } else {
        if (inQueue) {
            songs.push(nextData);
            inQueue = false;
        }
        var soin = songs[ind];
        if (part & 1) {
            load(soin);
        }
        if (part & 2) {
            curSong = ind;
            updateUI(soin);
            playQueue();
        }
        cb();
    }
}

function playQueue() {
    pause();
    mIndex = +!mIndex;
    play();
}

function deleteStation(id, event) {
    if (locked) return;
    lock();
    if (id === 0 && $('.station').length == 2) return; //Don't delete last station
    if (event) event.stopPropagation();
    if (curStation == id) pause(); //lock?
    $.ajax(base + '/station/delete/' + id).done(function(resp) {
        updateHistory('remove', id);
        refreshStations();
        if (curStation == id) {
            loadStation(resp);
        } else {
            curStation = resp;
            unlock();
        }
    });
}

function updateHistory(action, param) {
    switch(action) {
        case 'remove':
            $('#stat .container > [data-id="' + param + '"]').remove();
            $('#stat .container > :not(.add)').each(function(elem) {
                var e = $(elem);
                if (parseInt(e.data('id')) > parseInt(param)) {
                    e.data('id', parseInt(e.data('id')) - 1);
                }
            });

        break;
        case 'add':
            var data = songs[param];
            $('#song .container > div:first-child').after(
                '<div class="song"><div onclick="mesh({4}, 3, function() {});" style="background-image: url({3})"></div><span><span>"{0}"<br>{1}<br>{2}</span></span></div>'.format(
                    data.songName,
                    data.artistName,
                    data.albumName === null ? '(No Album)' : data.albumName,
                    data.albumUrl,
                    songs.length - 1
                )
            );
        break;
        case 'set':
            $('.song').removeClass('current');
            $('.song:nth-last-child(' + (param + 1) + ')').addClass('current');
        break;
    }
}

function updateUI(data) {
    updateHistory('set', curSong);
    var fill, hoverFill, pressFill;
    color = data.color;
    if (color[0] === null) color[0] = 0;
    if (data.dark) {
        $('body').addClass('light').removeClass('dark');
        light = false;
        fill = "#C9C9C9";
        hoverFill = "#999";
        pressFill = "#FFF";
    } else {
        light = true;
        $('body').addClass('dark').removeClass('light');
        fill = "#252525";
        hoverFill = "#666";
        pressFill = "#000";
    }
    showLike[data.likeStatus || 0]();
    var icons = $('.icon').contents();
    for (var i = 0; i < icons.length; i++) {
        var icon = $('g g,path', icons[i]);
        $('svg', icons[i]).css('cursor', 'pointer');
        icon.attr('fill', fill);
    }
    $('.icon.clickable')
        .mouseover(function(self) {
            var context = $(self.target).contents().addBack();
            $('g g,path', context).attr('fill', hoverFill);
        })
        .mouseout(function(self) {
            var context = $(self.target).contents().addBack();
            $('g g,path', context).attr('fill',  fill);
        })
        .contents().find('svg').add('svg.icon.clickable')
            .mousedown(function(self) {
                $('g g,path', self.target).attr('fill', pressFill);
            })
            .mouseup(function(self) {
                $('g g,path', self.target).attr('fill', hoverFill);
            })
    ;
    $('#centerpiece').contents().find('g g,path').attr({
        fill: data.dark ? '#444' : '#D8D8D8'
    });
    if (data.albumUrl === null) {
        $('#album').css('background-image', 'none');
    } else {
        $('#album').css('background-image', 'url("' + data.albumUrl + '")');
    }
    theme.draw($.extend(data, {color:color}));
}

function downloadSong() {
    var el = $('<a download></a>')
        .attr('href', music().audio.src.replace('/legacy', '') + '/download')
        .appendTo('body')
    ;
    el[0].click();
    el.remove();
}

function nextUp(data) {
    var upNext = $('.next.song');
    upNext.data('song', data);
    upNext.find('div').css('background-image', 'repeating-linear-gradient(135deg, transparent, transparent 0.25em, rgba(127,127,127, 0.5) 0.25em, rgba(127,127,127, 0.5) 0.5em), url(' + data.albumUrl + ')');
    upNext.find('span span').html('"{0}"<br>{1}<br>{2}'.format(
        data.songName,
        data.artistName,
        data.albumName === null ? '(No Album)' : data.albumName
    ));
}

function newSong(cb, skip) {
    if (typeof skip === 'undefined') skip = false;
    //TODO: Improve song lookahead logic (globalOverhead)
    $.ajax(base + '/grab/station/' + curStation + (audioWorkaround ? '/legacy' : '')).done(function(data) {
        //globalOverhead = 0;
        colorGen(JSON.parse(data), function(first, second) {
            cb(first);
            nextUp(second);
        });
    });
}

function load(data) {
    var srcUrl = base + '/stream/' + encodeForURI(data.artistName) + '/' + encodeForURI(data.songName);
    if (data.len) {
        musicPlayer[+!mIndex].duration = function() {
            return data.len;
        };
    } else {
        musicPlayer[+!mIndex].duration = function() {
            return this.audio.duration || Infinity;
        };
    }
    musicPlayer[+!mIndex].audio.addEventListener('error', onNoSong);
    musicPlayer[+!mIndex].audio.src = srcUrl + (audioWorkaround ? '/legacy' : '');
    musicPlayer[+!mIndex].audio.load();
}

var feedback = $.debounce(5000, true, function(opinion, songIndex) {
    lock();
    var sng = songs[songIndex || curSong];
    $.ajax(
        base + '/feedback/' + (sng.station || curStation) + '/' + opinion + '/' + sng.id
    ).done(function() {
        switch(opinion) {
            case 'dislike':
                showLike[likeStatus.DISLIKE](sng, next);
            break;
            case 'undislike':
                showLike[likeStatus.NEUTRAL](sng);
            break;
            case 'like':
                showLike[likeStatus.LIKE](sng);
            break;
            case 'unlike':
                showLike[likeStatus.NEUTRAL]();
            break;
            default:
                unlock();
            break;
        }
    });
});

$(document).mousemove(function(e) {
	if (!sidebar) return;
    var side = $('#' + (sidebar == 1 ? 'stat' : 'song'));
    mx = e.pageX;
    my = e.pageY;
	if (sidebar == 1) {
		var stat = $('#stat');
		var op = 0;
		if (stat.css('display') != 'none')
			op = stat.width();
		if (e.pageX > $('#stations').position().left + $('#stations').width() + op && !sFreeze)
			$.sidr('close', 'stat');
	} else {
		if (e.pageX < ($('#song').position().left - $('#songs').width()))
            $.sidr('close', 'song');
	}
	var div = side.find('.container');
	if (e.pageY < $(window).height()*0.25) {
		if (!onUp) {
			onUp = true;
			maxHeight = div.prop("scrollHeight") - div.height();
			intervalUp = setInterval(function() {
			    if (side.find('.slimScrollRail:hover,.slimScrollBar:hover').length) return;
				var sub = (1 - my / ($(window).height() * 0.25)) * 7.5;
				if (div.scrollTop() >= sub) div.slimScroll({
					scrollBy: -sub + 'px',
					alwaysVisible: true,
					disableFadeOut: true
			    });
			}, 50);
		}
	} else {
		if (onUp) {
			onUp = false;
			clearInterval(intervalUp);
		}
	}
	if (e.pageY > $(window).height()*0.75) {
		if (!onDown) {
			onDown = true;
			maxHeight = div.prop("scrollHeight") - div.height();
			intervalDown = setInterval(function() {
			    if (side.find('.slimScrollRail:hover,.slimScrollBar:hover').length) return;
				var sub = (my - $(window).height() * 0.75) / ($(window).height() * 0.25) * 7.5;
				if (div.scrollTop() <= (maxHeight - sub))
				    div.slimScroll({
				        scrollBy: sub + 'px',
				        alwaysVisible: true,
				        disableFadeOut: true
				    });
			}, 50);
		}
	} else {
		if (onDown) {
			onDown = false;
			clearInterval(intervalDown);
		}
	}
});

function play() {
    $('#pause').removeClass('hidden');
    $('#play').addClass('hidden');
    $('#background').removeClass('paused');
    music().audio.play({ playAudioWhenScreenIsLocked: true });
    isRunning = true;
    theme.tick();
}

function pause() {
    $('#pause').addClass('hidden');
    $('#play').removeClass('hidden');
    $('#background').addClass('paused');
    isRunning = false;
    music().audio.pause();
}

function appendStation(station) {
    var elem = $('<div class="station"><span class="left" onclick="deleteStation($(this).parent().data(\'id\'), event);"></span><div></div></div>')
        .attr('title', station.name)
        .css('background-image', 'url(' + station.image + ')')
        .data('id', station.id)
        .data('orderIndex', $('#stat .container .station:not(.add)').length)
        .attr('data-id', station.id)
        .insertAfter('#stat .container > .station:first')
    ;
    refreshStations();
    return elem;
}

function getStations() {
    $.ajax(base + '/stations').done(function(res){
        var data = JSON.parse(res);
        for (var i in data.stations) {
            var station = data.stations[i];
            appendStation(station);
        }

        $('.station[data-id=' + data.lastStation  + ']').addClass('current');
        loadStation(data.lastStation, function() {
            mIndex = +!mIndex;
            newSong(function(data) {
                load(data);
                songs.push(data);
                updateHistory('add', 0);
                updateUI(data);
                $('#loading').fadeOut(350, playQueue);
            });
        });
    });
}

function timeUpdate() {
    var elapsed = music().audio.currentTime;
    var total = music().duration();

    if (pb) progBar.val(elapsed/total);

    if (total - elapsed < 15 && total - elapsed > 0.1 && !inQueue) {
        mesh(curSong + 1, 1);
        inQueue = true;
    }

    if (total - elapsed < 0.25 && inQueue) {
        inQueue = false;
        mesh(curSong + 1, 2);
    }
}

function squeezebox(username, password, ip, port) {
    if (typeof ip === 'undefined') ip = 'localhost';
    if (typeof port === 'undefined') port = 9000;
    if (typeof cb === 'undefined') cb = $.noop;

    var file = (base || location.protocol + '//' + location.host) + '/stations/' + btoa(username + ':' + password).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~') + '.opml';

    window.open('http://' + ip + ':' + port + '/plugins/Favorites/index.html?' + $.param({
        index: 2,
        sess: 1,
        action: 'editset',
        removeoncancel: 1,
        entrytitle: 'Mesh',
        entryurl: file,
        editset: 'Save'
    }));
    return file;
}

function init() {
    for (var i in musicPlayer) {
        var mp = musicPlayer[i];
        mp.ctx = typeof AudioContext === 'undefined' ? new webkitAudioContext() : new AudioContext();
        mp.audio = new Audio('');
        mp.audioSrc = mp.ctx.createMediaElementSource(mp.audio);
        mp.analyser = mp.ctx.createAnalyser();
        mp.audioSrc.connect(mp.analyser);
        mp.analyser.connect(mp.ctx.destination);
        mp.frequencyData = new Uint8Array(mp.analyser.frequencyBinCount);
        mp.audio.addEventListener('timeupdate', timeUpdate);
    }
    theme.tick();
    getStations();

    con = $('#stat .container');
    con.click($.debounce(5000, true, function(e) {
        lock();
        var target = $(e.target).closest('.station');
        if (target.length && !target.hasClass('add')) {
            loadStation(target[0].dataset.id);
        }
    }));


    /*$("#feedbackBtn")
        .attr('href', options.star ? '#rating' : '#feedback')
        .wheelmenu({
            trigger: "hover",
            animation: "fly",
            animationSpeed: "fast",
            angle: [30, 60]
        })
    ;*/

    $('#stations').sidr({
        side: 'left',
        name: 'stat',
        onOpen: function() {
            sidebar = 1;
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            theme.sidebar(sidebar);
        },
        body: '#player,#frost'
    });

    $('#songs').sidr({
        side: 'right',
        name: 'song',
        onOpen: function() {
            sidebar = 2;
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            theme.sidebar(sidebar);
        }
    });

    progBar.noUiSlider({
        start: 0,
        connect: "lower",
        range: {
            min: 0,
            max: 1
        }
    });
    /*$('#volume').noUiSlider({
        start: 0,
        orientation: 'vertical',
        connect: "lower",
        range: {
            min: 0,
            max: 1
        }
    });*/
    
    progBar
        .on('slide', function() {
            music().audio.currentTime = progBar.val()*music().duration();
        })
        .on('mousedown', function(e) {
            pb = false;
        })
        .on('mouseup', function() {
            pb = true;
        })
    ;
    newStation();
};

$(window).load(function() {
    var functSlice = typeof InstallTrigger !== 'undefined' ? 26 : 28;
    $('.icon.clickable').each(function() {
        $(this).contents()
            .on('click touchstart', 'svg', $.debounce(1000, true, function(event) {
                if (!locked)
                    eval(event.view.frameElement.getAttribute('onclick'));
                //I can't for the life of me find a better solution...
            }))
            .find('g g,path').css('transition', 'fill 200ms')
        ;
    });
    $('#song .container').slimScroll({
        size: '1em',
        position: 'right',
        width: '100%',
        height: '100%',
        alwaysVisible: true,
        railVisible: true,
        railOpacity: 0.3,
        disableFadeOut: true,
        railBorderRadius: '0',
        borderRadius: '0'
    });
    $('#stat .container').slimScroll({
        size: '1em',
        position: 'left',
        width: '100%',
        height: '100%',
        alwaysVisible: true,
        railVisible: true,
        railOpacity: 0.3,
        allowPageScroll: false,
        disableFadeOut: true,
        railBorderRadius: '0',
        borderRadius: '0'
    });
    $('#loadLogo').contents().find('g, path').css('fill', '#333');
    $('#songs').contents().find('svg')
        .on('touchstart click', function() {
            $.sidr((sidebar == 0) ? 'open' : 'close', 'song');
        })
        .on('mouseover', function() {
            $.sidr('open', 'song');
        })
    ;
    $('#stations').contents().find('svg')
        .on('touchstart click', function() {
            $.sidr((sidebar == 0) ? 'open' : 'close', 'stat');
        })
        .on('mouseover', function() {
            $.sidr('open', 'stat');
        })
    ;
});

function domLoaded() {
    progBar = $('#progress');
    body = $('body');
    bkg = $('#background');
    likeBtn = $('#like');
    dislikeBtn = $('#dislike');
    unlikeBtn = $('#unlike');
    undislikeBtn = $('#undislike');
}

$(document).ready(function() {
    domLoaded();
    chooseTheme("frostedGlass", init);
});

$(document).on("keydown", function (e) {
    if (e.which === 8 && !$(e.target).is("input, textarea")) {
        e.preventDefault();
    }
});
