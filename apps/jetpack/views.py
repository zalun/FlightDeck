"""
Views for the Jetpack application
"""
import commonware.log
import time
import os
import shutil
import codecs

#from django.template.defaultfilters import slugify
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.views.static import serve
from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponse, \
                        HttpResponseForbidden, HttpResponseServerError, \
                        HttpResponseNotAllowed, Http404  # , QueryDict
from django.template import RequestContext
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.core.exceptions import ValidationError, NON_FIELD_ERRORS
from django.db.models import Q, ObjectDoesNotExist
from django.db import IntegrityError
from django.views.decorators.http import require_POST
from django.template.defaultfilters import escape
from django.conf import settings
from django.utils import simplejson

from base.shortcuts import get_object_with_related_or_404
from utils import validator
from utils.helpers import pathify

from jetpack.package_helpers import get_package_revision, \
        create_package_from_xpi
from jetpack.models import Package, PackageRevision, Module, Attachment, SDK, \
                           EmptyDir
from jetpack.errors import FilenameExistException, DependencyException

log = commonware.log.getLogger('f.jetpack')


def package_browser(r, page_number=1, type_id=None, username=None):
    """
    Display a list of addons or libraries with pages
    Filter based on the request (type_id, username).
    """
    # calculate which template to use
    template_suffix = ''
    packages = Package.objects.active()

    author = None
    if username:
        author = get_object_or_404(User, username=username)
        packages = packages.filter(author__username=username)
        template_suffix = '%s_user' % template_suffix
    if type_id:
        other_type = 'l' if type_id == 'a' else 'a'
        other_packages_number = len(packages.filter(type=other_type))
        packages = packages.filter(type=type_id)
        template_suffix = '%s_%s' % (template_suffix,
                                     settings.PACKAGE_PLURAL_NAMES[type_id])

    limit = r.GET.get('limit', settings.PACKAGES_PER_PAGE)

    pager = Paginator(
        packages,
        per_page=limit,
        orphans=1
    ).page(page_number)

    return render_to_response(
        'package_browser%s.html' % template_suffix, {
            'pager': pager,
            'author': author,
            'other_packages_number': other_packages_number
        },
        context_instance=RequestContext(r))


def package_view_or_edit(r, id_number, type_id, revision_number=None,
                         version_name=None, latest=False):
    """
    Edit if user is the author, otherwise view
    """
    revision = get_package_revision(id_number, type_id,
                                    revision_number, version_name, latest)
    edit_available = True
    if revision.package.deleted:
        edit_available = False
        if not r.user.is_authenticated():
            raise Http404
        try:
            Package.objects.active_with_deleted(viewer=r.user).get(
                    pk=revision.package.pk)
        except ObjectDoesNotExist:
            raise Http404

    if not revision.package.active:
        edit_available = False
        if not r.user.is_authenticated():
            raise Http404
        try:
            Package.objects.active_with_disabled(viewer=r.user).get(
                    pk=revision.package.pk)
        except ObjectDoesNotExist:
            raise Http404

    if edit_available and \
            r.user.is_authenticated() and r.user.pk == revision.author.pk:
        return package_edit(r, revision)
    else:
        return package_view(r, revision)


@login_required
def package_edit(r, revision):
    """
    Edit package - only for the author
    """
    if r.user.pk != revision.author.pk:
        # redirecting to view mode without displaying an error
        messages.info(r,
                      "Not sufficient priviliges to edit the source. "
                      "You've been redirected to view mode.")

        return HttpResponseRedirect(
            reverse(
                "jp_%s_revision_details" % revision.package.get_type_name(),
                args=[revision.package.id_number, revision.revision_number])
        )
        #return HttpResponseForbidden('You are not the author of this Package')

    libraries = revision.dependencies.all()
    library_counter = len(libraries)
    sdk_list = None
    if revision.package.is_addon():
        library_counter += 1
        sdk_list = SDK.objects.all()

    return render_to_response(
        "%s_edit.html" % revision.package.get_type_name(), {
            'revision': revision,
            'libraries': libraries,
            'library_counter': library_counter,
            'readonly': False,
            'edit_mode': True,
            'sdk_list': sdk_list,
        }, context_instance=RequestContext(r))


