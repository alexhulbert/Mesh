theme = {
    "sidebar": function(mode) { /* Runs when the sidebar is opened/closed*/ },
    "draw": function(data) {
        //Runs when a new song is loaded
        $('#stationAdder,.noUi-base').css({
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
        $('.sidr .container').css({
            'background-color': 'hsla(' + hsl + ',0.675)'
        }); //Coloring the sidebar
        
        var str = data.songName + '<br>' + data.artistName;
        if (data.albumName !== null) str += ' - ' + data.albumName;
        $('#sagText').html(str); //Displaying the current Artist/Song/Album
        
        //px = ratio of pixels to ems since blur only takes pixels
        px = parseFloat(getComputedStyle(document.documentElement).fontSize);
        
        if (!data.albumUrl || data.albumUrl == '/img/noAlbum.png') {
            //Runs when there isn't any album art
            $('#frost').css({
                'background': 'hsl(' + hsl + ')',
                filter: '',
                '-webkit-filter': ''
            }); //Set the main background and remove the filter
            $('#background').css({
                'z-index': 0,
                'width': '100%',
                'height': '100%'
            }); //z-index 0 required here
            
            //Getting the default brightness for the circle 
            var glowBri;
            if (data.dark)
                glowBri = Math.min(color[2] + 50, 100);
            else 
                glowBri = Math.max(color[2] - 25, 0);
            $('#pauseStyle').html('#background.paused' + 
                ((isApp && nativeMedia) ? ',html.mobile' : '') + ' #background { ' + 
                'background-image: radial-gradient(circle closest-side, ' +
                'hsl(' + color[0] + ',' + color[1] + ',' + glowBri + '%) 0%, ' + 
                'hsl(' + color.join(',') + '%) 95%) !important; }'
            ); //Setting up a default circle for when music is paused
        } else {
            //Generate a blur
            var blur = 'blur(' + 6*px + 'px)';
            if (typeof InstallTrigger !== 'undefined' || isApp)  {
                //FireFox doesn't support direct blur filter yet (only svgs)
                blur = 'url("/img/filters.svg#';
                blur += (navigator.appVersion.indexOf("Win") != -1) ? 'win' : 'mac';
                blur += 'Blur")';
            }
            //Runs when album art is available
            $('#frost').css({
                'background-image': 'url("' + data.albumUrl + '")',
                'background-size': 'cover',
                'background-position': 'center'
            }); //Set the background image to the album (obviously)
            $('#background').css({
                'z-index': -1,
                'width': 'auto',
                'height': 'auto'
            }); //z-index -1 required here to see #frost
            $('#frost').css({
                filter: blur,
                '-webkit-filter': 'blur(' + 6*px + 'px)'
            }); //Add the blur to the background
        }
    },
    "tick": function() {
        //Runs each tick when music is playing
        //Rerun this function next frame if music is playing
        if (isRunning) requestAnimationFrame(theme.tick);
        //Load sound volume
        music().analyser.getByteFrequencyData(music().frequencyData);
        
        //Get average volume
        var avg = 0;
        //Ignore all but first 80 to prevent pollution from drums
        for (var i = 0; i < 80; i++) avg += music().frequencyData[i];
        //Treat the rest as zeros
        avg /= music().frequencyData.length;
        avg *= 4; //Change this to make the circle more sensitive
        
        var hslVal, bri;
        var albumMissing =
            typeof songs[curSong] !== 'undefined' &&
            typeof songs[curSong].albumUrl !== 'undefined' &&
            songs[curSong].albumUrl != '/img/noAlbum.png'
        ;
        //Feel free to tweak these ratios on your own Higher -> colorful/subtle
        var ratio = albumMissing?
            0.500: //This is for when there isn't an album
            0.735; //This is for when an album is present
        if (light)
            bri = (((color[2] + (100 - avg*0.75))/2 - 10)*ratio + (100 - avg))*(1 - ratio);
        else
            bri = Math.max((color[2] + avg*0.75 + 25)/3, color[2] + 25)*ratio + avg*(1 - ratio);
        if (albumMissing) {
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
    },
    "init": function() {
        //Make the album edges rounded
        $('#album,#noalbum').css('border-radius', '1em');
        //Add some more padding inside the album
        $('#download,#feedbackBtn,#feedbackIcon').css('top', '2.5vh');
        $('#feedbackBtn,#feedbackIcon').css('right', '2.5vh');
        $('#download').css('left', '2.5vh');
        //Generate a blur value
        var blur = 'blur(' + 6 *px + 'px)';
        if (typeof InstallTrigger !== 'undefined' || isApp)  {
            //FireFox doesn't support direct blur filter yet (only svgs)
            blur = 'url("/img/filters.svg#';
            blur += (navigator.appVersion.indexOf("Win") != -1) ? 'win' : 'mac';
            blur += 'Blur")';
        }
        bkg.css('background', 'none');
        //Make the real background object
        $('<div></div>')
            .attr({
                id: 'frost',
                'class': 'themeSpec'
            })
            .css({
                width:  '100%',
                height: '100%',
                'background-size': 'cover',
                'background-position': 'center',
                transform: 'translate3d(0, 0, 0)',
                filter: blur,
                '-webkit-filter': 'blur(' + 6*px + 'px)',
                position: 'absolute',
            })
            .prependTo(body)
        ;
        //Put Progress bar at the top
        $('#progress')
            .addClass('bigHandle')
            .detach()
            .prependTo('#player')
        ;
    }
};
