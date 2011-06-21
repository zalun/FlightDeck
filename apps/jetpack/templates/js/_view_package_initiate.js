{% load base_helpers %}
  hashtag: '{{ revision.get_cache_hashtag }}',
  package_info: '{% escape_template "_view_package_info.html" %}'