def package_view(r, revision):
    """
    Show package - read only
    """
    libraries = revision.dependencies.all()
    library_counter = len(libraries)
    if revision.package.is_addon():
        library_counter += 1

    # prepare the json for the Tree
    tree = simplejson.dumps({'Lib': revision.get_modules_tree(),
            'Data': revision.get_attachments_tree(),
            'Plugins': revision.get_dependencies_tree()})

    return render_to_response(
        "%s_view.html" % revision.package.get_type_name(), {
            'revision': revision,
            'libraries': libraries,
            'library_counter': library_counter,
            'readonly': True,
            'tree': tree
        }, context_instance=RequestContext(r))


def download_module(r, pk):
    """
    return a JSON with all module info
    """
    module = get_object_or_404(Module, pk=pk)
    return HttpResponse(module.get_json())


def get_module(r, id_number, revision_number, filename):
    """
    return a JSON with all module info
    """
    try:
        revision = PackageRevision.objects.get(
                package__id_number=id_number,
                revision_number=revision_number)
        mod = revision.modules.get(filename=filename)
    except:
        log_msg = 'No such module %s' % filename
        log.error(log_msg)
        raise Http404()
    return HttpResponse(mod.get_json())


@login_required
def package_copy(r, id_number, type_id,
                 revision_number=None, version_name=None):
    """
    Copy package - create a duplicate of the Package, set user as author
    """
    source = get_package_revision(id_number, type_id, revision_number,
                                  version_name)

    try:
        package = Package.objects.get(
            full_name=source.package.get_copied_full_name(),
            author__username=r.user.username
            )
    except Package.DoesNotExist:
        package = source.package.copy(r.user)
        source.save_new_revision(package)

        return render_to_response(
            "json/%s_copied.json" % package.get_type_name(),
            {'revision': source},
            context_instance=RequestContext(r),
            mimetype='application/json')

    return HttpResponseForbidden('You already have a %s with that name' %
                                 escape(source.package.get_type_name()))


@login_required
def package_disable(r, id_number):
    """
    Disable Package and return confirmation
    """
    package = get_object_or_404(Package, id_number=id_number)
    if r.user.pk != package.author.pk:
        log_msg = 'User %s wanted to disable not his own Package %s.' % (
            r.user, id_number)
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                package.get_type_name()))

    package.active = False
    package.save()

    return render_to_response("json/package_disabled.json",
                {'package': package},
                context_instance=RequestContext(r),
                mimetype='application/json')


