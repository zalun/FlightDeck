
// edit/view package initiate
// {{ revision }}
latest_url: '{{ revision.package.get_latest_url() }}',
id_number: '{{ revision.package.id_number|escapejs }}',
full_name: '{{ revision.package.full_name|escapejs }}',
name: '{{ revision.package.name|escapejs }}',
revision_string: '{{ revision|escapejs }}',
// description: '',
type: '{{ revision.package.type }}',
package_author: '{{ revision.package.author }}',
active: {% if revision.package.active %}
            true
        {% else %}
            false
        {% endif %}
        ,
// url: '',
license: '{{ revision.package.license }}',
package_version_name: '{{ revision.package.version_name }}',
version_url: '{{ revision.package.version.get_absolute_url() }}',
check_latest_url: '{{ revision.package.get_latest_revision_number_url() }}',
// revision specific data
revision_verion_name: '{{ revision.version_name }}',
revision_number: '{{ revision.revision_number }}',
// message: '', // commit message
dependencies: {{ revision.get_dependencies_list_json()|safe }},
origin_url: {% if revision.origin %}
                '{{ revision.origin.get_absolute_url() }}'
            {% else%}
                null    
            {% endif %},
revision_author: '{{ revision.author }}', 
modules: {{ revision.get_modules_list_json()|safe }},
attachments: {{ revision.get_attachments_list_json()|safe }},
folders: {{ revision.get_folders_list_json()|safe }},
// Actions
copy_url: '{{ revision.get_copy_url() }}',
revisions_list_html_url: '{{ url('jp_revisions_list_html', revision.package.id_number) }}/{revision_number}/',
check_if_latest: {{ revision.is_latest|yesno("true,false") }}
