$(document).ready(function () {
    $("#photos_controls").on('click', 'span', function () {
        // CONTROL OF SLIDESHOW THROUGH NUMBERS

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

    $("#photos").click(function (e){
        // CONTROL OF SLIDESHOW THROUGH CLICKING ON IMAGE
        
        var element = $(this);
        var xPos = e.pageX - element.offset().left;
        
        // current index 
        var curIndex = $("#photos img.opaque").index();
        var nextIndex = curIndex;
        
        if((element.width() / 2) >= xPos && curIndex > 0) {
            // left click, going left
            nextIndex = curIndex - 1;
        } 
        else if ((element.width() / 2) < xPos && curIndex < 4) {
            // right click, going right
            nextIndex = curIndex + 1;
        }
        
        // adjust classes accordingly
        $("#photos img").removeClass("opaque");
        $("#photos img").eq(nextIndex).addClass("opaque");
        $("#description span").removeClass("show");
        $("#description span").eq(nextIndex).addClass("show");
        $("#photos_controls span").removeClass("selected");
        $("#photos_controls span").eq(nextIndex).addClass("selected");
    });

    document.onkeydown = checkKey;

    function checkKey(e) {
        // CONTROL OF SLIDESHOW THROUGH ARROWS
        
        // be nice to internet explorer
        e = e || window.event;
    
        // get key and current index
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
            
        // adjust classes accordingly
        $("#photos img").removeClass("opaque");
        $("#photos img").eq(nextIndex).addClass("opaque");
        $("#description span").removeClass("show");
        $("#description span").eq(nextIndex).addClass("show");
        $("#photos_controls span").removeClass("selected");
        $("#photos_controls span").eq(nextIndex).addClass("selected");
    }
});

$("body").on("contextmenu", "img", function(e) {
    // prevent easy minded people from saving images
    return false;
});