var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var nsdoc = require('org.startpad.nsdoc');
var format = require('org.startpad.format');
var markdown = new Showdown.converter();

exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc,
    'onSaveSuccess': onSaveSuccess
});

var client;
var doc;                            // Bound elements here
var blob;
var lastText = "";
var syncTime = 5;
var editVisible = false;
var editorInitialized = false;

function onEditChange() {
    var newText = doc.editor.value;
    if (newText == lastText) {
        return;
    }
    client.setDirty();
    lastText = newText;
    try {
        doc.output.innerHTML = markdown.makeHtml(newText);
        nsdoc.updateScriptSections(doc.output);
    } catch (e) {
        $(doc.output).text("Error: " + e.message);
    }
}

function toggleEditor(evt) {
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
    } else {
        $(doc.page).removeClass('edit');
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
        url: '/google/index.html',
        error: function(result, status) {
            console.log('ajax error');
        },
        success: function (slideshow) {
            $('#editor').append(format.escapeHTML(slideshow));
        }
    });
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
