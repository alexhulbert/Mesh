var handler = function() {
    $('.fancyInput :input').focus();
};

function newStation() {
    $('#answer :input').fancyInput();
    $('#minus').click(hideStation);
}

function hideStation() {
    var sa = $('#stationAdder');
    sa.removeClass('visible');
    setTimeout(function() {
        sa.css('display', 'none');
    }, 350);
    $('.fancyInput :input')
        .unbind('blur', handler)
        .blur()
    ;
}

function showStation() {
    $('#bubble').attr('style', '');
    $.sidr('close', 'stat');
    $('#stationAdder').css('display', 'block');
    setTimeout(function() {
        $('#stationAdder')
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
    //Loading sign
    $.ajax(base + '/search/' + encodeURIComponent(query).replace(/\//g, '%2F')).done(function(results) {
        for (var i in results) {
            var result = results[i];
            var elem = $('<div class="card" onclick="bootstrapStation(this);"><div class="image"></div><span class="type"></span><span class="name"></span></div>').attr({
                'data-id': result.id,
                'data-query': query
            });
            elem.find('.type').text(result.type);
            elem.find('.image').attr('style', 'background-image: url(' + result.img + ')');
            if (result.type == 'song') {
                elem.find('.name').html(result.artist + '<br>' + result.song);
            } else {
                elem.find('.name').text(result.name);
            }
            elem.appendTo('#container');
        }
        $('#stationAdder').addClass('choose');
    });
}

function bootstrapStation(self) {
    $('#stationAdder').removeClass('choose').addClass('done');
    var target = $(self);
    var query = target.data('query');
    var id = target.data('id');
    $('#container').empty();
    $.ajax('/bootstrap/' + query + '/' + id).done(function(data) {
        $.ajax('/stations/' + data).done(function(subdata) {
            var newStation = JSON.parse(subdata);
            $('#bubble').css('background-image', 'url("' + newStation.image + '")');
            $('<img/>').attr('src', newStation.image).load(function() {
                var newStat = appendStation(newStation);
                var bubble = $('#bubble').css({
                    opacity: 1,
                    position: 'fixed'
                });
                sFreeze = true;
                $.sidr('open', 'stat');
                setTimeout(function() {
                    hideStation();
                    bubble.animate($.extend(newStat.offset(), {
                        margin: 0,
                        width:  '7.875em',
                        height: '7.875em'
                    }), 1000, 'swing', function() {
                        loadStation(data);
                        sFreeze = false;
                        bubble
                            .addClass('noTransition')
                            .css({
                                opacity: 0,
                                position: 'absolute',
                                top: '',
                                left: '',
                                width:  '8.5em',
                                height: '8.5em'
                            });
                        bubble[0].offsetHeight; //Trigger Transition Reflow
                        bubble.removeClass('noTransition');
                    });
                }, 500);
            });
        });
    });
}

function page(doUp) {
    if ($('#' + (doUp ? 'up' : 'down')).hasClass('ghosted')) return;
    var fi = $('.fancyInput');
    var co = $('#container');
    var mtop = parseFloat(co.attr('style').replace(/margin-top: |em/g,''));
    
    co.css('margin-top', mtop + (doUp ? -8.25 : 8.25) + 'em');
    
    $('#down').toggleClass('ghosted', mtop == -1);
    $('#up').toggleClass('ghosted', (fi.offset().top + fi.height()) < (co.offset().top + co.height() - 8.25*px));
}