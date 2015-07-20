var color = [0, "0%", 0]; //Changes according to album
var options = {
    //novisuals
    //hue
    //star
    //audioWorkaround
}
var isRunning = false;
var musicPlayer = [
    {audio: new Audio('')},
    {audio: new Audio('')}
];
var hue;
var intervalStep = 0;
var loadingInterval = false;
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
var base = location.href.slice(0, -5);
var streamingFailed = false;
var colorThief = new ColorThief();
var ear = { refresh: 50 };
var locked = false;
var donePreloading = false;
var likeStatus = {
    NEUTRAL: 0,
    LIKE: 1,
    DISLIKE: 2
};
var whoami = '<UNKNOWN IDENTITY>';
var errors = [];
var feedbackHistory = [];

var worker = new Worker('/js/worker.js');
var workerTimer = {
  id: 0,
  callbacks: {},
  setInterval: function(cb, interval, context) {
    this.id++;
    var id = this.id;
    this.callbacks[id] = { fn: cb, context: context };
    worker.postMessage({ command: 'interval:start', interval: interval, id: id });
    return id;
  },
  onMessage: function(e) {
    switch (e.data.message) {
      case 'interval:tick':
        var callback = this.callbacks[e.data.id];
        if (callback && callback.fn) callback.fn.apply(callback.context);
        break;
      case 'interval:cleared':
        delete this.callbacks[e.data.id];
        break;
    }
  },
  clearInterval: function(id) {
    worker.postMessage({ command: 'interval:clear', id: id });
  }
};
worker.onmessage = workerTimer.onMessage.bind(workerTimer);

//Default: '' (false)
//1st Time can set to 'force' (true)
//If not 'force', user can set to 'yes' (true) or 'no' (false)
var wrkCookie = Cookies.get('workaround');
if (!new Audio().canPlayType("audio/mp4; codecs=\"mp4a.40.2\"").replace('no', '') && wrkCookie != 'force') {
    options.audioWorkaround = 'force';
    Cookies.set('workaround', 'force');
} else if (wrkCookie == 'no' || typeof wrkCookie === 'undefined') {
    options.audioWorkaround = false; //Default
} else {
    options.audioWorkaround = wrkCookie; //force or yes
}
//Default: '' 
var hueCookie = Cookies.get('hueip');
if (hueCookie) {
    initHue(hueCookie);
} else {
    options.usingHue = false;
}
//Default: '' (visuals/false)
//1st time can be set to 'force' (novisuals/true)
//If not 'force', user can set to 'yes' (novisuals) or 'no' (visuals)
var visCookie = Cookies.get('novisuals');
if (visCookie != 'force' && !AudioContext && !webkitAudioContext) {
    options.novisuals = 'force';
    Cookies.set('novisuals', 'force');
} else if (wrkCookie == 'no' || typeof wrkCookie === 'undefined') {
    options.novisuals = false; //Default
} else {
    options.novisuals = visCookie;
}

window.addEventListener('error', function(err) {
    if (errors.length > 50) return;
    var lineAndColumnInfo = err.colno ? ' line:' + err.lineno +', column:'+ err.colno : ' line:' + err.lineno;
    errors.push(
        'ERROR!\n' + 
        err.message + '\n' + 
        err.filename + lineAndColumnInfo + '\n' +
        navigator.userAgent + '\n' +
        'Current Song: ' + songs[curSong].id + '\n' +
        'Previous Song: ' + songs[curSong && curSong - 1].id + '\n'
    );
});

function bugReport() {
    var blob = new Blob([whoami + '\n' + errors.join('\n')], {type: 'text/plain'});
    var el = $('<a download></a>')
        .attr({
            'href': URL.createObjectURL(blob),
            'download': 'mesh_bug-' + Date.now() + '.txt'
        })
        .appendTo('body')
    ;
    el[0].click();
    el.remove();
}
Mousetrap.bind('ctrl+shift+/', bugReport);

