/*!
 * Start Bootstrap - Creative Bootstrap Theme (http://startbootstrap.com)
 * Code licensed under the Apache License v2.0.
 * For details, see http://www.apache.org/licenses/LICENSE-2.0.
 */

(function($) {
    "use strict"; // Start of use strict

    var header = $('.header-content');
    var about = $('#about');
    var logo = document.getElementById('mesh');
    var logIn = document.getElementById('log-in');
    function refreshScroll() {
      var pos = window.pageYOffset || document.scrollTop || 0;
      if (pos >= about.offset().top - 61)
        logIn.style.opacity = 0;
      else
        logIn.style.opacity = 1;
      if ($(window).width() < 768) {
        logo.style.opacity = 1;
        return;
      }
      var target = header.offset().top - 33;
      logo.style.opacity = Math.max(0, target - pos - 32)/(target - 32);
		}
    window.addEventListener( 'scroll', refreshScroll, false );
    refreshScroll();

    // jQuery for page scrolling feature - requires jQuery Easing plugin
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: ($($anchor.attr('href')).offset().top - 60)
        }, 1250, 'easeInOutExpo');
        setTimeout(refreshScroll, 1251);
        event.preventDefault();
    });

    // Highlight the top nav as scrolling occurs
    $('body').scrollspy({
        target: '#mesh',
        offset: 51
    })

    // Closes the Responsive Menu on Menu Item Click
    $('.navbar-collapse ul li a').click(function() {
        $('.navbar-toggle:visible').click();
    });

    // Fit Text Plugin for Main Header
    $("h1").fitText(
        1.2, {
            minFontSize: '35px',
            maxFontSize: '65px'
        }
    );

    // Offset for Main Navigation
    $('#mainNav').affix({
        offset: {
            top: 100
        }
    })

    // Initialize WOW.js Scrolling Animations
    new WOW().init();

})(jQuery); // End of use strict
