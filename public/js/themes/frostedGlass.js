var ratio = 0;
var hasAlbum = false;
theme = {
    "sidebar": function(mode) { /* Runs when the sidebar is opened/closed*/ },
    "recolor": function(color, dark) {
        $('.circular')
            .each(function(i, elem) {
                var e = $(elem);
                var briParam = parseInt(e.data('bri')) || 0;
                var fadedHsl =
                    color[0] + ',' +
                    color[1] + ',' +
                    Math.min(color[2] + (dark ? -1 : 1)*briParam, 100) + '%'
                ; //Setting the color based on data-bri parameter
                if (e.is(':hover')) e.css('color', 'hsl(' + fadedHsl + ')');
                e
                    .mouseover(function(self) {
                        $(self.target).css('color', 'hsl(' + fadedHsl + ')');
                    }) //Set Color to Theme Color on mouse over
                ;
            }) //Change color on mouse over
            .mouseout(function(self) {
                $(self.target).css('color', '');
            }) //Revert circle buttons on mouse exit
        ;
    },
    "draw": function(data) {
        //data.dark means the UI (and not the text) is dark
        //body.dark (the class) means the font is dark
        //Testing out Phillips Hue integration
        if (options.usingHue) {
            //TODO: set 1,2
            hue.setValue([1,2],{
                hue: Math.round(data.color[0]*200),
                sat: Math.round(parseInt(data.color[1].slice(0, -1))*2.55),
                bri: Math.round(data.color[2]*2.55)
            });
        }
        hasAlbum =
            typeof songs[curSong] !== 'undefined' &&
            typeof songs[curSong].albumUrl !== 'undefined' &&
            songs[curSong].albumUrl != '/img/noAlbum.png'
        ;
        //Feel free to tweak these ratios on your own Higher -> colorful/subtle
        ratio = hasAlbum ?
            +0.500: //This is for when there isn't an album
            -0.333; //This is for when an album is present
        //Runs when a new song is loaded
        $('.view:not(.frosty),.noUi-base,.header').css({
            background: 'hsl(' + data.color.join(',') + '%)'
        }); //Setting search view and progress bar background-color
        var hsl =
            data.color[0] + ',' +
            data.color[1] + ',' +
            Math.min(data.color[2] + (data.dark ? -10 : 10), 100) + '%'
        ; //Setting tinted hsl color
        $('.fancyInput,.noUi-background').css({
            'background-color': 'hsl(' + hsl + ')'
        }); //Setting foreground color on progbar/search view
        
        theme.recolor(data.color, data.dark);
        
        $('.sidr .container').css({
            'background-color': 'hsl(' +
                data.color[0] + ',' +
                data.color[1] + ',' +
                Math.min(data.color[2] + (data.dark ? -25 : 25), 100) + '%)'
        }); //Coloring the sidebar
        
        var colorA =
            'hsl(' + ((data.color[0] + 120) % 360)
            + ',' + (parseFloat(data.color[1])+50)/2 + '%,' +
            ((data.dark ? 75 : 25) + data.color[2])/2 + '%)'
        ;
        $('.nl-dd ul, nl-dd ul li:hover:active').css('color', colorA);
        var colorB =
            'hsl(' + ((data.color[0] + 240) % 360)
            + ',' + parseFloat(data.color[1])/2 + '%,'
        ;
        var colorDarker = colorB + ((data.dark ? 100 : 0) + data.color[2])/2 + '%)';
        colorB += data.color[2] + '%)';
        
        $('.nl-field ul, .ui-autocomplete').css('background', colorB);
        $('.nl-form select, .nl-form input, .nl-field-toggle').css({
            'color': colorDarker,
            'border-bottom': '1px dashed ' + colorDarker
        });
        
        var str = data.songName + '<br>' + data.artistName;
        if (data.albumName !== null) str += ' - ' + data.albumName;
        $('#sagText').html(str); //Displaying the current Artist/Song/Album
        
        //Animate the tab title
        var rebuild = function() {
            var elipsTitle = data.songName;
            if (elipsTitle.length > 20)
                elipsTitle = data.songName.slice(0, 17) + '...';
            var rebuildTitle = workerTimer.setInterval(function() {
                if ((document.title.length - 7) < elipsTitle.length) {
                    var toAdd;
                    //document.title automatically removes trailing whitespace
                    if (
                        document.title.length == 6 ||
                        elipsTitle[document.title.length - 7] === ' '
                    ) {
                        toAdd = ' ' + elipsTitle[document.title.length - 6];
                    } else {
                        toAdd = elipsTitle[document.title.length - 7];
                    }
                    document.title += toAdd;
                } else {
                    workerTimer.clearInterval(rebuildTitle);
                    //Change the Favicon
                    $('#favicon').attr('href', data.albumUrl);
                }
            }, 75);
        };
        var clearTitle = workerTimer.setInterval(function() {
            if (document.title.length > 7) {
                document.title = document.title.slice(0, -1);
            } else {
                rebuild();
                workerTimer.clearInterval(clearTitle);
            }
        }, 75);
        
        //Fade out current background with nextFrost
        var frost = $('#frost');
        $('#nextFrost').css({
            'background-color': frost.css('background-color'),
            'background-image': frost.css('background-image')
        }).css({
            display: 'block',
            opacity: 1
        });
        if (!data.albumUrl || data.albumUrl == '/img/noAlbum.png') {
            //Runs when there isn't any album art
            frost.css({
                'background-color': 'hsl(' + hsl + ')',
                'background-image': ''
            }); //Set the main background and remove the filter
            $('#nextFrost').out(700); //Fade out last image
            //Getting the default brightness for the circle 
            var glowBri;
            if (data.dark)
                glowBri = Math.min(color[2] + 50, 100);
            else 
                glowBri = Math.max(color[2] - 25, 0);
        } else {
            //Runs when album art is available
            frost.css({
                'background-image': 'url("' + data.albumUrl + '")',
                'background-color': ''
            }); //Set the background image to the album (obviously)
            $('#nextFrost').out(750); //Fade out last image
            $('#background').css({
                background: 'rgba(' + (data.dark ? '0,0,0' : '255,255,255') + ',0.15)'
            }); //Fading the background so you can see the UI Elements
        }
    },
    "tick": function() {
        //Runs each tick when music is playing
        //Throttle tick function to {ear.refresh}ms to maintain framerate
        //Also skip if the animations aren't visible
        if (
            Date.now() - ear.lastTick <= ear.refresh ||
            $('.view:not(.frosty):visible').length
        ) {
            //Queue this function for the next frame and exit
            if (isRunning) requestAnimationFrame(theme.tick);
            return;
        }
        ear.lastTick = Date.now();
        //Load sound volume
        ear.analyser.getByteFrequencyData(ear.frequencies);
        //Get average volume
        var avg = 0;
        //Ignore all but first 80 to prevent pollution from drums
        for (var i = 0; i < 80; i++) avg += ear.frequencies[i];
        //Treat the rest as zeros
        avg /= ear.frequencies.length;
        avg *= 4; //Change this to make the circle more sensitive
        
        var hslVal, bri;
        if (light)
            bri = (((color[2] + (100 - avg*0.75))/2 - 10)*ratio + (100 - avg))*(1 - ratio);
        else
            bri = Math.max((color[2] + avg*0.75 + 25)/3, color[2] + 25)*ratio + avg*(1 - ratio);
        if (hasAlbum) {
            body.css('background', 'hsl(' + 
                color[0] + ',' + parseFloat(color[1])*0.8 + '%,' + bri
            + '%)'); //Add colored background edges is there's an album image
        } else {
            bkg.css('background-image',
                'radial-gradient(circle closest-side, hsla(' + 
                color[0] + ',' + parseFloat(color[1])*0.8 + '%,' + bri + '%, 0.25) ' + 
                avg + '%, hsl(' + color.join(',') + '%) 95%)'
            ); //Add circle to background if there's no album image
        }
        //Rerun this function next frame if music is playing
        if (isRunning) requestAnimationFrame(theme.tick);
    },
    "init": function() { }
};
