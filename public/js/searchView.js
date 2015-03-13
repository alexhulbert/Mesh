var curView = "";
var handler = function() {
    $('.fancyInput :input').focus();
};
var fi;

function clrSearch() {
    fancyInput.removeChars(fi.siblings('div'), [0]);
    fi.val('');
    $('#searchView').removeClass('choose done');
    $('.card').remove();
}

function initSearch() {
    fi = $('#answer :input');
    fi.fancyInput();
    $('#minus').click(hideSearch);
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
    $('#bubble').attr('style', '');
    $.sidr('close', 'stat');
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
    var bootstrapMode = curView == 'bootstrap';
    //Loading sign
    $.ajax(base + '/search/' + encodeForURI(query) + (bootstrapMode ? '' : '/noGenre' )).done(function(results) {
        for (var i in results) {
            var result = results[i];
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
        $('#searchView').addClass('choose');
    });
}

function selectSong(self) {
    $('#searchView').removeClass('choose').addClass('done');
    var target = $(self);
    var query = target.data('query');
    if (target.find('.type').text() == 'song')
        query = $.parseHTML(target.find('.name').html().split('<br>')[1])[0].textContent;
    var funct = (curView == 'bootstrap' ? bootstrapSearch : playSearch)
    funct(target, query);
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

function playSearch(target, query) {
    var id = target.data('id');
    switch(target.find('.type').text()) {
        case 'song': 
            playSong(id);
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
                var bubble = $('#bubble').css({
                    opacity: 1,
                    position: 'fixed'
                });
                sFreeze = true;
                $.sidr('open', 'stat');
                setTimeout(function() {
                    hideSearch();
                    bubble.animate($.extend(newStat.offset(), {
                        margin: 0,
                        width:  '7.875em',
                        height: '7.875em'
                    }), 1000, 'swing', function() {
                        loadStation(data);
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
