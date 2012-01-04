var dom = require('shipyard/dom'),
	Request = require('shipyard/http/Request'),
    Anim = require('shipyard/anim/Animation'),
    Sine = require('shipyard/anim/transitions/Sine'),
    log = require('shipyard/utils/log');

var CLICK = 'click',
    LOADING_CLASS = 'loading',
	settings,
    fd;

function highlight(element) {
    var anim = new Anim(element, {
        duration: Anim.SHORT,
        transition: Sine
    });
    anim.start('background-color', '#ffe', '#fff');
}

function updateStatus(status_el, data, created) {
    var update = function(className, content) {
        var child = status_el.getElement(className);
		child.set('text', content);
		highlight(child);
    };
    if (data.status) {
        update('.amo-review_status', data.status);
    }
    if (data.version) {
        update('.amo-latest_version', data.version);
    }
    if (data.get_addon_info_url) {
        status_el.set('data-get_addon_info_url', data.get_addon_info_url);
    }
    //if (data.pk) status_el.set('data-revision_id', data.pk) ;
    var edit_on_amo = status_el.getElement('.UI_AMO_Edit_On_AMO');
    var view_on_amo = status_el.getElement('.UI_AMO_View_On_AMO');
    if (view_on_amo && data.view_on_amo_url && data.status_code > 0) {
        view_on_amo.getElement('a').set('href', data.view_on_amo_url);
        view_on_amo.removeClass('hidden');
		highlight(view_on_amo);
        if (edit_on_amo) {
            edit_on_amo.addClass('hidden');
        }
    }
    if (edit_on_amo && data.edit_on_amo_url && data.status_code === 0) {
        edit_on_amo.getElement('a').set('href', data.edit_on_amo_url);
        edit_on_amo.removeClass('hidden');
        highlight(edit_on_amo.highlight());
        if (view_on_amo) {
            view_on_amo.addClass('hidden');
        }
    }
    if (data.hasOwnProperty('uploaded')) {
        status_el.set('data-uploaded', data.uploaded);
        if (data.uploaded) {
            // remove ability to upload
            var li_anchor = dom.$$('.upload_link')[0],
                anchor = li_anchor.getElement('a');
            // XXX: workaround
            if (anchor) {
                li_anchor.set('text', anchor.get('text'));
                anchor.destroy();
                li_anchor.removeClass('UI_AMO_Version_Uploaded');
                li_anchor.addClass('UI_AMO_Version_Uploaded');
                highlight(li_anchor);
            }
        }
    }
}

function getStatus(status_el) {
    var spinner = status_el.getElement('h2');
    spinner.addClass(LOADING_CLASS).addClass('small');
    new Request({
        url: status_el.get('data-get_addon_info_url'),
        onSuccess: function(response) {
            response = JSON.parse(response);
            updateStatus(status_el, response);
            if (!status_el.get('data-uploaded')) {
                status_el.set('data-uploaded', 1);
            }
            if (response.status_code && response.status_code === -1) {
                setTimeout(function() {
                    getStatus(status_el);
                }, 10 * 1000);
            }
        },
        onComplete: function() {
            spinner.removeClass(LOADING_CLASS);
        }
    }).send();
}

function getStatusFromAMO(status_el) {
	if (!status_el.get('data-uploaded')) {
		return;
	}
	var spinner = status_el.getElement('h2');
	spinner.addClass(LOADING_CLASS).addClass('small');
	new Request({
		url: status_el.get('data-pull_info_url'),
		onSuccess: function(response) {
			updateStatus(status_el, response);
		},
		onComplete: function() {
			spinner.removeClass(LOADING_CLASS);
		}
	}).send();
}

function uploadToAMO(e) {
    var el = this.getParent('li'),
        amo_info = el.getParent('.UI_AMO_Info');

    var spinner = this;
    spinner.addClass(LOADING_CLASS).addClass('small');
    var r = new Request({
        url: el.get('data-upload_url'),
        onSuccess: function(response) {
            fd.message.alert('Uploading to AMO (' + settings.amooauth_domain +')',
                             'We\'ve scheduled the Add-on to upload<br/>' +
                             'Check the upload status and complete the process on your ' +
                             '<a href="' + settings.amooauth_protocol +
                             '://' + settings.amooauth_domain +
                             '/en-US/developers/addons" target="amo_dashboard">AMO dashboard</a>');
			setTimeout(function() {
				getStatus(amo_info);
			}, 5 * 1000);
            updateStatus(amo_info, {'status': 'Upload Scheduled'});
        }.bind(this)
    }).send();

	r.addListener('failure', function() {
		setTimeout(function() {
			getStatus(amo_info);
		}, 500);
	});
}

exports.init = function(fd_) {
    fd = fd_;
	settings = dom.window.get('settings');

    var uploadEl = dom.$('upload-packge');
    if (uploadEl) {
        uploadEl.addListener('click', function(e) {
            if (e) {
                e.stop();
            }
            fd.displayModal(/*upload_package_modal*/);
        });
    }

    var body = dom.document.body;
    body.delegate('.UI_AMO_Upload_New_Version a', CLICK, uploadToAMO);
    body.delegate('.UI_AMO_Upload_New_Addon a', CLICK, uploadToAMO);
    dom.$$('.UI_AMI_Info').forEach(getStatusFromAMO, fd);
};