vex.defaultOptions.className = 'vex-theme-flat-attack';
$.fn.extend({
    in: function(len) {
        $(this)
            .show(0)
            .animate({opacity: 1}, len || 350)
        ;
        return this;
    },
    out: function(len) {
        return $(this)
            .animate({opacity: 0}, len || 350)
            .delay(len || 350)
            .hide(0)
        ;
    }
})

function strokeAndFill(selector, color) {
    var e = $('g > :not(g)', selector);
    e.each(function() {
        var el = $(this);
        var fillClr = el.css('fill');
        if (fillClr != 'none' && fillClr != 'transparent' && fillClr.slice(0, 4) != 'rgba')
            el.css('fill', color);
    });
    e.css('stroke', color);
}

function feedbackFill(like, fill) {
    var parentObj = like ? $('#like') : $('#dislike');
    var svgFill = parentObj.contents().find('path');
    svgFill.css({
        fill: fill ? svgFill.first().css('stroke') : 'transparent'
    });
    var feedbackStr = 'feedback("';
    if (fill)  feedbackStr += 'un';
    if (!like) feedbackStr += 'dis';
    feedbackStr += 'like")';
    parentObj.attr('onclick', feedbackStr);
}

var showLike = [
    function(song, cb) { //NEUTRAL
        if (song) song.likeStatus = likeStatus.NEUTRAL;
        feedbackFill(true , false);
        feedbackFill(false, false);
    },
    function(song, cb) { //LIKE
        if (song) song.likeStatus = likeStatus.LIKE;
        feedbackFill(true , true );
        feedbackFill(false, false);
    },
    function(song, cb) { //DISLIKE
        if (song) song.likeStatus = likeStatus.DISLIKE;
        feedbackFill(true , false);
        feedbackFill(false, true );
    }
];

//Used for mobile debugging
//var report = window.onerror;
//window.onerror = function() {alert(Array.prototype.slice.call(arguments).join('\n'));};

var maxErrors = 20;
var curErrors = 0;

