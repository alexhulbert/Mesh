function fadeOut(elem, ms) {
    var opacity = 1;
    var timer = setInterval(function() {
        opacity -= 50 / ms;
        if (opacity <= 0) {
            clearInterval(timer);
            opacity = 0;
            elem.style.display = "none";
            elem.style.visibility = "hidden";
        }
        elem.style.opacity = opacity;
        elem.style.filter = "alpha(opacity=" + opacity * 100 + ")";
    }, 50);
}

function sendform(e) {
    e.preventDefault();
    if (document.getElementById('password').value == document.getElementById('confirm').value) {
        fadeOut(document.getElementById('btn'), 350);
        document.forms[0].submit();
    } else {
        document.body.classList.add('bad');
        mainDiv = document.getElementById('override');
        mainDiv.innerHTML = mainDiv.innerHTML + '<span id="err">Passwords do not match.</span>';
    }
}