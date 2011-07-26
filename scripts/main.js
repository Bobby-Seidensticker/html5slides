var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var nsdoc = require('org.startpad.nsdoc');
var format = require('org.startpad.format');
var markdown = new Showdown.converter();

exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc,
    'onSaveSuccess': onSaveSuccess,
    'handleLocationHash': handleLocationHash,
    'getDocid': getDocid,
    'setDocid': setDocid
});

var client;
var doc;                            // Bound elements here
var blob;
var lastText = "";
var syncTime = 5;
var editVisible = false;
var editorInitialized = false;

var slideScript;
var refresh;
var outputHeight;
var HEIGHT = 700;

function getDocid() {
    return handleLocationHash().doc;
}

function setDocid(docid) {
    handleLocationHash({ doc: docid });
}

function handleLocationHash(obj) {
    var hash = document.location.hash.replace(/#/, ''),
        doc,
        page;
    if (hash.search('doc=') > -1) {
        doc = hash.replace('doc=', '')[0].split('&')[0];
    }
    if (hash.search('page=') > -1) {
        page = hash.split('page=');
        page = page[page.length - 1];
    }
    if (obj) {
        if (obj.doc) {
            doc = obj.doc;
        }
        if (obj.page) {
            page = obj.page;
        }
        hash = '#';
        if (doc) {
            hash += 'doc=' + doc;
        }
        if (page) {
            if (doc) {
                hash += '&';
            }
            hash += 'page=' + page;
        }
        location.replace(hash);
    }
    return {
        doc: doc,
        page: page
    };
}

function onEditChange() {
    var newText = doc.editor.value;
    if (newText == lastText) {
        return;
    }
    client.setDirty();
    lastText = newText;
    $('#output').empty();
    $('#output').append(lastText);
    onResize();
    refresh();
/*
    try {
        doc.output.innerHTML = markdown.makeHtml(newText);
        nsdoc.updateScriptSections(doc.output);
    } catch (e) {
        $(doc.output).text("Error: " + e.message);
    }*/
}

function toggleEditor(evt) {
    var height;
    editVisible = !editVisible;
    if (editVisible) {
        $(doc.page).addClass('edit');
        // Binding this in the onReady function does not work
        // since the original textarea is hidden.
        if (!editorInitialized) {
            editorInitialized = true;
            $(doc.editor)
                .bind('keyup', onEditChange)
                .autoResize({limit: 10000});
        }
        onResize();
    } else {
        $(doc.page).removeClass('edit');
        onResize();
    }
    $(doc.edit).val(editVisible ? 'hide' : 'edit');
}

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    client.addAppBar();

    $(doc.edit).click(toggleEditor);

    setInterval(onEditChange, syncTime * 1000);

    $.ajax({
        url: 'slides.html',
        error: function(result, status) {
            console.log('ajax load error');
        },
        success: function(slides) {
            $('#output').append(slides);
            $('#editor')[0].innerHTML = slides;
            slideScript = document.createElement('script');
            slideScript.type = 'text/javascript';
            slideScript.src = 'scripts/slides.js';
            slideScript.onload = function() {
                handleDomLoaded();
                refresh = handleDomLoaded;
            }
            document.body.appendChild(slideScript);
            onResize();
        }
    });
    $(window).bind('resize', onResize);
}

function onResize(evt) {
    var height = parseFloat($('#outputBlock').css('width')) * .50;
    $('#output').children().css('webkit-transform', 'scale(' + height / HEIGHT + ')');
    $('#outputBlock').css('height', height);
}



function updateMeta(json) {
    document.title = json.title;
    $('#title').text(json.title);
}

function onSaveSuccess(json) {
    updateMeta(client.meta);
}

function setDoc(json) {
    doc.editor.value = json.blob.markdown;
    onEditChange();
    updateMeta(json);
}

function getDoc() {
    return {
        blob: {
            version: 1,
            markdown: doc.editor.value
        },
        readers: ['public']
    };
}

// For offline - capable applications
function handleAppCache() {
    if (typeof applicationCache == 'undefined') {
        return;
    }

    if (applicationCache.status == applicationCache.UPDATEREADY) {
        applicationCache.swapCache();
        location.reload();
        return;
    }

    applicationCache.addEventListener('updateready', handleAppCache, false);
}
