release: env PYTHONPATH=/hetzner DJANGO_SETTINGS_MODULE=settings_prod python manage.py migrate
web: env PYTHONPATH=/hetzner DJANGO_SETTINGS_MODULE=settings_prod gunicorn --log-level info --log-file - finances.wsgi:application