var onNoSong = /*$.throttle(500, false,*/ function(e) {
    if (++curErrors >= maxErrors) return;
    var ecode = 0;
    if (e.currentTarget)
        ecode = e.currentTarget.error.code;
    else if (e.path)
        ecode = e.path[0].error.code;
    switch (ecode) {
        case 4:
            var proceed = function() {
                console.log("ERROR LOADING SONG!", e);
                var preloading = !!music().audio.currentTime;
                //Remove Song current song if no Preload, remove next song if preload
                if (!preloading || curSong != songs.length - 1) {
                    $('.song').filter(function() {
                        return $('> div', this).attr('data-index') == (curSong + preloading);
                    }).remove();
                }
                songs.splice(curSong + preloading, 1);
                //Now curSong is next/correct song
                
                //Shift index of each song to match songs[]
                $('#song .container > div > div')
                    .each(function() {
                        var e = $(this);
                        if (parseInt(e.attr('data-index')) > curSong) {
                            var newIndex = parseInt(e.attr('data-index')) - 1;
                            e.attr('data-index', newIndex);
                            var noPrefix = e.attr('onclick').replace(/^mesh\([0-9]+,/, '');
                            e.attr('onclick', 'mesh(' + newIndex + ',' + noPrefix);
                        }
                    })
                ;
                
                if (preloading) load(songs[curSong+1]); else mesh(curSong, 3);
            }
            
            if (!options.audioWorkaround && !streamingFailed) {
                $.ajax({
                    url: music().audio.src + '/metadata',
                    complete: function(xhr) {
                        var resp = parseFloat(xhr.responseText);
                        if (resp === 0) {
                            proceed();
                        } else {
                            //Doesn't support this format
                            streamingFailed = true;
                            Cookies.set('workaround', 'force');
                            options.audioWorkaround = 'force';
                            songs[curSong].len = resp;
                            mesh(curSong);
                        }
                    }
                });
            } else proceed();
            
        break;
        case 2:
            console.log("AUDIO STREAM INTERRUPTED! RECOVERING...");
            var resumeLength = e.path[0].currentTime;
            music().audio.load();
            music().audio.currentTime = resumeLength;
            music().audio.play();
        break;
        default:
            console.log("UNHANDLED SONG ERROR!", e.path[0].error);
        break;
    }
};

function encodeForURI(input) {
    return encodeURIComponent(input)
        .replace( /\(/g, "%28")
        .replace( /\)/g, "%29")
        .replace(/%2F/g, "%0A")
    ;
}

//This is probably a really bad idea
function devTest(str) {
    var parts = str.split(':');
    if (parts.length != 3) return;
    $('.' + parts[0].replace(/[^a-zA-Z]*/g, '')).css(parts[1], parts[2]);
}

function lock() {
    $('#lockOverlay').css('opacity', 1);
    if (!loadingInterval) loadingInterval = loadAnimate(1000, 3);
    locked = true;
}

function unlock() {
    $('#lockOverlay').css('opacity', 0);
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = false;
    }
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

function login(cb) {
    $.ajax(base + '/user/authenticated').done(function(loggedIn) {
        if (!+loggedIn) {
            var creds = {
                email:    $('#email').val(),
                password: $('#pass' ).val()
            };

            $.post(base + '/user/login', creds).done(function(resp) {
                if (resp.redirect.slice(-4) == 'home') {
                    var csid = resp.getResponseHeader('csid');
                    if (csid) localStorage.csid = csid;
                    cb(true);
                } else {
                    $('#loginError').text(
                        $('#err', resp).text() || 'Invalid Credentials'
                    );
                    cb(false);
                }
            });
        } else cb(false);
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
        feedbackHistory[sid] = JSON.parse(data);
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

function playSong(data, type, cb) {
    var funct;
    switch(type) {
        case 'last':
            funct = function(d) {
                songs.push(d);
                updateHistory('add', songs.length - 1);
                if (cb) cb();
            };
        break;
        case 'next':
            funct = function(d) {
                songs.splice(curSong + 1, 0, d);
                updateHistory('add', curSong + 1);
                if (cb) cb();
            };
        break;
        default:
            funct = function(d) {
                nextData = d;
                load(d);
                mesh(songs.length, 2, cb);
            };
        break;
    }
    
    if (typeof data === "string") {
        $.ajax(base + '/grab/song/' + data + (options.audioWorkaround ? '/legacy' : '')).done(function(dataStr) {
            funct(JSON.parse(dataStr));
        });
    } else if (data instanceof Array) {
        if (data.length) {
            playSong(data[data.length - 1], type, function() {
                playSong(data.slice(0, -1), type, cb);
            });
        } else if (cb) cb();
    } else funct(data);
}

function mesh(ind, part, callback) {
    if (ind == (curSong + 1) && inQueue) {
        part = 2;
        inQueue = false;
    }
    if (!part) part = 3;
    lock();
    var cb = function() {
        unlock();
        if (callback) callback();
    };
    if (typeof ind === 'undefined') ind = songs.length;
    if (ind >= songs.length) {
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
            nextData = undefined;
            playQueue();
            cb();
        }
    } else {
        var soin = songs[ind];
        if (part & 1) load(soin);
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
    if (curStation == id) pause();
    $.ajax(base + '/station/delete/' + id).done(function(resp) {
        updateHistory('remove', id);
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
            $('.circleCard[data-id="' + param + '"], #stat .container > [data-id="' + param + '"]').remove();
            $('.circleCard, #stat .container > :not(.add)').each(function(elem) {
                var e = $(elem);
                if (parseInt(e.data('id')) > parseInt(param)) {
                    e.data('id', parseInt(e.data('id')) - 1);
                }
            });
            for (var s in songs) {
                var song = songs[s];
                if (song.station > parseInt(param)) song.station--;
            }
        break;
        case 'add':
            var data = songs[param];
            if (!data) return;
            $('#song .container > div > div')
                .each(function() {
                    var e = $(this);
                    if (parseInt(e.attr('data-index')) >= parseInt(param)) {
                        var newIndex = parseInt(e.attr('data-index')) + 1;
                        e.attr('data-index', newIndex);
                        var noPrefix = e.attr('onclick').replace(/^mesh\([0-9]+,/, '');
                        e.attr('onclick', 'mesh(' + newIndex + ',' + noPrefix);
                    }
                })
            ;
            $('#song .container > div:eq(-' + (param + 1) + ')').after(
                '<div class="song"><div data-index="{4}" onclick="mesh({4}, 3, function() {});" style="background-image: url({3})"></div><span><span>"{0}"<br>{1}<br>{2}</span></span></div>'.format(
                    data.songName,
                    data.artistName,
                    data.albumName === null ? '(No Album)' : data.albumName,
                    data.albumUrl,
                    param
                )
            );
        break;
        case 'set':
            $('.song').removeClass('current');
            $('.song:nth-last-child(' + (param + 1) + ')').addClass('current');
        break;
    }
}

function updateUI(data, onlyColor) {
    if (!onlyColor) updateHistory('set', curSong);
    var fill, hoverFill, pressFill;
    color = data.color;
    if (color[0] === null) color[0] = 0;
    if (data.dark) {
        light = false;
        $('body').addClass('light').removeClass('dark');
        fill = "#FFF";
        hoverFill = "#BBB";
        pressFill = "#888";
    } else {
        light = true;
        $('body').addClass('dark').removeClass('light');
        fill = "#000";
        hoverFill = "#444";
        pressFill = "#555";
    }
    var icons = $('.icon').contents();
    for (var i = 0; i < icons.length; i++) {
        $('svg', icons[i]).css('cursor', 'pointer');
        strokeAndFill(icons[i], fill);
    }
    $('.icon.clickable')
        .mouseover(function(self) {
            var context = $(self.target).contents().addBack();
            strokeAndFill(context, hoverFill);
        })
        .mouseout(function(self) {
            var context = $(self.target).contents().addBack();
            strokeAndFill(context, fill);
        })
        .contents().find('svg').add('svg.icon.clickable')
            .mousedown(function(self) {
                strokeAndFill(self.target, pressFill);
            })
            .mouseup(function(self) {
                strokeAndFill(self.target, hoverFill)
            })
    ;
    if (!onlyColor) {
        if (data.albumUrl === null)
            $('#album').css('background-image', 'none');
        else
            $('#album').css('background-image', 'url("' + data.albumUrl + '")');
        showLike[data.likeStatus || 0]();
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
    $.ajax(base + '/grab/station/' + curStation + (options.audioWorkaround ? '/legacy' : '')).done(function(data) {
        //globalOverhead = 0;
        colorGen(JSON.parse(data), function(first, second) {
            var statFeedback = feedbackHistory[curStation];
            for (var i in statFeedback.likes) {
                if (statFeedback.likes[i].id == first.id) {
                    first.likeStatus = likeStatus.LIKE;
                    break;
                }
            }
            for (var i in statFeedback.dislikes) {
                if (statFeedback.dislikes[i].id == first.id) {
                    first.likeStatus = likeStatus.DISLIKE;
                    break;
                }
            }
            cb(first);
            nextUp(second);
        });
    });
}

function load(data) {
    var nxtPlayer = musicPlayer[+!mIndex];
    var srcUrl = base + '/stream/' + encodeForURI(data.artistName) + '/' + encodeForURI(data.songName);
    if (data.len) {
        nxtPlayer.duration = function() {
            return data.len;
        };
    } else {
        nxtPlayer.duration = function() {
            return this.audio.duration || Infinity;
        };
    }
    nxtPlayer.audio.addEventListener('error', onNoSong);
    nxtPlayer.audio.src = srcUrl + (options.audioWorkaround ? '/legacy' : '');
    nxtPlayer.audio.load();
}

var feedback = $.debounce(5000, true, function(opinion, songIndex) {
    lock();
    var sng = songs[songIndex || curSong];
    var status = null;
    switch(opinion) {
        case 'dislike':
            status = likeStatus.DISLIKE;
        break;
        case 'undislike':
            status = likeStatus.NEUTRAL;
        break;
        case 'like':
            status = likeStatus.LIKE;
        break;
        case 'unlike':
            status = likeStatus.NEUTRAL;
        break;
    }
    if (status !== null) showLike[status](sng);
    $.ajax(
        base + '/feedback/' + (sng.station || curStation) + '/' + opinion + '/' + sng.id
    ).done(function() {
        if (status == likeStatus.DISLIKE) next(); else unlock();
    });
});

$(document).mousemove($.throttle(25, function(e) {
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
}));

function play() {
    $('#pause').removeClass('hidden');
    $('#play').addClass('hidden');
    $('#background').removeClass('paused');
    music().audio.play({ playAudioWhenScreenIsLocked: true });
    isRunning = true;
    if (!options.novisuals) theme.tick();
}

function pause() {
    $('#pause').addClass('hidden');
    $('#play').removeClass('hidden');
    $('#background').addClass('paused');
    isRunning = false;
    music().audio.pause();
}

function appendStation(station) {
    var elem = $('<div class="station"><span class="left circular" data-bri="25" onclick="deleteStation($(this).parent().data(\'id\'), event);"></span><div></div></div>')
        .attr('title', station.name)
        .css('background-image', 'url(' + station.image + ')')
        .data('id', station.id)
        .attr('data-id', station.id)
        .insertAfter('#stat .container > .station:first')
    ;
    var card = $('<div class="circleCard">')
        .css('background-image', 'url(' + station.image + ')')
        .data('id', station.id)
        .attr('data-id', station.id)
        .attr('title', station.name)
        .attr('onclick', 'filterStation(' + station.id + ');')
        .prependTo('#stationList')
    ;
    return elem.add(card);
}

function initWithStation(index) {
    $('.station[data-id=' + index  + ']').addClass('current');
    loadStation(index, function() {
        mIndex = +!mIndex;
        newSong(function(data) {
            load(data);
            songs.push(data);
            updateHistory('add', 0);
            updateUI(data);
            $('#loading').fadeOut(350, playQueue);
        });
    });
}

function getStations() {
    $.ajax(base + '/stations').done(function(res) {
        var data = JSON.parse(res);
        whoami = data.email || whoami;
        if (data.stations.length) {
            for (var i in data.stations) {
                var station = data.stations[i];
                appendStation(station);
            }
            initWithStation(data.lastStation);
        } else {
            showSearch('firstStation');
            $('#loading').css('z-index', 2);
            colorGen([{}], function(data) {
                updateUI(data, true);
            });
        }
    });
}

function timeUpdate() {
    var elapsed = music().audio.currentTime;
    var total = music().duration();
    var remaining = total - elapsed;

    if (pb) progBar.val(elapsed/total);

    if (
        document.title.slice(7) == songs[curSong].songName &&
        remaining < (15.375 + songs[curSong].songName.replace(/ /g, '').length*0.075)
    ) {
        document.title = document.title.slice(0, -1);
        var rebuilding = false;
        var clearTitle = workerTimer.setInterval(function() {
            if (document.title.length > 7 && !rebuilding) {
                document.title = document.title.slice(0, -1);
            } else {
                if (!rebuilding) {
                    document.title += ' 0';
                    rebuilding = true;
                    return;
                }
                if (document.title.length > 11) {
                    return workerTimer.clearInterval(clearTitle);
                }
                document.title += "0:15"[document.title.length - 8];
            }
        }, 75);
    }

    if (remaining < 15 && remaining > 0.1) {
        if (!inQueue) {
            mesh(curSong + 1, 1, function() {
                if (inQueue) {
                    donePreloading = true;
                } else {
                    donePreloading = false;
                    mesh(curSong + 1, 2);
                }
            });
            inQueue = true;
        }
        document.title = "Mesh - 00:" + ("0" + Math.floor(remaining)).slice(-2);
    }

    if ((remaining < 0.25 || music().audio.ended) && inQueue) {
        inQueue = false;
        if (donePreloading) {
            mesh(curSong + 1, 2);
            donePreloading = false;
        }
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
    songs[-1] = {
        songName: 'Radio'
    };
    if (!options.novisuals) {
        ear.lastTick = Date.now();
        ear.context = typeof AudioContext === 'undefined' ? new webkitAudioContext() : new AudioContext(),
        ear.analyser = ear.context.createAnalyser(),
        ear.frequencies = new Uint8Array(ear.analyser.frequencyBinCount);
        for (var i in musicPlayer) {
            var mp = musicPlayer[i];
            mp.audio.addEventListener('timeupdate', timeUpdate);
            mp.audioSrc = ear.context.createMediaElementSource(mp.audio);
            mp.audioSrc.connect(ear.analyser);
        }
        ear.analyser.connect(ear.context.destination);
        theme.tick();
    } else {
        musicPlayer[0].audio.addEventListener('timeupdate', timeUpdate);
        musicPlayer[1].audio.addEventListener('timeupdate', timeUpdate);
    }
    getStations();

    var blur = 'blur(96px)';
    if (typeof InstallTrigger !== 'undefined')  {
        //FireFox doesn't support direct blur filter yet (only svgs)
        blur = 'url("/img/filters.svg#';
        blur += (navigator.appVersion.indexOf("Win") != -1) ? 'win' : 'mac';
        blur += 'Blur")';
    }
    $('.frost').css('filter', blur);

    con = $('#stat .container');
    con.click($.debounce(5000, true, function(e) {
        var target = $(e.target).closest('.station');
        if (target.length && !target.hasClass('add')) {
            lock();
            loadStation(target[0].dataset.id);
        }
    }));

    $('#stations').sidr({
        side: 'left',
        name: 'stat',
        onOpen: function() {
            sidebar = 1;
            var fillElem = $('#stations').contents().find('.fillMe');
            fillElem.css('fill', fillElem.css('stroke'));
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            var fillElem = $('#stations').contents().find('.fillMe');
            fillElem.css('fill', 'transparent');
            theme.sidebar(sidebar);
        },
        body: '#player,#frost'
    });

    $('#songs').sidr({
        side: 'right',
        name: 'song',
        onOpen: function() {
            sidebar = 2;
            var fillElem = $('#songs').contents().find('.fillMe');
            fillElem.css('fill', fillElem.css('stroke'));
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            var fillElem = $('#songs').contents().find('.fillMe');
            fillElem.css('fill', 'transparent');
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
    initSearch();
    initFilters();
};

function initHue(ip, success, failure) {
    Cookies.set('hueip', ip);
    var successFunct = function() {
        options.usingHue = true;
        hue.initialize();
        if (success) success();
    };
    $.ajax(base + '/user/huesername').done(function(uname) {
        hue = new HueJS({
            ipAddress: ip,
            username: uname,
            deviceType: 'Mesh'
        });
        hue.authenticate(successFunct, function(err) {
            hue.authenticate(successFunct, function(suberr) {
                options.usingHue = false;
                if (failure) failure(err || suberr);
            });
        });
    });
}

function loadAnimate(time, bubbles) {
    intervalStep = 0;
    var circles = $('#ellipsis').contents().find('circle');
    circles.css('fill', 'transparent');
    return setInterval(function() {
        requestAnimationFrame(function() {
            var elem = circles.eq(Math.floor(intervalStep));
            elem.css('fill', (intervalStep % 1) ? 'transparent' :  elem.css('stroke'));
            intervalStep += 0.5;
            intervalStep %= bubbles;
        });
    }, time/bubbles);
}

$(window).load(function() {
    $('.icon.clickable').each(function() {
        $(this).contents()
            .on('click touchstart', 'svg', $.debounce(1000, true, function(event) {
                if (!locked)
                    eval(event.view.frameElement.getAttribute('onclick'));
                //I can't for the life of me find a better solution...
            }))
            .find('g, g > *').css({
                'transition':         'fill 350ms, stroke 200ms',
                '-moz-transition':    'fill 350ms, stroke 200ms',
                '-webkit-transition': 'fill 350ms, stroke 200ms'
            })
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
    $('#optList').slimScroll({
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
    $('#loadLogo').contents().find('g, g > *').css('fill', '#333');
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

function showOptions(visible) {
    if (visible) {
        $('#player').animate({ opacity: 0 }, 350);
        $('#options').in();
    } else {
        $('#options').out();
        $('#player').animate({ opacity: 1 }, 350);
    }
}

function domLoaded() {
    progBar = $('#progress');
    body = $('body');
    bkg = $('#background');
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