@login_required
def package_activate(r, id_number):
    """
    Undelete Package and return confirmation
    """
    package = get_object_or_404(Package, id_number=id_number)
    if r.user.pk != package.author.pk:
        log_msg = ("[security] Attempt to activate package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                package.get_type_name()))

    package.active = True
    package.save()

    return render_to_response("json/package_activated.json",
                {'package': package},
                context_instance=RequestContext(r),
                mimetype='application/json')

@login_required
def package_delete(r, id_number):
    """
    Delete Package and return confirmation
    """
    package = get_object_or_404(Package, id_number=id_number)
    if r.user.pk != package.author.pk:
        log_msg = ("[security] Attempt to delete package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                package.get_type_name()))

    package.delete()

    return render_to_response("json/package_deleted.json", {},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_add_module(r, id_number, type_id,
                       revision_number=None, version_name=None):
    """
    Add new module to the PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number,
                                    version_name)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to add a module to package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                revision.package.get_type_name()))

    filename = pathify(r.POST.get('filename'))

    mod = Module(
        filename=filename,
        author=r.user,
        code="""// %s.js - %s's module
// author: %s""" % (filename, revision.package.full_name, r.user.get_profile())
    )
    try:
        mod.save()
        revision.module_add(mod)
    except FilenameExistException, err:
        mod.delete()
        return HttpResponseForbidden(escape(str(err)))

    return render_to_response("json/module_added.json",
                {'revision': revision, 'module': mod},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_rename_module(r, id_number, type_id, revision_number):
    """
    Rename a module in a PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to rename a module to package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    old_name = r.POST.get('old_filename')
    new_name = r.POST.get('new_filename')

    if old_name == 'main':
        return HttpResponseForbidden(
            'Sorry, you cannot change the name of the main module.'
        )

    if not revision.validate_module_filename(new_name):
        return HttpResponseForbidden(
            ('Sorry, there is already a module in your add-on '
             'with the name "%s". Each module in your add-on '
             'needs to have a unique name.') % new_name
        )

    modules = revision.modules.all()
    module = None

    for mod in modules:
        if mod.filename == old_name:
            module = mod

    if not module:
        log_msg = 'Attempt to rename a non existing module %s from %s.' % (
            old_name, id_number)
        log.warning(log_msg)
        return HttpResponseForbidden(
            'There is no such module in %s' % escape(
                revision.package.full_name))

    module.filename = new_name
    revision.update(module)

    return render_to_response("json/module_renamed.json",
                {'revision': revision, 'module': module},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_remove_module(r, id_number, type_id, revision_number):
    """
    Remove module from PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to remove a module from package (%s) "
                "by non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    filenames = r.POST.get('filename').split(',')

    try:
        removed_modules, removed_dirs = revision.modules_remove_by_path(
                filenames)
    except Module.DoesNotExist:
        log_msg = 'Attempt to delete a non existing module(s) %s from %s.' % (
            str(filenames), id_number)
        log.warning(log_msg)
        return HttpResponseForbidden(
            'There is no such module in %s' % escape(
                revision.package.full_name))

    return render_to_response("json/module_removed.json",
                {'revision': revision,
                'removed_modules': simplejson.dumps(removed_modules),
                'removed_dirs': simplejson.dumps(removed_dirs)},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_add_folder(r, id_number, type_id, revision_number):
    " adds an EmptyDir to a revision "
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to add a folder to package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    foldername, root = r.POST.get('name', ''), r.POST.get('root_dir')

    dir = EmptyDir(name=foldername, author=r.user, root_dir=root)
    try:
        dir.save()
        revision.folder_add(dir)
    except FilenameExistException, err:
        dir.delete()
        return HttpResponseForbidden(escape(str(err)))

    return render_to_response("json/folder_added.json",
                {'revision': revision, 'folder': dir},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_remove_folder(r, id_number, type_id, revision_number):
    " removes an EmptyDir from a revision "
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to remove a folder from package (%s) "
                "by non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    foldername, root = pathify(r.POST.get('name', '')), r.POST.get('root_dir')
    try:
        folder = revision.folders.get(name=foldername, root_dir=root)
    except EmptyDir.DoesNotExist:
        if root == 'data':
            response = revision.attachment_rmdir(foldername)
        if not response:
            log_msg = 'Attempt to delete a non existing module %s from %s.' % (
                foldername, id_number)
            log.warning(log_msg)
            return HttpResponseForbidden(
                'There is no such module in %s' % escape(
                    revision.package.full_name))
        revision, removed_attachments, removed_emptydirs = response
        return render_to_response('json/%s_rmdir.json' % root, {
            'revision': revision, 'path': foldername,
            'removed_attachments': simplejson.dumps(removed_attachments),
            'removed_dirs': simplejson.dumps(removed_emptydirs),
            'foldername': foldername},
            context_instance=RequestContext(r), mimetype='application/json')
    else:
        revision.folder_remove(folder)

    return render_to_response("json/folder_removed.json",
                {'revision': revision, 'folder': folder},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_switch_sdk(r, id_number, revision_number):
    " switch SDK used to create XPI - sdk_id from POST "
    revision = get_package_revision(id_number, 'a', revision_number)
    if r.user.pk != revision.author.pk:
        return HttpResponseForbidden('You are not the author of this Add-on')

    sdk_id = r.POST.get('id', None)
    sdk = SDK.objects.get(id=sdk_id)
    revision.sdk = sdk
    revision.save()

    return render_to_response("json/sdk_switched.json",
                {'revision': revision, 'sdk': sdk,
                 'sdk_lib': revision.get_sdk_revision()
                },
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_upload_attachment(r, id_number, type_id,
                           revision_number=None, version_name=None):
    """ Upload new attachment to the PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number,
                                    version_name)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to upload attachment to package (%s) "
                "by non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' \
                % escape(revision.package.get_type_name()))

    content = r.raw_post_data
    filename = r.META.get('HTTP_X_FILE_NAME')

    if not filename:
        log_msg = 'Path not found: %s, package: %s.' % (
            filename, id_number)
        log.error(log_msg)
        return HttpResponseServerError('Path not found.')

    try:
        attachment = revision.attachment_create_by_filename(
            r.user, filename, content)
    except ValidationError, e:
        return HttpResponseForbidden('Validation errors.')

    return render_to_response("json/attachment_added.json",
                {'revision': revision, 'attachment': attachment},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_add_empty_attachment(r, id_number, type_id,
                           revision_number=None, version_name=None):
    """ Add new empty attachment to the PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number,
                                    version_name)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to add attachment to package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' \
                % escape(revision.package.get_type_name()))

    filename = r.POST.get('filename', False)

    if not filename:
        log_msg = 'Path not found: %s, package: %s.' % (
            filename, id_number)
        log.error(log_msg)
        return HttpResponseServerError('Path not found.')

    try:
        attachment = revision.attachment_create_by_filename(r.user, filename,'')
    except ValidationError, e:
        return HttpResponseForbidden('Validation error.')

    return render_to_response("json/attachment_added.json",
                {'revision': revision, 'attachment': attachment},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_rename_attachment(r, id_number, type_id, revision_number):
    """
    Rename an attachment in a PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to rename attachment in package (%s) "
                "by non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    uid = r.POST.get('uid', '').strip()
    try:
        attachment = revision.attachments.get(pk=uid)
    except:
        log_msg = ('Attempt to rename a non existing attachment. attachment: '
                   '%s, package: %s.' % (uid, id_number))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'There is no such attachment in %s' % escape(
                revision.package.full_name))

    new_name = r.POST.get('new_filename')
    new_ext = r.POST.get('new_ext') or attachment.ext

    if not revision.validate_attachment_filename(new_name, new_ext):
        return HttpResponseForbidden(
            ('Sorry, there is already an attachment in your add-on '
             'with the name "%s.%s". Each attachment in your add-on '
             'needs to have a unique name.') % (new_name, attachment.ext)
        )
    attachment.filename = new_name
    attachment.ext = new_ext
    attachment = revision.update(attachment)

    return render_to_response("json/attachment_renamed.json",
                {'revision': revision, 'attachment': attachment},
                context_instance=RequestContext(r),
                mimetype='application/json')

@require_POST
@login_required
def package_rmdir(r, pk, target, path):
    """
    Remove attachment from PackageRevision
    """
    revision = get_object_or_404(PackageRevision, pk=pk)
    if target not in ['data', 'lib']:
        return HttpResponseForbidden
    if target == 'lib':
        return HttpResponseForbidden('not supported yet')

    revision.attachment_rmdir(path) if target == 'data' else \
            revision.modules_rmdir(path)
    return render_to_response('%s_rmdir.json' % target, {
        'revision': revision, 'path': path},
        context_instance=RequestContext(r), mimetype='application/json')

@require_POST
@login_required
def package_remove_attachment(r, id_number, type_id, revision_number):
    """
    Remove attachment from PackageRevision
    """
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to remove attachment from package (%s) "
                "by non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    uid = r.POST.get('uid', '').strip()
    attachment = Attachment.objects.get(pk=uid, revisions=revision)

    if not attachment:
        log_msg = ('Attempt to remove a non existing attachment. attachment: '
                   '%s, package: %s.' % (uid, id_number))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'There is no such attachment in %s' % escape(
                revision.package.full_name))

    revision.attachment_remove(attachment)

    return render_to_response("json/attachment_removed.json",
                {'revision': revision, 'attachment': attachment},
                context_instance=RequestContext(r),
                mimetype='application/json')


def download_attachment(request, uid):
    """
    Display attachment from PackageRevision
    """
    attachment = get_object_or_404(Attachment, id=uid)
    response = serve(request, attachment.path,
                     settings.UPLOAD_DIR, show_indexes=False)
    response['Content-Disposition'] = 'filename=%s' % attachment.filename
    return response

@require_POST
@login_required
def package_save(r, id_number, type_id, revision_number=None,
                 version_name=None):
    """
    Save package and modules
    @TODO: check how dynamic module loading affects save
    """
    revision = get_package_revision(id_number, type_id, revision_number,
                                    version_name)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to save package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    save_revision = False
    save_package = False
    start_version_name = revision.version_name
    start_revision_message = revision.message

    response_data = {}

    package_full_name = r.POST.get('full_name', False)
    version_name = r.POST.get('version_name', False)

    # validate package_full_name and version_name
    if package_full_name and not validator.is_valid(
        'alphanum_plus_space', package_full_name):
        return HttpResponseNotAllowed(escape(
            validator.get_validation_message('alphanum_plus_space')))

    if version_name and not validator.is_valid(
        'alphanum_plus', version_name):
        return HttpResponseNotAllowed(escape(
            validator.get_validation_message('alphanum_plus')))

    if package_full_name and package_full_name != revision.package.full_name:
        try:
            Package.objects.get(full_name=package_full_name)
            return HttpResponseForbidden(
                'You already have a %s with that name' % escape(
                    revision.package.get_type_name())
                )
        except:
            save_package = True
            response_data['full_name'] = package_full_name
            revision.package.full_name = package_full_name

    package_description = r.POST.get('package_description', False)
    if package_description:
        save_package = True
        revision.package.description = package_description
        response_data['package_description'] = package_description

    changes = []
    for mod in revision.modules.all():
        if r.POST.get(mod.filename, False):
            code = r.POST[mod.filename]
            if mod.code != code:
                mod.code = code
                changes.append(mod)

    for att in revision.attachments.all():
        uid = str(att.pk)
        if r.POST.get(uid):
            att.data = r.POST[uid]
            if att.changed():
                changes.append(att)

    attachments_changed = {}
    if save_revision or changes:
        revision.save()

    if changes:
        attachments_changed = simplejson.dumps(
                revision.updates(changes, save=False))

    revision_message = r.POST.get('revision_message', False)
    if revision_message and revision_message != start_revision_message:
        revision.message = revision_message
        # save revision message without changeing the revision
        super(PackageRevision, revision).save()
        response_data['revision_message'] = revision_message

    if version_name and version_name != start_version_name \
        and version_name != revision.package.version_name:
        save_package = False
        try:
            revision.set_version(version_name)
        except Exception, err:
            return HttpResponseForbidden(escape(err.__str__()))

    if save_package:
        revision.package.save()
        response_data['name'] = revision.package.name

    response_data['version_name'] = revision.version_name \
            if revision.version_name else ""

    return render_to_response("json/package_saved.json", locals(),
                context_instance=RequestContext(r),
                mimetype='application/json')


@login_required
def package_create(r, type_id):
    """
    Create new Package (Add-on or Library)
    Usually no full_name used
    """

    full_name = r.POST.get("full_name", None)
    description = r.POST.get("description", "")

    item = Package(
        author=r.user,
        full_name=full_name,
        description=description,
        type=type_id)

    try:
        item.save()
    except ValidationError, err:
        if NON_FIELD_ERRORS in err.message_dict:
            return HttpResponseForbidden(
                "You already have a %s with that name (%s)" % (
                    escape(settings.PACKAGE_SINGULAR_NAMES[type_id]),
                    item.full_name))
        return HttpResponseForbidden(str(err))

    return HttpResponseRedirect(reverse(
        'jp_%s_latest' % item.get_type_name(), args=[item.id_number]))


@require_POST
@login_required
def upload_xpi(request):
    """
    upload XPI and create Addon and eventual Libraries
    """
    xpi = request.FILES['xpi']
    temp_dir = os.path.join(settings.UPLOAD_DIR, str(time.time()))
    os.mkdir(temp_dir)
    path = os.path.join(temp_dir, xpi.name)
    xpi_file = codecs.open(path, mode='wb+', encoding='utf-8')
    for chunk in xpi.chunks():
        xpi_file.write(chunk)
    xpi_file.close()
    try:
        addon = create_package_from_xpi(path, request.user)
    except Exception, err:
        log.warning("Bad file %s" % str(err))
        return HttpResponseForbidden('Wrong file')
    shutil.rmtree(temp_dir)
    return HttpResponseRedirect(addon.get_absolute_url())
    # after front-end will support interactive upload
    return HttpResponse(simplejson.dumps({'reload': addon.get_absolute_url()}))


@login_required
def library_autocomplete(r):
    """
    'Live' search by name
    """
    try:
        query = r.GET.get('q')
        limit = r.GET.get('limit', settings.LIBRARY_AUTOCOMPLETE_LIMIT)
        found = Package.objects.libraries().exclude(
            name='jetpack-core').filter(
                Q(name__icontains=query) | Q(full_name__icontains=query)
            )[:limit]
    except:
        found = []

    return render_to_response('json/library_autocomplete.json',
                {'libraries': found},
                context_instance=RequestContext(r),
                mimetype='application/json')


@require_POST
@login_required
def package_assign_library(r, id_number, type_id,
                           revision_number=None, version_name=None):
    " assign library to the package "
    revision = get_package_revision(id_number, type_id, revision_number,
                                    version_name)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to assign library to package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden('You are not the author of this Package')

    library = get_object_or_404(
        Package, type='l', id_number=r.POST['id_number'])
    if r.POST.get('use_latest_version', False):
        lib_revision = library.version
    else:
        lib_revision = library.latest

    try:
        revision.dependency_add(lib_revision)
    except Exception, err:
        return HttpResponseForbidden(escape(err.__str__()))

    lib_revision_url = lib_revision.get_absolute_url() \
        if r.user.pk == lib_revision.pk \
        else lib_revision.get_absolute_url()

    return render_to_response('json/library_assigned.json', {
        'revision': revision,
        'library': library,
        'lib_revision': lib_revision,
        'lib_revision_url': lib_revision_url,
    }, context_instance=RequestContext(r), mimetype='application/json')


@require_POST
@login_required
def package_remove_library(r, id_number, type_id, revision_number):
    " remove dependency from the library provided via POST "
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to remove library from package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                revision.package.get_type_name()))

    lib_id_number = r.POST.get('id_number')
    library = get_object_or_404(Package, id_number=lib_id_number)

    try:
        revision.dependency_remove_by_id_number(lib_id_number)
    except Exception, err:
        return HttpResponseForbidden(escape(err.__str__()))

    return render_to_response('json/dependency_removed.json',
                {'revision': revision, 'library': library},
                context_instance=RequestContext(r),
                mimetype='application/json')

@require_POST
@login_required
def package_update_library(r, id_number, type_id, revision_number):
    " update a dependency to a certain version "
    revision = get_package_revision(id_number, type_id, revision_number)
    if r.user.pk != revision.author.pk:
        log_msg = ("[security] Attempt to update library in package (%s) by "
                   "non-owner (%s)" % (id_number, r.user))
        log.warning(log_msg)
        return HttpResponseForbidden(
            'You are not the author of this %s' % escape(
                revision.package.get_type_name()))
    
    lib_id_number = r.POST.get('id_number')
    lib_revision = r.POST.get('revision')
    
    library = get_object_or_404(PackageRevision, pk=lib_revision, package__id_number=lib_id_number)
    
    try:
        revision.dependency_update(library)
    except DependencyException, err:
        return HttpResponseForbidden(escape(err.__str__()))
    
    return render_to_response('json/library_updated.json',
                {'revision': revision, 'library': library.package,
                 'lib_revision': library},
                context_instance=RequestContext(r),
                mimetype='application/json')

@login_required
def package_latest_dependencies(r, id_number, type_id, revision_number):
    revision = get_package_revision(id_number, type_id, revision_number)
    out_of_date = revision.get_outdated_dependency_versions()

    return render_to_response('json/latest_dependencies.json',
            {'revisions': out_of_date},
            context_instance=RequestContext(r),
            mimetype='application/json')

def get_revisions_list(id_number):
    " provide a list of the Package's revsisions "
    return PackageRevision.objects.filter(package__id_number=id_number)


def get_revisions_list_html(r, id_number):
    " returns revision list to be displayed in the modal window "
    package = get_object_with_related_or_404(Package, id_number=id_number)
    revisions = get_revisions_list(id_number)
    return render_to_response(
        '_package_revisions_list.html', {
            'package': package,
            'revisions': revisions
        },
        context_instance=RequestContext(r))


def get_latest_revision_number(request, package_id):
    """ returns the latest revision number for given package """
    package = get_object_or_404(Package, id_number=package_id)
    return HttpResponse(simplejson.dumps({
        'revision_number': package.latest.revision_number}))
