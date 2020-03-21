$(document).ready(function () {
    $("#photos_controls").on('click', 'span', function () {

        // remove opaque classes 
        $("#photos img").removeClass("opaque");
        $("#description span").removeClass("show");

        // get new index
        var newIndex = $(this).index();

        // make new photo and description opaque
        $("#photos img").eq(newIndex).addClass("opaque");
        $("#description span").eq(newIndex).addClass("show");

        // update flag for controls
        $("#photos_controls span").removeClass("selected");
        $(this).addClass("selected");
    });
});

document.onkeydown = checkKey;
document.onmousedown = checkKey;

function checkKey(e) {

    // be nice to internet explorer
    e = e || window.event;

    var key = e.which
    var curIndex = $("#photos img.opaque").index();
    var nextIndex = curIndex;
    
    if (key == '37' && curIndex > 0) {
        // left arrow, going left
        nextIndex = curIndex - 1;
    }
    else if (key == '39' && curIndex < 4) {
        // right arrow, going right
        nextIndex = curIndex + 1;
    }
    else if (key == '1' && curIndex < 4 && e.target.parentElement.id =='photos') {
        // left mouse button, going right
        nextIndex = curIndex + 1;
    }

    $("#photos img").removeClass("opaque");
    $("#photos img").eq(nextIndex).addClass("opaque");
    $("#description span").removeClass("show");
    $("#description span").eq(nextIndex).addClass("show");
    $("#photos_controls span").removeClass("selected");
    $("#photos_controls span").eq(nextIndex).addClass("selected");
}